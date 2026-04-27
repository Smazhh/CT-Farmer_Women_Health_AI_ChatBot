const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");

const { Chatbot } = require("./chatbot");

const ROOT = path.resolve(__dirname, "..");
const STATIC_DIR = path.join(ROOT, "app", "static");
const STATIC_DIR_RESOLVED = path.resolve(STATIC_DIR);

const chatbot = new Chatbot();

function send(res, statusCode, body, headers = {}) {
  const isBuffer = Buffer.isBuffer(body);
  const payload = isBuffer ? body : Buffer.from(String(body));
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Length": payload.length,
    ...headers,
  });
  res.end(payload);
}

function sendJson(res, statusCode, obj) {
  send(res, statusCode, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function safeStaticPath(urlPath) {
  const rel = urlPath.replace(/^\/static\/?/, "");
  const abs = path.resolve(STATIC_DIR_RESOLVED, rel);
  const basePrefix = STATIC_DIR_RESOLVED.endsWith(path.sep) ? STATIC_DIR_RESOLVED : STATIC_DIR_RESOLVED + path.sep;
  if (!abs.startsWith(basePrefix)) return null;
  return abs;
}

async function readJsonBody(req, limitBytes = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new Error("Payload too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/api/health") {
      return sendJson(res, 200, { status: "ok" });
    }

    if (req.method === "POST" && pathname === "/api/chat") {
      const payload = await readJsonBody(req);
      const message = String(payload.message ?? "").trim();
      const language = payload.language === "hi" ? "hi" : "en";
      const sessionId = String(payload.session_id || payload.sessionId || "").trim() || randomUUID().replace(/-/g, "");

      if (!message) return sendJson(res, 400, { error: "Message cannot be empty." });
      if (message.length > 2000) return sendJson(res, 400, { error: "Message too long." });

      const result = chatbot.reply({ message, language, sessionId });

      return sendJson(res, 200, {
        session_id: sessionId,
        reply: result.reply,
        quick_replies: result.quickReplies || [],
        meta: result.meta || {},
      });
    }

    if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      const filePath = path.join(STATIC_DIR, "index.html");
      const body = fs.readFileSync(filePath);
      return send(res, 200, body, { "Content-Type": contentTypeFor(filePath) });
    }

    if (req.method === "GET" && pathname.startsWith("/static/")) {
      const filePath = safeStaticPath(pathname);
      if (!filePath) return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      }
      const body = fs.readFileSync(filePath);
      return send(res, 200, body, { "Content-Type": contentTypeFor(filePath) });
    }

    return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  } catch (err) {
    return sendJson(res, 500, { error: "Server error", detail: String(err?.message || err) });
  }
});

const PORT = Number(process.env.PORT || "8000");
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Women Farmer Health Chatbot running on http://127.0.0.1:${PORT}`);
});
