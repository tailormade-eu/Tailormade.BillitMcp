import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";

function respond(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const companyId = z.number().optional()
  .describe("Billit PartyID of the company to act as. If not set, uses BILLIT_PARTY_ID env. If env is 0, call billit_get_account_info first to discover available companies.");

export function registerDocumentTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_list_documents",
    "List documents stored in Billit. Returns document metadata including DocumentID, FileName, and associated order. Supports OData $filter, $orderby, full-text search.\n\nEXAMPLES:\n- orderby='CreationDate desc'\n- filter=\"OrderID eq 12345\"",
    {
      filter: z.string().optional().describe("OData $filter expression. Examples: \"OrderID eq 12345\", \"FileName eq 'invoice.pdf'\""),
      orderby: z.string().optional().describe("OData $orderby expression. Examples: 'CreationDate desc', 'FileName asc'"),
      search: z.string().optional().describe("Full-text search on document name or content. Sent as 'fullTextSearch' query param."),
      top: z.number().optional().describe("Max results per page (max: 120)"),
      skip: z.number().optional().describe("Items to skip for pagination (default: 0)"),
      company_id: companyId,
    },
    async ({ filter, orderby, search, top, skip, company_id }) => {
      const params = new URLSearchParams();
      if (filter) params.set("$filter", filter);
      if (orderby) params.set("$orderby", orderby);
      if (search) params.set("fullTextSearch", search);
      if (top) params.set("$top", String(top));
      if (skip) params.set("$skip", String(skip));
      const qs = params.toString();
      const data = await client.request("GET", `/v1/documents${qs ? `?${qs}` : ""}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_get_document",
    "Get metadata and content of a specific document. Returns document details including a fileID (UUID) that can be used with billit_download_file to get the actual file content.",
    {
      document_id: z.number().describe("Numeric document ID from billit_list_documents result"),
      company_id: companyId,
    },
    async ({ document_id, company_id }) => {
      const data = await client.request("GET", `/v1/documents/${document_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_upload_document",
    "Upload a document to Billit (e.g. an incoming invoice PDF for processing). Returns the created DocumentID. Next step: billit_submit_for_processing to have Billit parse the document.\n\nNOTE: file_base64 must be a base64-encoded string of the file content. EXAMPLE: for a PDF, encode the raw bytes as base64. Max file size depends on Billit account settings.",
    {
      file_base64: z.string().describe("Base64-encoded file content"),
      file_name: z.string().describe("File name including extension (e.g. 'invoice-2026-001.pdf')"),
      content_type: z.string().optional().describe("MIME type (default: 'application/pdf'). Other common values: 'image/jpeg', 'image/png'"),
      company_id: companyId,
    },
    async ({ file_base64, file_name, content_type, company_id }) => {
      const body: Record<string, unknown> = {
        FileBase64: file_base64, FileName: file_name, ContentType: content_type ?? "application/pdf",
      };
      const data = await client.request("POST", "/v1/documents", body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_download_file",
    "Download a file by its UUID. File UUIDs are found in order responses (PDF of the invoice), document responses, or accountant feed items. Returns base64-encoded file content.\n\nCRITICAL: This endpoint uses a UUID (string like 'a1b2c3d4-...'), NOT a numeric ID. The fileID comes from order/document response fields, not from the DocumentID. Do not confuse DocumentID (numeric) with fileID (UUID).",
    {
      file_id: z.string().describe("File UUID (e.g. 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'). Found in order or document response fields. This is NOT the numeric DocumentID."),
      company_id: companyId,
    },
    async ({ file_id, company_id }) => {
      const data = await client.request("GET", `/v1/files/${file_id}`, undefined, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );
}
