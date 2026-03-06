# Deployment Guide — Billit MCP

---

## Prerequisites

- [ ] Node.js 20+
- [ ] Claude Desktop or Claude Code
- [ ] Billit account with API access enabled

---

## Step 1 — Get your API key

1. Log in to [app.billit.be](https://app.billit.be)
2. Go to **Settings → Integrations → API**
3. Copy your **API key** (UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

> If the API section is not visible, contact Billit support to enable API access for your account.

---

## Step 2 — Install

### Option A — npx (recommended)

No install needed. Config only:

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

### Option B — Build from source

```bash
git clone https://github.com/tailormade-eu/Tailormade.BillitMcp.git
cd Tailormade.BillitMcp
npm install
npm run build
```

Config (use absolute path):
```json
{
  "mcpServers": {
    "billit": {
      "command": "node",
      "args": ["C:\\Projects\\Tailormade.BillitMcp\\dist\\index.js"],
      "env": {
        "BILLIT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

---

## Step 3 — Configure Claude

### Claude Desktop (Windows)

File: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "billit": {
      "command": "npx",
      "args": ["-y", "@tailormade/billit-mcp"],
      "env": {
        "BILLIT_API_KEY": "paste-your-api-key-here"
      }
    }
  }
}
```

### Claude Code

File: `~/.claude.json` (in `mcpServers` section)

```json
"billit": {
  "command": "npx",
  "args": ["-y", "@tailormade/billit-mcp"],
  "env": {
    "BILLIT_API_KEY": "paste-your-api-key-here"
  }
}
```

### Optional environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BILLIT_API_KEY` | **Yes** | API key from Billit Settings → API |
| `BILLIT_PARTY_ID` | No | Lock to a specific company (PartyID). If not set, Claude auto-discovers. |
| `BILLIT_CONTEXT_PARTY_ID` | No | For accountants acting on behalf of a client company |

---

## Step 4 — Restart & Verify

1. Save the config file
2. **Fully restart** Claude Desktop (check system tray — close completely)
3. In Claude, type:

```
Show my Billit companies
```

Expected: list of your linked companies with PartyIDs.

---

## Multi-company setup

If you have multiple Billit companies, Claude automatically selects the right one based on conversation context. No extra config needed.

To lock to one company, set `BILLIT_PARTY_ID` to the desired PartyID:

```json
"env": {
  "BILLIT_API_KEY": "your-key",
  "BILLIT_PARTY_ID": "208029"
}
```

To find your PartyIDs: ask Claude to call `billit_get_account_info`.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `ApiKeyNotValid` | Wrong or invalid API key | Check Billit → Settings → API, regenerate if needed |
| Tools not appearing | Wrong path or config syntax | Check JSON syntax, use absolute path, restart fully |
| `Cannot find module` | Build failed or missing | Run `npm install && npm run build` |
| Wrong company selected | Multiple companies, no context | Pass `company_id` explicitly in tool call, or specify company in prompt |
| `401` on all calls | API key correct but PartyID=0 | Normal at startup — Claude will call `billit_get_account_info` automatically |

---

## Updates

```bash
cd C:\Projects\Tailormade.BillitMcp
git pull origin main
npm install
npm run build
```

Restart Claude after updating.

---

## Deployment checklist

- [ ] Node.js 20+ installed
- [ ] API key obtained from Billit
- [ ] Config file updated with API key
- [ ] Claude fully restarted
- [ ] `billit_get_account_info` returns company list
- [ ] Test query works (e.g. list recent invoices)
