import { z } from "zod";

export function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export const companyId = z.coerce.number().optional()
  .describe("Billit PartyID of the company to act as. If not set, uses BILLIT_PARTY_ID env. If env is 0, call billit_get_account_info first to discover available companies.");
