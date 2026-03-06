import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";

function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const companyId = z.number().optional()
  .describe("Billit PartyID of the company to act as. If not set, uses BILLIT_PARTY_ID env. If env is 0, call billit_get_account_info first to discover available companies.");

export function registerProductTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_list_products",
    "List products/services in the Billit product catalog. Returns ProductID, Description, Reference, UnitPrice, VATPercentage, Unit. Use to find products before adding them as order lines. Next step: billit_create_order using product descriptions and prices.",
    {
      search: z.string().optional().describe("Full-text search on product description or reference code. Sent as 'fullTextSearch' query param."),
      top: z.number().optional().describe("Max results per page (default: 50)"),
      skip: z.number().optional().describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ search, top, skip, company_id }) => {
      const params = new URLSearchParams();
      if (search) params.set("fullTextSearch", search);
      if (top) params.set("$top", String(top));
      if (skip) params.set("$skip", String(skip));
      const qs = params.toString();
      const data = await client.request("GET", `/v1/products${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_get_product",
    "Get full details of a single product including price, VAT percentage, and unit. Use ProductID from billit_list_products.",
    {
      product_id: z.number().describe("Numeric product ID from billit_list_products result"),
      company_id: companyId,
    },
    async ({ product_id, company_id }) => {
      const data = await client.request("GET", `/v1/products/${product_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_create_product",
    "Create a new product in the Billit catalog, or update an existing product if one with the same reference already exists. Use to maintain a reusable product list for order lines.\n\nNOTE: If a product with the same 'reference' already exists, this acts as an upsert (update). Use a unique reference code to distinguish products.",
    {
      description: z.string().describe("Product or service description (required)"),
      reference: z.string().optional().describe("Unique product reference/SKU code. If a product with this reference exists, it will be updated."),
      unit_price: z.number().optional().describe("Default unit price (excl. VAT) as decimal"),
      vat_percentage: z.number().optional().describe("VAT percentage as number (e.g. 21 for 21%, 0 for VAT exempt)"),
      unit: z.string().optional().describe("Unit of measure (e.g. 'piece', 'hour', 'kg')"),
      company_id: companyId,
    },
    async ({ description, reference, unit_price, vat_percentage, unit, company_id }) => {
      const body: Record<string, unknown> = { Description: description };
      if (reference !== undefined) body.Reference = reference;
      if (unit_price !== undefined) body.UnitPrice = unit_price;
      if (vat_percentage !== undefined) body.VATPercentage = vat_percentage;
      if (unit !== undefined) body.Unit = unit;
      const data = await client.request("POST", "/v1/products", body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );
}
