import { GatewayInternalServerError } from "@ai-sdk/gateway";
import { describe, expect, it, vi } from "vitest";

import { withGatewayFallback } from "./gateway-fallback";

describe("withGatewayFallback", () => {
  const gatewayModel = { route: "gateway" };
  const directModel = { route: "direct" };

  it("returns the primary result without invoking the fallback", async () => {
    const operation = vi.fn(async (model: typeof gatewayModel) => {
      expect(model).toBe(gatewayModel);
      return "primary";
    });

    await expect(
      withGatewayFallback(gatewayModel, directModel, operation),
    ).resolves.toBe("primary");

    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(gatewayModel);
  });

  it("retries once through the direct provider after a Gateway error", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new GatewayInternalServerError())
      .mockResolvedValueOnce("fallback");

    await expect(
      withGatewayFallback(gatewayModel, directModel, operation),
    ).resolves.toBe("fallback");

    expect(operation).toHaveBeenNthCalledWith(1, gatewayModel);
    expect(operation).toHaveBeenNthCalledWith(2, directModel);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-Gateway errors without invoking the fallback", async () => {
    const error = new Error("request failed");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(
      withGatewayFallback(gatewayModel, directModel, operation),
    ).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(gatewayModel);
  });

  it("propagates a fallback failure", async () => {
    const error = new Error("direct provider failed");
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new GatewayInternalServerError())
      .mockRejectedValueOnce(error);

    await expect(
      withGatewayFallback(gatewayModel, directModel, operation),
    ).rejects.toBe(error);

    expect(operation).toHaveBeenNthCalledWith(1, gatewayModel);
    expect(operation).toHaveBeenNthCalledWith(2, directModel);
  });
});
