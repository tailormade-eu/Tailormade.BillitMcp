import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";
import { buildODataParams, coerceBool, companyId, respond, withLlmTip } from "./utils.js";

export function registerProductTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_list_products",
    "List products/services in the Billit product catalog. Returns ProductID, Description, Reference, UnitPrice, VATPercentage, Unit. Supports OData $filter, $orderby, full-text search. Next step: billit_create_order using product descriptions and prices.\n\nEXAMPLES:\n- orderby='Description asc'\n- filter=\"VATPercentage eq 21\"",
    {
      filter: z.string().optional().describe("OData $filter expression. Examples: \"VATPercentage eq 21\", \"Reference eq 'SKU-001'\""),
      orderby: z.string().optional().describe("OData $orderby expression. Examples: 'Description asc', 'UnitPrice desc'"),
      search: z.string().optional().describe("Full-text search on product description or reference code. Sent as 'fullTextSearch' query param."),
      top: z.coerce.number().optional().describe("Max results per page (max: 120)"),
      skip: z.coerce.number().optional().describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ filter, orderby, search, top, skip, company_id }) => {
      const qs = buildODataParams({ filter, search, orderby, top, skip });
      const data = await client.request("GET", `/v1/products${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_get_product",
    "Get full details of a single product including price, VAT percentage, and unit. Use ProductID from billit_list_products.",
    {
      product_id: z.coerce.number().describe("Numeric product ID from billit_list_products result"),
      company_id: companyId,
    },
    async ({ product_id, company_id }) => {
      const data = await client.request("GET", `/v1/products/${product_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_create_product",
    withLlmTip(
      "Create a new product in the Billit catalog, or update an existing product if one with the same reference already exists. Use to maintain a reusable product list for order lines.",
      "If a product with the same 'reference' already exists, this acts as an upsert (update). Use a unique reference code to distinguish products."
    ),
    {
      description: z.string().describe("Product or service description (required)"),
      reference: z.string().optional().describe("Unique product reference/SKU code. If a product with this reference exists, it will be updated."),
      unit_price: z.coerce.number().optional().describe("Default unit price (excl. VAT) as decimal"),
      vat_percentage: z.coerce.number().optional().describe("VAT percentage as number (e.g. 21 for 21%, 0 for VAT exempt)"),
      unit: z.string().optional().describe("Unit of measure (e.g. 'piece', 'hour', 'kg')"),
      dry_run: coerceBool.describe("When true, validates input and returns what would be created without calling the API (default: false)"),
      company_id: companyId,
    },
    async ({ description, reference, unit_price, vat_percentage, unit, dry_run, company_id }) => {
      const body: Record<string, unknown> = { Description: description };
      if (reference !== undefined) body.Reference = reference;
      if (unit_price !== undefined) body.UnitPrice = unit_price;
      if (vat_percentage !== undefined) body.VATPercentage = vat_percentage;
      if (unit !== undefined) body.Unit = unit;
      if (dry_run) {
        return respond(`Dry run: would create product '${description}'${reference ? ` (ref: ${reference})` : ""}. No changes made.`);
      }
      const data = await client.request("POST", "/v1/products", body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );
}
