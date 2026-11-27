import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AGENT_SERVER_DIR,
  agentServerPort,
  agentServerSettings,
  isAlive,
  logFile,
  memoryCapped,
  readAgentServer,
  stateFile,
} from "./dev-agent-server";

describe("agentServerPort", () => {
  it("is stable for a checkout and differs between checkouts", () => {
    const a = "/home/dev/orca/workspaces/open-caddie/feature-a";
    const b = "/home/dev/orca/workspaces/open-caddie/feature-b";
    expect(agentServerPort(a)).toBe(agentServerPort(a));
    expect(agentServerPort(a)).not.toBe(agentServerPort(b));
  });

  it("stays in 3100-3999, clear of 3000 and the Bug Report ports", () => {
    const ports = Array.from({ length: 2000 }, (_, i) =>
      agentServerPort(`/checkout-${i}`),
    );
    expect(Math.min(...ports)).toBeGreaterThanOrEqual(3100);
    expect(Math.max(...ports)).toBeLessThanOrEqual(3999);
    expect(new Set(ports).size).toBeGreaterThan(800);
  });
});

describe("agentServerSettings", () => {
  it("defaults to a 5G cap and 10 idle minutes", () => {
    expect(agentServerSettings({})).toEqual({
      memoryMax: "5G",
      idleMs: 600_000,
    });
  });

  it("takes overrides, including fractional minutes", () => {
    expect(
      agentServerSettings({
        DEV_AGENT_MEMORY_MAX: "512M",
        DEV_AGENT_IDLE_MINUTES: "0.5",
      }),
    ).toEqual({ memoryMax: "512M", idleMs: 30_000 });
  });

  it("takes a cap in plain bytes", () => {
    expect(
      agentServerSettings({ DEV_AGENT_MEMORY_MAX: "536870912" }).memoryMax,
    ).toBe("536870912");
  });

  it("treats empty overrides as unset", () => {
    expect(
      agentServerSettings({
        DEV_AGENT_MEMORY_MAX: "",
        DEV_AGENT_IDLE_MINUTES: "",
      }),
    ).toEqual({ memoryMax: "5G", idleMs: 600_000 });
  });

  it.each(["5 G", "5GB", "G", "-1G", "5G "])(
    "rejects the cap %j",
    (memoryMax) => {
      expect(() =>
        agentServerSettings({ DEV_AGENT_MEMORY_MAX: memoryMax }),
      ).toThrow(`DEV_AGENT_MEMORY_MAX must be bytes`);
    },
  );

  it.each(["0", "-5", "ten"])("rejects idle minutes %j", (minutes) => {
    expect(() =>
      agentServerSettings({ DEV_AGENT_IDLE_MINUTES: minutes }),
    ).toThrow(
      `DEV_AGENT_IDLE_MINUTES must be a positive number, got "${minutes}"`,
    );
  });
});

describe("memoryCapped", () => {
  it("runs the command in a named user scope with the cap and no swap", () => {
    expect(
      memoryCapped("next", ["dev", "-p", "3100"], "5G", "open-caddie-dev-3100"),
    ).toEqual({
      command: "systemd-run",
      args: [
        "--user",
        "--scope",
        "--quiet",
        "--unit=open-caddie-dev-3100",
        "-p",
        "MemoryMax=5G",
        "-p",
        "MemorySwapMax=0",
        "--",
        "next",
        "dev",
        "-p",
        "3100",
      ],
    });
  });
});

describe("readAgentServer", () => {
  const checkout = () => {
    const root = mkdtempSync(join(tmpdir(), "dev-agent-"));
    mkdirSync(join(root, AGENT_SERVER_DIR));
    return root;
  };
  const deadPid = () => spawnSync("true").pid as number;
  const state = (supervisorPid: number) => ({
    supervisorPid,
    port: 3456,
    url: "http://localhost:3456",
    database: "seed",
    ready: true,
  });

  it("keeps its files in the checkout's .dev-agent folder", () => {
    expect(stateFile("/c")).toBe("/c/.dev-agent/server.json");
    expect(logFile("/c")).toBe("/c/.dev-agent/server.log");
  });

  it("returns the state while its supervisor is alive", () => {
    const root = checkout();
    writeFileSync(stateFile(root), JSON.stringify(state(process.pid)));
    expect(readAgentServer(root)).toEqual(state(process.pid));
  });

  it("clears the state its dead supervisor left behind", () => {
    const root = checkout();
    writeFileSync(stateFile(root), JSON.stringify(state(deadPid())));
    expect(readAgentServer(root)).toBeUndefined();
    expect(existsSync(stateFile(root))).toBe(false);
  });

  it("is undefined when nothing was started", () => {
    expect(readAgentServer(checkout())).toBeUndefined();
  });

  it("counts a pid owned by another user as alive", () => {
    expect(isAlive(1)).toBe(true);
  });
});
