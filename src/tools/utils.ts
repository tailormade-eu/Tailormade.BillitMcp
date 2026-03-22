import { z } from "zod";

export function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Append an LLM tip to a tool description, separated by a horizontal rule.
 *  Keeps description focused on What/When/Output/Next while surfacing gotchas,
 *  spec-gaps, and ERROR→CAUSE→FIX in a clearly separated section. */
export function withLlmTip(description: string, tip: string): string {
  return `${description}\n\n---\n${tip}`;
}

export const coerceBool = z.union([z.boolean(), z.string().transform(v => v === "true")]).optional();

export const companyId = z.coerce.number().optional()
  .describe("Billit PartyID of the company to act as. If not set, uses BILLIT_PARTY_ID env. If env is 0, call billit_get_account_info first to discover available companies.");

/** Build OData query string from common list-tool params. Returns empty string if no params set. */
export function buildODataParams(opts: {
  filter?: string;
  search?: string;
  orderby?: string;
  top?: number;
  skip?: number;
}): string {
  const params = new URLSearchParams();
  if (opts.filter?.trim()) params.set("$filter", opts.filter);
  if (opts.search) params.set("fullTextSearch", opts.search);
  if (opts.orderby) params.set("$orderby", opts.orderby);
  if (opts.top !== undefined) params.set("$top", String(opts.top));
  if (opts.skip !== undefined) params.set("$skip", String(opts.skip));
  return params.toString();
}
