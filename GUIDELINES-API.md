# Billit MCP — API Tool Guidelines

## Tool pattern

Each tool category lives in `src/tools/{category}.ts` and exports `register{Category}Tools(server, client)`.

All tools follow this structure:

```typescript
server.tool(
  "billit_{action}_{resource}",
  "Description with what/when/output/next-steps + llmTip for API quirks",
  { /* zod schema */ },
  async ({ param1, param2 }) => {
    const data = await client.get("/v1/endpoint");
    return respond(JSON.stringify(data, null, 2));
  }
);
```

## Response helper

All tools return via `respond(text)`:

```typescript
const respond = (text: string) => ({ content: [{ type: "text" as const, text }] });
```

## OData filtering

- Build `$filter` string from individual params, join with ` and `
- Append to URL as query string: `/v1/orders?$filter=Direction eq 'Income'`
- Date format: `LastModified ge datetime'2026-01-01T00:00:00'`
- `fullTextSearch` is always a **separate query param**, never inside `$filter`

```typescript
const filters: string[] = [];
if (direction) filters.push(`Direction eq '${direction}'`);
if (modified_after) filters.push(`LastModified ge datetime'${modified_after}'`);

const params = new URLSearchParams();
if (filters.length) params.set("$filter", filters.join(" and "));
if (fullTextSearch) params.set("fullTextSearch", fullTextSearch);
```

## Pagination

Every list tool supports `$top` and `$skip`:

```typescript
z.object({
  top: z.number().optional().describe("Max results to return (default 20)"),
  skip: z.number().optional().describe("Number of results to skip for pagination"),
})
```

Passed as `$top` and `$skip` query params.

## Parameter validation

- Required params: `z.string()`, `z.number()`
- Optional params: `.optional()`
- Every param must have `.describe()` with format and constraints
- Complex nested objects (e.g. order lines): accept as JSON string, parse in handler

## Error handling

`BillitClient` throws `Error` with HTTP status code and response body. MCP tools don't catch — the error propagates and is returned as text to the LLM.

## File registration

Register each category in `src/index.ts` `main()`:

```typescript
import { registerOrdersTools } from "./tools/orders.js";
// ...
registerOrdersTools(server, client);
```
