// @vitest-environment jsdom

import { act, createElement } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { HydrationMarker } from "./hydration-marker";

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  delete document.body.dataset.hydrated;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("marks the body once hydrated, without a hydration mismatch", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(createElement(HydrationMarker));
  document.body.append(container);
  expect(document.body.hasAttribute("data-hydrated")).toBe(false);

  const recoverableError = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  act(() => {
    root = hydrateRoot(container, createElement(HydrationMarker), {
      onRecoverableError: recoverableError,
    });
  });

  expect(document.body.hasAttribute("data-hydrated")).toBe(true);
  expect(recoverableError).not.toHaveBeenCalled();
  expect(consoleError).not.toHaveBeenCalled();
});
