import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export type AgentServerDatabase = "seed" | "prod";

export type AgentServerState = {
  supervisorPid: number;
  serverPid?: number;
  port: number;
  url: string;
  database: AgentServerDatabase;
  memoryMax?: string;
  ready: boolean;
};

export const AGENT_SERVER_DIR = ".dev-agent";
export const stateFile = (root: string) =>
  join(root, AGENT_SERVER_DIR, "server.json");
export const logFile = (root: string) =>
  join(root, AGENT_SERVER_DIR, "server.log");

// Above the 3000 + n ports setup-agent uses for Bug Report snapshots in CI.
const PORT_BASE = 3100;
const PORT_RANGE = 900;

export function agentServerPort(checkoutPath: string) {
  const hash = createHash("sha256").update(checkoutPath).digest();
  return PORT_BASE + (hash.readUInt32BE(0) % PORT_RANGE);
}

// One cold-starting `next dev` peaks at ~3.0 GB and settles at ~2.0 GB,
// then grows as routes compile. 5G leaves room for a session's routes, and
// five capped servers (25 GB) still fit in the machine's 30 GB.
const DEFAULT_MEMORY_MAX = "5G";
const DEFAULT_IDLE_MINUTES = 10;

export function agentServerSettings(env: Record<string, string | undefined>) {
  const memoryMax = env.DEV_AGENT_MEMORY_MAX || DEFAULT_MEMORY_MAX;
  if (!/^\d+[KMGT]?$/.test(memoryMax)) {
    throw new Error(
      `DEV_AGENT_MEMORY_MAX must be bytes with an optional K/M/G/T suffix, got "${memoryMax}"`,
    );
  }
  const idleMinutes = Number(
    env.DEV_AGENT_IDLE_MINUTES || DEFAULT_IDLE_MINUTES,
  );
  if (!(idleMinutes > 0)) {
    throw new Error(
      `DEV_AGENT_IDLE_MINUTES must be a positive number, got "${env.DEV_AGENT_IDLE_MINUTES}"`,
    );
  }
  return { memoryMax, idleMs: idleMinutes * 60_000 };
}

// MemorySwapMax=0: swapping out a runaway server is what froze the machine;
// without swap the kernel kills the scope at the cap instead.
export function memoryCapped(
  command: string,
  args: string[],
  memoryMax: string,
  unit: string,
) {
  return {
    command: "systemd-run",
    args: [
      "--user",
      "--scope",
      "--quiet",
      `--unit=${unit}`,
      "-p",
      `MemoryMax=${memoryMax}`,
      "-p",
      "MemorySwapMax=0",
      "--",
      command,
      ...args,
    ],
  };
}

export function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the pid exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// The server this checkout's `pnpm dev:agent` started, if it's still up.
// Clears a state file its supervisor left behind when it died.
export function readAgentServer(root: string): AgentServerState | undefined {
  const file = stateFile(root);
  let state: AgentServerState;
  try {
    state = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
  if (isAlive(state.supervisorPid)) return state;
  rmSync(file, { force: true });
  return undefined;
}
