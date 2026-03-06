# Quick Start — Billit MCP

---

## 1. Get your Billit API key

1. Log in to [app.billit.be](https://app.billit.be)
2. Go to **Settings → API**
3. Copy your **API key** (UUID format)

---

## 2. Configure Claude

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/.claude.json`:

```json
{
  "mcpServers": {
    "billit": {
      "command": "npx",
      "args": ["-y", "@tailormade/billit-mcp"],
      "env": {
        "BILLIT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

> **Note:** `BILLIT_PARTY_ID` is optional. If not set, Claude will automatically call `billit_get_account_info` to discover your companies and choose the correct one based on context.

Restart Claude after saving.

---

## 3. Verify

In Claude, type:
```
Show my Billit companies
```

Claude will call `billit_get_account_info` and return your linked companies with their PartyIDs.

---

## 4. Try it

```
List my last 10 outgoing invoices in Billit
```

```
Create an invoice for ACME NV (BE0123456789), 1 hour consulting at €150 excl VAT 21%
```

```
Show my unpaid invoices
```

---

## Multi-company setup

If you have multiple Billit companies (e.g. a Belgian and a Spanish entity), Claude automatically picks the right one based on context. You can also specify explicitly:

```
List invoices for my Spanish company
```

Or pass `company_id` directly in tool calls.

| Company | PartyID |
|---------|---------|
| Your Company NV | from billit_get_account_info |
| Your Other Company SL | from billit_get_account_info |

---

## Build from source

```bash
git clone https://github.com/tailormade-eu/Tailormade.BillitMcp.git
cd Tailormade.BillitMcp
npm install
npm run build
```

Config:
```json
{
  "mcpServers": {
    "billit": {
      "command": "node",
      "args": ["C:\\ABSOLUTE\\PATH\\TO\\dist\\index.js"],
      "env": {
        "BILLIT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ApiKeyNotValid` | Check your API key in Billit → Settings → API |
| Tools not appearing | Use absolute path + restart Claude fully |
| Build errors | `rm -rf node_modules dist && npm install && npm run build` |
| Wrong company used | Pass `company_id` explicitly, or mention the company name in your prompt |
