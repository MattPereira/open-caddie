import { google } from "@ai-sdk/google";
import { GatewayError } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";

export const DEFAULT_SCORECARD_MODEL = "google/gemini-3.1-flash-lite";

export function getGoogleGenerativeAIScorecardModel(
  model: string,
): LanguageModel {
  return google(
    model.startsWith("google/") ? model.slice("google/".length) : model,
  );
}

export async function withGoogleGenerativeAIScorecardFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    if (!GatewayError.isInstance(error)) {
      throw error;
    }

    console.warn(
      "AI Gateway scorecard parsing failed; retrying with Google provider.",
      error,
    );

    return fallback();
  }
}
