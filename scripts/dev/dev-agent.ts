import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AGENT_SERVER_DIR,
  type AgentServerDatabase,
  type AgentServerState,
  agentServerPort,
  agentServerSettings,
  isAlive,
  logFile,
  memoryCapped,
  readAgentServer,
  stateFile,
} from "./dev-agent-server";
import { requireProdCopyUrl } from "../seed/local";

const USAGE = "Usage: pnpm dev:agent [--prod] | pnpm dev:agent stop";
const root = process.cwd();
const [command, ...rest] = process.argv.slice(2);

if (command === "supervise") await supervise(Number(rest[0]), rest[1]);
else if (command === "stop") await stop();
else if (command === undefined || command === "--prod")
  await start(command ? "prod" : "seed");
else throw new Error(USAGE);

async function start(database: AgentServerDatabase) {
  const { idleMs } = agentServerSettings(process.env);
  const running = readAgentServer(root);
  if (running) {
    if (running.database !== database) {
      throw new Error(
        `This checkout's agent server already runs on the ${running.database} database, at ${running.url}. Run \`pnpm dev:agent stop\` first.`,
      );
    }
    return report(await waitUntilReady(), idleMs);
  }

  const env =
    database === "prod"
      ? { ...process.env, DATABASE_URL: requireProdCopyUrl() }
      : process.env;
  const port = await freePort(agentServerPort(realpathSync(root)));
  mkdirSync(join(root, AGENT_SERVER_DIR), { recursive: true });
  const log = openSync(logFile(root), "w");
  const supervisor = spawn(
    process.execPath,
    [
      ...process.execArgv,
      fileURLToPath(import.meta.url),
      "supervise",
      String(port),
      database,
    ],
    { detached: true, stdio: ["ignore", log, log], env },
  );
  supervisor.unref();
  // A pid that has exited stays a zombie until we exit, so isAlive can't
  // tell; the event can.
  let exited = false;
  supervisor.on("exit", () => (exited = true));
  report(await waitUntilReady(() => exited), idleMs);
}

async function waitUntilReady(supervisorExited = () => false) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const state = readAgentServer(root);
    if (state?.ready) return state;
    if (!state && supervisorExited()) {
      console.error(readFileSync(logFile(root), "utf8").slice(-3000));
      throw new Error(`The agent server didn't start. Log: ${logFile(root)}`);
    }
    await sleep(250);
  }
  throw new Error(
    `The agent server is still starting after 3 minutes. Log: ${logFile(root)}`,
  );
}

function report(state: AgentServerState, idleMs: number) {
  console.log(`Agent dev server (${state.database}): ${state.url}`);
  console.log(
    `Log: ${logFile(root)}. Stops after ${idleMs / 60_000} idle minutes; \`pnpm dev:agent stop\` stops it now.`,
  );
}

async function stop() {
  const state = readAgentServer(root);
  if (!state) {
    console.log("No agent dev server is running in this checkout.");
    return;
  }
  process.kill(state.supervisorPid, "SIGTERM");
  const deadline = Date.now() + 20_000;
  while (isAlive(state.supervisorPid)) {
    if (Date.now() > deadline) {
      throw new Error(
        `The supervisor (pid ${state.supervisorPid}) didn't stop. Log: ${logFile(root)}`,
      );
    }
    await sleep(100);
  }
  console.log(`Stopped the agent dev server on ${state.url}.`);
}

async function supervise(port: number, database: string | undefined) {
  if (database !== "seed" && database !== "prod") throw new Error(USAGE);
  const { memoryMax, idleMs } = agentServerSettings(process.env);
  const state: AgentServerState = {
    supervisorPid: process.pid,
    port,
    url: `http://localhost:${port}`,
    database,
    ready: false,
  };
  const save = (flag = "w") =>
    writeFileSync(stateFile(root), JSON.stringify(state), { flag });
  try {
    save("wx");
  } catch {
    // Another `pnpm dev:agent` won the race; its caller waits on that one.
    console.log("Another supervisor owns this checkout's server.");
    process.exit(0);
  }

  const unit = `open-caddie-dev-${port}`;
  const capped = systemdRunWorks(unit);
  const next = ["node_modules/.bin/next", ["dev", "-p", String(port)]] as const;
  const { command, args } = capped
    ? memoryCapped(next[0], [...next[1]], memoryMax, unit)
    : { command: next[0], args: [...next[1]] };
  if (!capped) {
    console.log(
      "WARNING: systemd-run --user is unavailable, so the server runs without a memory cap.",
    );
  }

  // Turbopack writes its cache a few seconds after it compiles, and `next dev`
  // gives next-server only 100ms after a signal before SIGKILL by default. A
  // kill mid-write leaves .next/dev corrupt, and the next start can hang.
  const child = spawn(command, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_EXIT_TIMEOUT_MS: "10000" },
  });
  state.serverPid = child.pid;
  if (capped) state.memoryMax = memoryMax;
  save();

  // `next dev` prints a line for every request it serves, so a quiet log
  // means no requests. Other output (compiles, errors) counts as activity too.
  let lastActivity = Date.now();
  const onOutput = (chunk: Buffer) => {
    process.stdout.write(chunk);
    lastActivity = Date.now();
    if (!state.ready && chunk.toString().includes("Ready in")) {
      state.ready = true;
      save();
    }
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);

  let stopping = false;
  const stopServer = (reason: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[dev-agent] Stopping: ${reason}.`);
    // Only the parent: it forwards the signal to next-server and waits for it
    // to finish writing. The group SIGKILL is for a parent that hangs.
    child.kill("SIGTERM");
    setTimeout(() => killGroup(child.pid, "SIGKILL"), 15_000).unref();
  };
  const idleCheck = setInterval(
    () => {
      if (Date.now() - lastActivity >= idleMs) {
        stopServer(`no requests for ${idleMs / 60_000} minutes`);
      }
    },
    Math.min(idleMs / 4, 30_000),
  );
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
    process.on(signal, () => stopServer(`got ${signal}`));
  }

  child.on("exit", (code, signal) => {
    clearInterval(idleCheck);
    const oom = capped && unitResult(unit) === "oom-kill";
    console.log(
      oom
        ? `[dev-agent] The server hit MemoryMax=${memoryMax} and was killed. Raise DEV_AGENT_MEMORY_MAX if a normal session needs more.`
        : `[dev-agent] next dev exited with ${code ?? signal}.`,
    );
    if (capped) resetUnit(unit);
    rmSync(stateFile(root), { force: true });
    process.exit(0);
  });
}

function killGroup(pid: number | undefined, signal: NodeJS.Signals) {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone.
  }
}

function systemdRunWorks(unit: string) {
  resetUnit(unit);
  return (
    spawnSync(
      "systemd-run",
      ["--user", "--scope", "--quiet", "--collect", "true"],
      { stdio: "ignore" },
    ).status === 0
  );
}

function unitResult(unit: string) {
  return spawnSync(
    "systemctl",
    ["--user", "show", "-P", "Result", `${unit}.scope`],
    {
      encoding: "utf8",
    },
  ).stdout?.trim();
}

// The scope isn't --collect'ed, so its Result survives for unitResult; this
// unloads it so the next start can reuse the name.
function resetUnit(unit: string) {
  spawnSync("systemctl", ["--user", "reset-failed", `${unit}.scope`], {
    stdio: "ignore",
  });
}

async function freePort(preferred: number) {
  for (let port = preferred; port < preferred + 50; port++) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No free port in ${preferred}-${preferred + 49}`);
}

function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer()
      .once("error", () => resolve(false))
      .listen(port, () => server.close(() => resolve(true)));
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
