// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Client = typeof import("../client");

describe("capturing errors in the browser", () => {
  let client: Client;
  let logged: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
  const consoleError = console.error;

  beforeEach(async () => {
    vi.resetModules();
    logged = vi.fn<(...args: unknown[]) => void>();
    console.error = logged;
    client = await import("../client");
    client.startCapturingClientErrors();
  });
  afterEach(() => {
    console.error = consoleError;
  });

  it("keeps uncaught errors, rejections and console errors, oldest first", () => {
    window.dispatchEvent(
      new ErrorEvent("error", { error: new TypeError("x is undefined") }),
    );
    const rejection = new Event("unhandledrejection");
    Object.assign(rejection, { reason: "fetch failed" });
    window.dispatchEvent(rejection);
    console.error("Hydration failed", { at: 1 });

    expect(
      client
        .recentClientErrors()
        .map(({ kind, message }) => ({ kind, message })),
    ).toEqual([
      {
        kind: "error",
        message: expect.stringMatching(/^TypeError: x is undefined/),
      },
      { kind: "unhandledrejection", message: "fetch failed" },
      { kind: "console", message: 'Hydration failed {"at":1}' },
    ]);
  });

  it("still logs to the console, once, however often it starts", () => {
    client.startCapturingClientErrors();
    console.error("once");

    expect(logged).toHaveBeenCalledExactlyOnceWith("once");
    expect(client.recentClientErrors()).toHaveLength(1);
  });

  it.each([
    {
      when: "V8's, which starts with the message",
      stack: "TypeError: boom\n    at f (a.js:1)",
      message: "TypeError: boom\n    at f (a.js:1)",
    },
    {
      when: "Safari's, only frames",
      stack: "f@a.js:1",
      message: "TypeError: boom\nf@a.js:1",
    },
    { when: "missing", stack: undefined, message: "TypeError: boom" },
  ])("names an Error whose stack is $when", ({ stack, message }) => {
    const error = new TypeError("boom");
    error.stack = stack;
    client.recordClientError("error", error);

    expect(client.recentClientErrors()[0].message).toBe(message);
  });

  it("describes a value JSON can't hold", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    client.recordClientError("unhandledrejection", circular);
    client.recordClientError("unhandledrejection", undefined);

    expect(client.recentClientErrors().map((e) => e.message)).toEqual([
      "[object Object]",
      "undefined",
    ]);
  });

  it("records a boundary's digest with a timestamp", () => {
    client.recordClientError("boundary", new Error("render failed"), "123");

    const [recorded] = client.recentClientErrors();
    expect(recorded).toMatchObject({ kind: "boundary", digest: "123" });
    expect(new Date(recorded.at).toISOString()).toBe(recorded.at);
  });

  it("keeps only the last 20, each cut to 2,000 characters", () => {
    for (let i = 0; i < 21; i++) client.recordClientError("console", `${i}`);
    client.recordClientError("console", "x".repeat(2001));

    const recent = client.recentClientErrors();
    expect(recent).toHaveLength(20);
    expect(recent[0].message).toBe("2");
    expect(recent.at(-1)?.message).toHaveLength(2000);
  });
});
