import { GatewayError } from "@ai-sdk/gateway";

export async function withGatewayFallback<T, GatewayModel, DirectModel>(
  gatewayModel: GatewayModel,
  directModel: DirectModel,
  operation: (model: GatewayModel | DirectModel) => Promise<T>,
): Promise<T> {
  try {
    return await operation(gatewayModel);
  } catch (error) {
    if (!GatewayError.isInstance(error)) throw error;

    console.warn(
      "AI Gateway request failed; retrying direct provider.",
      error,
    );

    return operation(directModel);
  }
}
