import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";
import { buildODataParams, coerceBool, companyId, respond, withLlmTip } from "./utils.js";

export function registerPeppolTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_peppol_list_inbox",
    "List incoming Peppol messages (e-invoices received from suppliers via the Peppol network). Returns inbox items with inboxItemId, sender, document type, and date. Supports OData $orderby. Next steps: billit_peppol_confirm_inbox to accept, billit_peppol_refuse_inbox to reject.",
    {
      orderby: z.string().optional().describe("OData $orderby expression. Example: 'ReceivedDate desc'"),
      top: z.coerce.number().optional().describe("Max results per page (max: 120)"),
      skip: z.coerce.number().optional().describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ orderby, top, skip, company_id }) => {
      const qs = buildODataParams({ orderby, top, skip });
      const data = await client.request("GET", `/v1/peppol/inbox${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_peppol_confirm_inbox",
    "Accept an incoming Peppol message. Marks the item as processed and accepted. Use after reviewing an incoming e-invoice.",
    {
      inbox_item_id: z.string().describe("Inbox item ID from billit_peppol_list_inbox result"),
      company_id: companyId,
    },
    async ({ inbox_item_id, company_id }) => {
      const data = await client.request("POST", `/v1/peppol/inbox/${inbox_item_id}/confirm`, undefined, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  server.tool(
    "billit_peppol_refuse_inbox",
    "Refuse/reject an incoming Peppol message. Use when an incoming e-invoice is incorrect or unexpected.",
    {
      inbox_item_id: z.string().describe("Inbox item ID from billit_peppol_list_inbox result"),
      company_id: companyId,
    },
    async ({ inbox_item_id, company_id }) => {
      const data = await client.request("POST", `/v1/peppol/inbox/${inbox_item_id}/refuse`, undefined, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  server.tool(
    "billit_peppol_send_order",
    withLlmTip(
      "Send a specific order directly via the Peppol e-invoicing network. Use billit_peppol_lookup_participant first to verify the customer is a Peppol participant. Prerequisites: order must be confirmed (ApprovalStatus=approved).",
      "ERROR: Peppol send fails → CAUSE: customer not registered on Peppol → FIX: call billit_peppol_lookup_participant with their VAT/CBE number first. If not on Peppol, use billit_send_order (falls back to email) instead."
    ),
    {
      order_id: z.coerce.number().describe("Numeric order ID to send via Peppol"),
      company_id: companyId,
    },
    async ({ order_id, company_id }) => {
      const data = await client.request("POST", "/v1/peppol/sendOrder", { OrderID: order_id }, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  server.tool(
    "billit_peppol_lookup_participant",
    "Check if a company is registered as a Peppol participant. Returns participant information including endpoint and supported document types. Use before billit_peppol_send_order to verify the customer is reachable.",
    {
      vat_or_cbe: z.string().describe("Company VAT number (e.g. BE0123456789) or CBE/KBO enterprise number to look up on Peppol"),
      company_id: companyId,
    },
    async ({ vat_or_cbe, company_id }) => {
      const data = await client.request("GET", `/v1/peppol/participantInformation/${vat_or_cbe}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_peppol_register",
    "Register the current Billit party as a Peppol participant. Enables receiving e-invoices via Peppol and sending outgoing invoices via the network. One-time setup operation.",
    { company_id: companyId },
    async ({ company_id }) => {
      const data = await client.request("POST", "/v1/peppol/participants", undefined, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  server.tool(
    "billit_peppol_unregister",
    withLlmTip(
      "Unregister the current Billit party from the Peppol network. After this, the party can no longer receive or send via Peppol. Use with caution. Supports dry_run=true to preview without making changes.",
      "Unregistering from Peppol is immediate and affects all incoming e-invoices. Always confirm with the user before calling this."
    ),
    {
      company_id: companyId,
      dry_run: coerceBool
        .describe("If true, returns what would happen without actually unregistering. Default: false."),
    },
    async ({ company_id, dry_run }) => {
      if (dry_run) {
        return respond("Dry run: would unregister party from Peppol. No changes made.");
      }
      const data = await client.request("DELETE", "/v1/peppol/participants", undefined, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );
}
