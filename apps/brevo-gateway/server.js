import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const BREVO_URL = "https://api.brevo.com/v3";
const GATEWAY_KEY = process.env.GATEWAY_SHARED_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Garrison Market";
const REPLY_TO = process.env.BREVO_REPLY_TO || SENDER_EMAIL;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://gmstock.co";

if (!GATEWAY_KEY || !BREVO_API_KEY || !SENDER_EMAIL) {
  console.error("Missing required gateway environment variables.");
  process.exit(1);
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-headers": "content-type, x-garrison-gateway-key",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function brevo(path, init = {}) {
  const response = await fetch(BREVO_URL + path, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_API_KEY,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }

  if (!response.ok) {
    const message = body?.message || body?.code || "Brevo API request failed.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.url === "/health" && req.method === "GET") {
    return json(res, 200, { ok: true, service: "garrison-market-brevo-gateway" });
  }

  if (req.headers["x-garrison-gateway-key"] !== GATEWAY_KEY) {
    return json(res, 401, { error: "Unauthorized" });
  }

  try {
    const url = new URL(req.url, "http://gateway.local");

    if (req.method === "GET" && url.pathname === "/lists") {
      const data = await brevo("/contacts/lists?limit=50&offset=0&sort=desc");
      return json(res, 200, { lists: data?.lists || [] });
    }

    if (req.method === "GET" && url.pathname === "/folders") {
      const data = await brevo("/contacts/folders?limit=50&offset=0&sort=desc");
      return json(res, 200, { folders: data?.folders || [] });
    }

    if (req.method === "POST" && url.pathname === "/folders") {
      const body = await readBody(req);
      return json(res, 200, await brevo("/contacts/folders", {
        method: "POST", body: JSON.stringify({ name: String(body.name || "").trim() })
      }));
    }

    if (req.method === "POST" && url.pathname === "/lists") {
      const body = await readBody(req);
      return json(res, 200, await brevo("/contacts/lists", {
        method: "POST", body: JSON.stringify({ name: String(body.name || "").trim(), folderId: Number(body.folderId) })
      }));
    }

    if (req.method === "POST" && url.pathname === "/contacts") {
      const body = await readBody(req);
      const payload = {
        email: String(body.email || "").trim().toLowerCase(),
        attributes: body.attributes || {},
        listIds: [Number(body.listId || body.listIds?.[0])],
        updateEnabled: true,
      };
      return json(res, 200, await brevo("/contacts", { method: "POST", body: JSON.stringify(payload) }));
    }

    if (req.method === "GET" && url.pathname === "/campaigns") {
      const data = await brevo("/emailCampaigns?limit=20&offset=0&sort=desc");
      return json(res, 200, { campaigns: data?.campaigns || [] });
    }

    if (req.method === "POST" && url.pathname === "/campaigns") {
      const body = await readBody(req);
      const payload = {
        name: String(body.campaignName || "").trim(),
        subject: String(body.subject || "").trim(),
        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
        replyTo: REPLY_TO,
        previewText: body.previewText || undefined,
        type: "classic",
        htmlContent: String(body.htmlContent || ""),
        recipients: { listIds: [Number(body.listId)] },
      };
      return json(res, 200, await brevo("/emailCampaigns", { method: "POST", body: JSON.stringify(payload) }));
    }

    const sendMatch = url.pathname.match(/^\/campaigns\/(\d+)\/send$/);
    if (req.method === "POST" && sendMatch) {
      return json(res, 200, await brevo(`/emailCampaigns/${sendMatch[1]}/sendNow`, {
        method: "POST", body: "{}"
      }));
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("[brevo-gateway]", error);
    return json(res, Number(error.status) || 502, { error: error.message || "Gateway request failed." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Brevo gateway listening on :${PORT}`);
});
