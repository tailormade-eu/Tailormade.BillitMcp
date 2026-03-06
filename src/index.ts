#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BillitClient } from "./api/client.js";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const apiKey = getRequiredEnv("BILLIT_API_KEY");
  const partyId = parseInt(getRequiredEnv("BILLIT_PARTY_ID"), 10);
  const contextPartyId = process.env["BILLIT_CONTEXT_PARTY_ID"]
    ? parseInt(process.env["BILLIT_CONTEXT_PARTY_ID"], 10)
    : undefined;

  const client = new BillitClient({ apiKey, partyId, contextPartyId });

  const server = new McpServer({ name: "billit-mcp", version: "1.0.0" });

  // Tools worden geregistreerd in volgende taken

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => { console.error(err); process.exit(1); });
