import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";

function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function registerPeppolTools(server: McpServer, client: BillitClient) {
  // ── billit_peppol_list_inbox ────────────────────────────────────────
  server.tool(
    "billit_peppol_list_inbox",
    "List incoming Peppol messages (e-invoices received from suppliers via the Peppol network). Returns inbox items with inboxItemId, sender, document type, and date. Next steps: billit_peppol_confirm_inbox to accept, billit_peppol_refuse_inbox to reject.",
    {
      top: z.number().optional()
        .describe("Max results per page (default: 50)"),
      skip: z.number().optional()
        .describe("Items to skip for pagination (default: 0)"),
    },
    async ({ top, skip }) => {
      const params = new URLSearchParams();
      if (top) params.set("$top", String(top));
      if (skip) params.set("$skip", String(skip));

      const qs = params.toString();
      const data = await client.request("GET", `/v1/peppol/inbox${qs ? `?${qs}` : ""}`);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_peppol_confirm_inbox ─────────────────────────────────────
  server.tool(
    "billit_peppol_confirm_inbox",
    "Accept an incoming Peppol message. Marks the item as processed and accepted. Use after reviewing an incoming e-invoice.",
    {
      inbox_item_id: z.string()
        .describe("Inbox item ID from billit_peppol_list_inbox result"),
    },
    async ({ inbox_item_id }) => {
      const data = await client.request("POST", `/v1/peppol/inbox/${inbox_item_id}/confirm`);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  // ── billit_peppol_refuse_inbox ──────────────────────────────────────
  server.tool(
    "billit_peppol_refuse_inbox",
    "Refuse/reject an incoming Peppol message. Use when an incoming e-invoice is incorrect or unexpected.",
    {
      inbox_item_id: z.string()
        .describe("Inbox item ID from billit_peppol_list_inbox result"),
    },
    async ({ inbox_item_id }) => {
      const data = await client.request("POST", `/v1/peppol/inbox/${inbox_item_id}/refuse`);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  // ── billit_peppol_send_order ────────────────────────────────────────
  server.tool(
    "billit_peppol_send_order",
    "Send a specific order directly via the Peppol e-invoicing network. Use billit_peppol_lookup_participant first to verify the customer is a Peppol participant. Prerequisites: order must be confirmed (ApprovalStatus=approved).\n\nCRITICAL: The customer must be registered on Peppol before you can send. Use billit_peppol_lookup_participant with their VAT/CBE number first. If they are not on Peppol, use billit_send_order (which falls back to email) instead.",
    {
      order_id: z.number()
        .describe("Numeric order ID to send via Peppol"),
    },
    async ({ order_id }) => {
      const data = await client.request("POST", "/v1/peppol/sendOrder", { OrderID: order_id });
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  // ── billit_peppol_lookup_participant ─────────────────────────────────
  server.tool(
    "billit_peppol_lookup_participant",
    "Check if a company is registered as a Peppol participant. Returns participant information including endpoint and supported document types. Use before billit_peppol_send_order to verify the customer is reachable.",
    {
      vat_or_cbe: z.string()
        .describe("Company VAT number (e.g. BE0123456789) or CBE/KBO enterprise number to look up on Peppol"),
    },
    async ({ vat_or_cbe }) => {
      const data = await client.request("GET", `/v1/peppol/participantInformation/${vat_or_cbe}`);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_peppol_register ──────────────────────────────────────────
  server.tool(
    "billit_peppol_register",
    "Register the current Billit party as a Peppol participant. Enables receiving e-invoices via Peppol and sending outgoing invoices via the network. One-time setup operation.",
    {},
    async () => {
      const data = await client.request("POST", "/v1/peppol/participants");
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  // ── billit_peppol_unregister ────────────────────────────────────────
  server.tool(
    "billit_peppol_unregister",
    "Unregister the current Billit party from the Peppol network. After this, the party can no longer receive or send via Peppol. Use with caution.\n\nWARNING: Unregistering from Peppol is immediate and affects all incoming e-invoices. Confirm with the user before calling this.",
    {},
    async () => {
      const data = await client.request("DELETE", "/v1/peppol/participants");
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );
}
