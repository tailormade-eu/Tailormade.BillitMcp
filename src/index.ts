#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BillitClient } from "./api/client.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerPartyTools } from "./tools/parties.js";
import { registerProductTools } from "./tools/products.js";
import { registerPeppolTools } from "./tools/peppol.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerFinancialTools } from "./tools/financial.js";
import { registerToProcessTools } from "./tools/toprocess.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const apiKey = getRequiredEnv("BILLIT_API_KEY");
  const partyId = process.env["BILLIT_PARTY_ID"] ? parseInt(process.env["BILLIT_PARTY_ID"], 10) : 0;
  const contextPartyId = process.env["BILLIT_CONTEXT_PARTY_ID"]
    ? parseInt(process.env["BILLIT_CONTEXT_PARTY_ID"], 10)
    : undefined;

  const client = new BillitClient({ apiKey, partyId, contextPartyId });

  const server = new McpServer({ name: "billit-mcp", version: "1.0.0" });

  registerOrderTools(server, client);
  registerPartyTools(server, client);
  registerProductTools(server, client);
  registerPeppolTools(server, client);
  registerDocumentTools(server, client);
  registerFinancialTools(server, client);
  registerToProcessTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => { console.error(err); process.exit(1); });
