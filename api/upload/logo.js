// POST /api/upload/logo
// Accepts: multipart/form-data with file field "logo" OR JSON { data: "<base64>", mime: "image/png" }
// Returns: { url: "https://..." }
// Auth: requires Bearer INTERNAL_API_SECRET

const { put } = require("@vercel/blob");
const { setCors } = require("../_lib/validate");
const crypto = require("crypto");

const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 150_000; // 150 KB

function timingSafeCompare(a, b) {
  try {
    const ba = Buffer.from(a), bb = Buffer.from(b);
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  } catch { return false; }
}

function requireAuth(req, res) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) { res.status(503).json({ error: "auth_not_configured" }); return false; }
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!timingSafeCompare(token, secret)) { res.status(401).json({ error: "unauthorized" }); return false; }
  return true;
}

// Parse base64 body: { data: "data:image/png;base64,...", mime?: "image/png" }
function parseBase64Body(body) {
  const raw = (body && body.data) ? String(body.data) : "";
  if (!raw) return null;
  const match = raw.match(/^data:([a-zA-Z0-9/+]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  if (!ALLOWED_MIMES.has(mime)) return null;
  const buf = Buffer.from(match[2], "base64");
  if (buf.length > MAX_BYTES) return null;
  return { buf, mime };
}

// Parse multipart (Vercel parses it automatically as req.body for multipart)
// But for Vercel serverless, multipart comes as raw body — use busboy or manual parsing.
// Simpler: use base64 JSON payload (frontend sends base64).
module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res)) return;

  const parsed = parseBase64Body(req.body);
  if (!parsed) return res.status(400).json({ error: "Invalid or missing image data. Send JSON { data: 'data:image/...;base64,...' }" });

  const { buf, mime } = parsed;
  const ext = mime.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
  const filename = `logos/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

  const blob = await put(filename, buf, {
    access: "public",
    contentType: mime,
    addRandomSuffix: false,
  });

  return res.status(200).json({ url: blob.url });
};
