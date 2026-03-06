import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";

function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const companyId = z.number().optional()
  .describe("Billit PartyID of the company to act as. If not set, uses BILLIT_PARTY_ID env. If env is 0, call billit_get_account_info first to discover available companies.");

export function registerFinancialTools(server: McpServer, client: BillitClient) {
  // ── billit_get_account_info ───────────────────────────────────────
  server.tool(
    "billit_get_account_info",
    "Get account and company information for the authenticated Billit API key. Returns a Companies array with PartyID, Name, VATNumber, and other details for each company associated with the API key.\n\nSTARTUP PROTOCOL: If BILLIT_PARTY_ID env is 0 or unknown, call this tool FIRST before any other Billit tool. Store the Companies array in memory (name → PartyID mapping). Then choose the correct company_id for all subsequent Billit tool calls based on conversation context.\n\nEXAMPLE: after calling this, you know 'JaRa Productions bv' = PartyID 208029 and 'TAILORMADE 2018,SL' = PartyID 663845. When user asks about invoices for JaRa, pass company_id=208029 to billit_list_orders.",
    {},
    async () => {
      const data = await client.request("GET", "/v1/account/accountInformation");
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_search_company ─────────────────────────────────────────
  server.tool(
    "billit_search_company",
    "Search for a Belgian company by name or VAT/KBO number in the official company database. Returns official company name, address, and enterprise number. Use before billit_create_party to auto-fill correct company data.\n\nEXAMPLE: billit_search_company with keywords='BE0123456789' or keywords='Acme NV' returns official KBO data. Use this to avoid typos when creating parties.",
    {
      keywords: z.string()
        .describe("Company name, VAT number (BE0123456789), or KBO enterprise number to search"),
    },
    async ({ keywords }) => {
      const data = await client.request("GET", `/v1/misc/companysearch/${encodeURIComponent(keywords)}`);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_list_typecodes ─────────────────────────────────────────
  server.tool(
    "billit_list_typecodes",
    "List valid type codes for a given category. Use to get valid values for VAT rates, units of measure, languages, etc.\n\nEXAMPLE type code types: 'VATRate' for VAT percentages, 'Unit' for units of measure, 'Language' for supported languages.",
    {
      type_code_type: z.string()
        .describe("Type code category to list (e.g. 'VATRate', 'Unit', 'Language', 'Currency')"),
    },
    async ({ type_code_type }) => {
      const data = await client.request("GET", `/v1/misc/typecodes/${encodeURIComponent(type_code_type)}`);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_list_financial_transactions ─────────────────────────────
  server.tool(
    "billit_list_financial_transactions",
    "List financial transactions in Billit (bank transactions, payments). Use to reconcile payments with orders. Supports full-text search, OData $filter and $orderby.\n\nEXAMPLES:\n- Recent first: orderby='ValueDate desc'\n- Date range: filter=\"ValueDate ge datetime'2026-01-01T00:00:00' and ValueDate le datetime'2026-03-31T23:59:59'\"\n- By counterparty: filter=\"NameCounterParty eq 'Mehmet'\"\n- Combined: orderby='ValueDate desc', filter=\"ValueDate ge datetime'2026-01-01T00:00:00'\"\n\nNOTE: max page size is 120. Date filter requires datetime'' syntax.",
    {
      search: z.string().optional()
        .describe("Full-text search on transaction description, reference, or amount"),
      filter: z.string().optional()
        .describe("OData $filter expression. Date syntax requires datetime'': \"ValueDate ge datetime'2026-01-01T00:00:00'\". Other examples: \"NameCounterParty eq 'Mehmet Eryilmaz'\", \"TotalAmount ge 500\""),
      orderby: z.string().optional()
        .describe("OData $orderby expression. Examples: 'ValueDate desc', 'TotalAmount desc', 'ValueDate asc'"),
      top: z.number().optional()
        .describe("Max results per page (max: 120)"),
      skip: z.number().optional()
        .describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ search, filter, orderby, top, skip, company_id }) => {
      const params = new URLSearchParams();
      if (search) params.set("fullTextSearch", search);
      if (filter) params.set("$filter", filter);
      if (orderby) params.set("$orderby", orderby);
      if (top) params.set("$top", String(top));
      if (skip) params.set("$skip", String(skip));
      const qs = params.toString();
      const data = await client.request("GET", `/v1/financialTransactions${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_import_financial_transactions ───────────────────────────
  server.tool(
    "billit_import_financial_transactions",
    "Import bank transactions from a CODA or MT940 bank statement file. Use to bulk-import bank transactions for payment reconciliation.\n\nNOTE: Supported formats are CODA (Belgian bank format) and MT940 (SWIFT bank format). file_base64 must be base64-encoded file content.",
    {
      file_base64: z.string()
        .describe("Base64-encoded CODA or MT940 bank statement file content"),
      file_name: z.string()
        .describe("File name (e.g. 'statement-2026-01.coda' or 'statement.mt940')"),
      content_type: z.string()
        .describe("MIME type of the file"),
      company_id: companyId,
    },
    async ({ file_base64, file_name, content_type, company_id }) => {
      const body = { FileBase64: file_base64, FileName: file_name, ContentType: content_type };
      const data = await client.request("POST", "/v1/financialTransactions/commands/import", body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_list_reports ───────────────────────────────────────────
  server.tool(
    "billit_list_reports",
    "List available reports in Billit (VAT reports, sales reports, etc.). Returns report metadata. Use billit_get_report to retrieve the actual report data.",
    {
      top: z.number().optional()
        .describe("Max results per page (default: 50)"),
      skip: z.number().optional()
        .describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ top, skip, company_id }) => {
      const params = new URLSearchParams();
      if (top) params.set("$top", String(top));
      if (skip) params.set("$skip", String(skip));
      const qs = params.toString();
      const data = await client.request("GET", `/v1/reports${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_get_report ─────────────────────────────────────────────
  server.tool(
    "billit_get_report",
    "Get the data of a specific Billit report. Use billit_list_reports to find report IDs.",
    {
      report_id: z.number()
        .describe("Numeric report ID from billit_list_reports result"),
      company_id: companyId,
    },
    async ({ report_id, company_id }) => {
      const data = await client.request("GET", `/v1/reports/${report_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_list_accountant_feeds ──────────────────────────────────
  server.tool(
    "billit_list_accountant_feeds",
    "List all accountant feeds and their pending items. Feeds contain newly exported orders and documents for accountant processing. Poll at most once per minute. Next steps: billit_download_accountant_file to download items, billit_confirm_accountant_feed to confirm processed items.\n\nWARNING: Do not poll more than once per minute — this is a rate-limited endpoint. After downloading feed items, always confirm them with billit_confirm_accountant_feed to remove them from the feed.",
    { company_id: companyId },
    async ({ company_id }) => {
      const data = await client.request("GET", "/v1/accountant/feeds", undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  // ── billit_register_accountant_feed ───────────────────────────────
  server.tool(
    "billit_register_accountant_feed",
    "Register a new accountant feed. All newly exported orders and documents will appear in this feed for the accountant to download. One-time setup per accountant integration.",
    { company_id: companyId },
    async ({ company_id }) => {
      const data = await client.request("POST", "/v1/accountant/feeds", undefined, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  // ── billit_confirm_accountant_feed ────────────────────────────────
  server.tool(
    "billit_confirm_accountant_feed",
    "Confirm that feed items have been successfully downloaded. This removes them from the feed list. Always call this after processing items from billit_list_accountant_feeds.\n\nCRITICAL: Always confirm downloaded items — without confirmation, the same items will reappear on the next poll. Pass the feed item IDs from the billit_list_accountant_feeds response.",
    {
      feed_item_ids: z.array(z.string())
        .describe("Array of feed item ID strings to confirm as downloaded. Get these from billit_list_accountant_feeds response."),
      company_id: companyId,
    },
    async ({ feed_item_ids, company_id }) => {
      const data = await client.request("POST", "/v1/accountant/feeds/confirm", { FeedItemIds: feed_item_ids }, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );

  // ── billit_download_accountant_file ───────────────────────────────
  server.tool(
    "billit_download_accountant_file",
    "Download a file from an accountant feed (e.g. a CODA file or exported invoice). Returns base64-encoded file content.",
    {
      file_id: z.string()
        .describe("File ID from an accountant feed item"),
      company_id: companyId,
    },
    async ({ file_id, company_id }) => {
      const data = await client.request("GET", `/v1/accountant/files/${file_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );
}
