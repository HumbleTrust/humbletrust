const Stripe = require("stripe");
const { getClient } = require("../_lib/db");
const { generateKey, hashKey, PLAN_LIMITS } = require("../_lib/apiKey");

// Disable body parser so webhook can receive raw body for signature verification
module.exports.config = { api: { bodyParser: false } };

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("[stripe] STRIPE_WEBHOOK_SECRET is required in production");
}

const PRICES = {
  pro:        process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

const ALLOWED_ORIGINS = [
  "https://humbletrust.vercel.app",
];
const isSafeOrigin = (o) => !o || ALLOWED_ORIGINS.includes(o) || /^https:\/\/humbletrust(-[a-z0-9]+)*\.vercel\.app$/.test(o);
const SAFE_ORIGIN = "https://humbletrust.vercel.app";

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function provisionApiKey(customerId, email, plan) {
  const db = getClient();
  const key    = generateKey();
  const hash   = hashKey(key);
  const prefix = key.slice(0, 12);
  const limit  = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const { data: existing } = await db
    .from("api_keys").select("id")
    .eq("owner_email", email).eq("plan", plan).eq("revoked", false).maybeSingle();
  if (existing) return null;

  const { error } = await db.from("api_keys").insert({
    key_hash: hash, key_prefix: prefix,
    owner_email: email || null, owner_wallet: null,
    plan, daily_limit: limit,
    label: `Stripe ${plan} subscription`,
    stripe_customer_id: customerId,
  });
  if (error) throw error;
  return key;
}

async function revokeKeysByCustomer(customerId) {
  await getClient().from("api_keys").update({ revoked: true }).eq("stripe_customer_id", customerId);
}

// POST /api/stripe/checkout — create Stripe Checkout session
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

async function handleCheckout(body, req, res) {
  const { plan, email } = body;
  if (!plan || !PRICES[plan]) return res.status(400).json({ error: "invalid_plan", valid: Object.keys(PRICES) });
  if (email !== undefined && (typeof email !== "string" || !EMAIL_RE.test(email)))
    return res.status(400).json({ error: "invalid_email" });

  const origin = isSafeOrigin(req.headers.origin) ? (req.headers.origin || SAFE_ORIGIN) : SAFE_ORIGIN;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      success_url: `${origin}/?payment=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?payment=cancelled`,
      metadata: { plan },
      subscription_data: { metadata: { plan, source: "humbletrust_api" } },
      allow_promotion_codes: true,
    });
    return res.status(200).json({ url: session.url, session_id: session.id });
  } catch (e) {
    console.error("Stripe checkout error", e.message);
    return res.status(500).json({ error: "checkout_failed" });
  }
}

// POST /api/stripe/webhook — handle Stripe events
async function handleWebhook(rawBody, req, res) {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (e) {
    console.error("Webhook signature failed", e.message);
    return res.status(400).json({ error: 'Webhook signature invalid' });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;
        const plan  = session.metadata?.plan;
        if (!plan || !PRICES[plan]) { console.warn("[stripe] invalid plan in session metadata:", plan); break; }
        const email = session.customer_details?.email || session.customer_email;
        const cid   = session.customer;
        const key = await provisionApiKey(cid, email, plan);
        if (key) console.log(`Provisioned ${plan} key prefix=${key.slice(0, 12)}`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await revokeKeysByCustomer(sub.customer);
        console.log(`Revoked keys for customer ${sub.customer}`);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        console.warn(`Payment failed for customer ${inv.customer}`);
        break;
      }
    }
  } catch (e) {
    console.error("Webhook handler error", e);
    return res.status(500).json({ error: "handler_error" });
  }
  return res.status(200).json({ received: true });
}

module.exports = async function handler(req, res) {
  const reqOrigin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", isSafeOrigin(reqOrigin) ? (reqOrigin || SAFE_ORIGIN) : SAFE_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,stripe-signature");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { action } = req.query;
  const rawBody = await getRawBody(req);

  if (action === "checkout") {
    let body = {};
    try { body = JSON.parse(rawBody.toString() || "{}"); } catch { /* ignore */ }
    return handleCheckout(body, req, res);
  }

  if (action === "webhook") {
    return handleWebhook(rawBody, req, res);
  }

  return res.status(404).json({ error: "unknown action" });
};
