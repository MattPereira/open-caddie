import {
  CLIENT_ERROR_LIMIT,
  CLIENT_ERROR_MESSAGE_MAX,
  type ClientError,
} from "./client-error-schema";

// Kept so a bug report can carry the failure, not just the reporter's
// description of it.
const recent: ClientError[] = [];
let capturing = false;

export function recordClientError(
  kind: ClientError["kind"],
  value: unknown,
  digest?: string,
) {
  recent.push({
    at: new Date().toISOString(),
    kind,
    message: messageOf(value).slice(0, CLIENT_ERROR_MESSAGE_MAX),
    ...(digest ? { digest } : {}),
  });
  if (recent.length > CLIENT_ERROR_LIMIT) recent.shift();
}

export function recentClientErrors(): ClientError[] {
  return [...recent];
}

export function startCapturingClientErrors() {
  if (capturing || typeof window === "undefined") return;
  capturing = true;
  window.addEventListener("error", (event) =>
    recordClientError("error", event.error ?? event.message),
  );
  window.addEventListener("unhandledrejection", (event) =>
    recordClientError("unhandledrejection", event.reason),
  );
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    recordClientError("console", args);
    consoleError.apply(console, args);
  };
}

function messageOf(value: unknown): string {
  if (value instanceof Error) {
    // Safari's stack is only the frames; V8's starts with this heading.
    const heading = `${value.name}: ${value.message}`;
    if (value.stack?.startsWith(heading)) return value.stack;
    return value.stack ? `${heading}\n${value.stack}` : heading;
  }
  if (Array.isArray(value)) return value.map(messageOf).join(" ");
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
