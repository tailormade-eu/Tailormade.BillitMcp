#!/usr/bin/env node
import { readFileSync } from "fs";
import { join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
import { BillitClient } from "./api/client.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerPartyTools } from "./tools/parties.js";
import { registerProductTools } from "./tools/products.js";
import { registerPeppolTools } from "./tools/peppol.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerFinancialTools } from "./tools/financial.js";
import { registerToProcessTools } from "./tools/toprocess.js";
import { registerWorkflowTools } from "./tools/workflows.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const apiKey = getRequiredEnv("BILLIT_API_KEY");
  const rawPartyId = parseInt(process.env["BILLIT_PARTY_ID"] ?? "", 10);
  if (process.env["BILLIT_PARTY_ID"] && Number.isNaN(rawPartyId)) {
    console.error(`Warning: BILLIT_PARTY_ID="${process.env["BILLIT_PARTY_ID"]}" is not a valid number, falling back to 0`);
  }
  const partyId = Number.isNaN(rawPartyId) ? 0 : rawPartyId;

  const rawContextPartyId = parseInt(process.env["BILLIT_CONTEXT_PARTY_ID"] ?? "", 10);
  if (process.env["BILLIT_CONTEXT_PARTY_ID"] && Number.isNaN(rawContextPartyId)) {
    console.error(`Warning: BILLIT_CONTEXT_PARTY_ID="${process.env["BILLIT_CONTEXT_PARTY_ID"]}" is not a valid number, ignoring`);
  }
  const contextPartyId = Number.isNaN(rawContextPartyId) ? undefined : rawContextPartyId;

  const client = new BillitClient({ apiKey, partyId, contextPartyId });

  const server = new McpServer({ name: "billit-mcp", version: pkg.version });

  registerOrderTools(server, client);
  registerPartyTools(server, client);
  registerProductTools(server, client);
  registerPeppolTools(server, client);
  registerDocumentTools(server, client);
  registerFinancialTools(server, client);
  registerToProcessTools(server, client);
  registerWorkflowTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

main().catch((err) => { console.error(err); process.exit(1); });
