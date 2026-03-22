import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BillitClient } from "../api/client.js";
import { companyId, respond, withLlmTip } from "./utils.js";

export function registerToProcessTools(server: McpServer, client: BillitClient) {
  server.tool(
    "billit_submit_for_processing",
    withLlmTip(
      "Submit a file (e.g. incoming invoice PDF) to Billit for automated processing. Billit will parse the document and create a corresponding order. Returns an uploadID that can be used to cancel. Use for processing incoming supplier invoices without manual data entry.",
      "file_base64 must be base64-encoded file content. Processing is async — Billit parses the document and creates an order in the background. Use billit_list_orders with direction='Cost' after processing to find the created order."
    ),
    {
      file_base64: z.string().describe("Base64-encoded file content of the document to process"),
      file_name: z.string().describe("File name including extension (e.g. 'supplier-invoice-001.pdf')"),
      content_type: z.string().optional().describe("MIME type (default: 'application/pdf'). Billit processes PDF and common image formats."),
      company_id: companyId,
    },
    async ({ file_base64, file_name, content_type, company_id }) => {
      const body: Record<string, unknown> = {
        FileBase64: file_base64, FileName: file_name, ContentType: content_type ?? "application/pdf",
      };
      const data = await client.request("POST", "/v1/toProcess", body, company_id);
      return respond(JSON.stringify(data, null, 2));
    },
  );

  server.tool(
    "billit_cancel_processing",
    "Cancel a pending processing upload. Use if a wrong file was submitted. Only works while the upload is still pending — cannot cancel already-processed documents.",
    {
      upload_id: z.string().describe("Upload ID returned by billit_submit_for_processing"),
      company_id: companyId,
    },
    async ({ upload_id, company_id }) => {
      const data = await client.request("DELETE", `/v1/toProcess/${upload_id}`, undefined, company_id);
      return respond(JSON.stringify(data ?? { success: true }, null, 2));
    },
  );
}
