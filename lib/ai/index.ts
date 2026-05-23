import type { DesignProvider, ProviderName } from "./types";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import { ReplicateProvider } from "./replicate";

export function getProvider(name: ProviderName): DesignProvider {
  switch (name) {
    case "gemini": return new GeminiProvider();
    case "openai": return new OpenAIProvider();
    case "replicate": return new ReplicateProvider();
  }
}

export class MissingApiKeyError extends Error {
  constructor(public envVar: string) { super(`Missing env var: ${envVar}`); }
}
