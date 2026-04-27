# Women Farmer AI Health Assistant (Basic Chatbot)

A simple, text-based health chatbot concept for **women farmers**, aligned with **SDG 3 (Good Health & Well‑Being)**.

## What it does

- **Instant basic health guidance** (rule-based; works without an LLM)
- **Local language support**: English + हिन्दी
- **Simple chat UI** (mobile-friendly)
- **Private by design**: no chat history is written to disk

> Important: This is general information and **not** a substitute for a clinician. If you think it’s an emergency, call your local emergency number (India: 112, US: 911).

## Run (Node.js)

Requirements: Node.js 18+.

```powershell
node .\server\server.js
```

Or:

```powershell
npm.cmd start
```

Then open:

- http://127.0.0.1:8000

To change the port:

```powershell
$env:PORT=3000; node .\server\server.js
```

## API (local)

- `GET /api/health` → `{ "status": "ok" }`
- `POST /api/chat` body:
  - `message` (string)
  - `language` (`"en"` or `"hi"`)
  - `session_id` (optional string)

## Files to customize

- `D:\women_farmer_chatbot\server\chatbot.js` — topics, keywords, quick replies, and responses
- `D:\women_farmer_chatbot\app\static\app.js` — UI text (English/Hindi)
- `D:\women_farmer_chatbot\app\static\styles.css` — UI styling

## Add another language (basic)

1. Add UI strings in `D:\women_farmer_chatbot\app\static\app.js` (the `i18n` object)
2. Add chatbot replies/actions in `D:\women_farmer_chatbot\server\chatbot.js`

## (Optional) Run with Python/FastAPI

If you prefer Python, there is also a FastAPI server at `D:\women_farmer_chatbot\app\main.py`, which serves the same UI from `D:\women_farmer_chatbot\app\static`.
