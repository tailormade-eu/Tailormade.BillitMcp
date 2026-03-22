import { z } from "zod";

export function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Append an llmTip block to a tool description. Keeps description focused on
 *  What/When/Output/Next while surfacing gotchas, spec-gaps, and ERROR→CAUSE→FIX
 *  in a clearly separated section the LLM reads but users rarely see. */
export function withLlmTip(description: string, tip: string): string {
  return `${description}\n\n<llmTip>\n${tip}\n</llmTip>`;
}

export const companyId = z.coerce.number().optional()
  .describe("Billit PartyID of the company to act as. If not set, uses BILLIT_PARTY_ID env. If env is 0, call billit_get_account_info first to discover available companies.");
