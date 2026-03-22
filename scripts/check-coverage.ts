#!/usr/bin/env tsx
// check-coverage.ts — Tool quality checks for Billit MCP
//
// What it checks:
//   1. All registered tools have a non-empty description
//   2. All Zod params have .describe() for LLM readability
//
// What it does NOT check:
//   - Whether specific API endpoints are mapped to tools
//   - Whether tool implementations call the correct endpoints
//
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const indexMd = readFileSync(join(root, "docs/INDEX.md"), "utf-8");
const toolsDir = join(root, "src/tools");

// Extract endpoints from INDEX.md: `| \`/v1/...\` | METHOD | ... |`
const endpointRe = /\|\s*`(\/[^`]+)`\s*\|\s*([A-Z]+)\s*\|/g;
const endpoints: Array<{ method: string; path: string }> = [];
let m: RegExpExecArray | null;
while ((m = endpointRe.exec(indexMd)) !== null) {
  endpoints.push({ path: m[1], method: m[2] });
}

// Read all tool source files
const toolFiles = readdirSync(toolsDir).filter((f) => f.endsWith(".ts"));
const toolSources = toolFiles.map((f) => ({
  file: f,
  source: readFileSync(join(toolsDir, f), "utf-8"),
}));
const allSource = toolSources.map((t) => t.source).join("\n");

// Extract registered tool names
const toolNames = [...allSource.matchAll(/server\.tool\(\s*["']([^"']+)["']/g)].map((m) => m[1]);

// Check descriptions: each tool should have a non-empty description (2nd arg to server.tool)
const toolBlocks = [...allSource.matchAll(/server\.tool\(\s*["']([^"']+)["']\s*,\s*["']([^"']*)["']/g)];
const emptyDescs = toolBlocks.filter((m) => m[2].trim() === "").map((m) => m[1]);

// Check .describe() on z.* params — find param definitions missing .describe(
// Params may have .describe() on the same line or the next line
const sourceLines = allSource.split("\n");
const missingDescribe: string[] = [];
for (let i = 0; i < sourceLines.length; i++) {
  const line = sourceLines[i];
  const paramMatch = line.match(/^\s*([\w]+):\s*(z\.|coerceBool|companyId)/);
  if (!paramMatch) continue;
  // companyId has .describe() built into the shared schema — skip
  if (paramMatch[2] === "companyId") continue;
  // Check current line and next line for .describe(
  const twoLines = line + (sourceLines[i + 1] || "");
  if (!twoLines.includes(".describe(")) {
    missingDescribe.push(line.trim());
  }
}

// Report
let hasGaps = false;
console.log(`\n=== Billit MCP Coverage ===\n`);
console.log(`Endpoints in INDEX.md: ${endpoints.length}`);
console.log(`Tools registered:      ${toolNames.length}\n`);

// List tools per file
for (const { file, source } of toolSources) {
  const names = [...source.matchAll(/server\.tool\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
  if (names.length > 0) {
    console.log(`  ${file}: ${names.join(", ")}`);
  }
}

console.log("");

// Check empty descriptions
if (emptyDescs.length > 0) {
  hasGaps = true;
  for (const name of emptyDescs) {
    console.log(`❌ Tool "${name}" has empty description`);
  }
} else {
  console.log(`✅ All tools have non-empty descriptions`);
}

// Check .describe() on params
if (missingDescribe.length > 0) {
  hasGaps = true;
  console.log(`❌ ${missingDescribe.length} param(s) missing .describe():`);
  for (const m of missingDescribe) {
    console.log(`   ${m.trim()}`);
  }
} else {
  console.log(`✅ All params have .describe()`);
}

console.log("");

if (hasGaps) {
  console.log(`❌ Coverage check FAILED\n`);
  process.exit(1);
} else {
  console.log(`✅ Coverage check passed (${toolNames.length} tools, all descriptions and .describe() present)\n`);
}
