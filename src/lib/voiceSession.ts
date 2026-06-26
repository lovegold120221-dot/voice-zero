// src/lib/voiceSession.ts
//
// Eburon voice-session wrapper.
//
// This is the ONLY client-side file that imports the realtime SDK directly.
// It is allowlisted by scripts/check-eburon-branding.mjs so that the rest
// of the front-end (user-visible lore, system prompts, log strings, etc.)
// stays free of provider / model brand names.
//
// All callers should import from this module instead of from the SDK.

import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
  FunctionDeclaration,
} from '@google/genai';

export type { LiveServerMessage, FunctionDeclaration };
export { Modality, Type };

let _aiPromise: Promise<GoogleGenAI> | null = null;

/**
 * Lazily create (and memoize) a realtime SDK client for the given API key.
 * The Promise is cached so all callers reuse the same client instance.
 */
export async function getVoiceClient(apiKey: string): Promise<GoogleGenAI> {
  if (!_aiPromise) {
    _aiPromise = Promise.resolve(new GoogleGenAI({ apiKey, apiVersion: 'v1beta' }));
  }
  return _aiPromise;
}

/**
 * One-shot text generation through the realtime SDK, normalized for callers
 * that need a simple prompt → string response.
 */
export async function generateText(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
}): Promise<string> {
  const ai = await getVoiceClient(opts.apiKey);
  const response = await ai.models.generateContent({
    model: opts.model,
    contents: (opts.systemPrompt ?? '') + '\n\n' + opts.prompt,
    config: { temperature: opts.temperature ?? 0.25 },
  });
  return (response?.text as string) ?? '';
}
