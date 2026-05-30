const Stripe = require("stripe");
const { getClient } = require("../_lib/db");
const { generateKey, hashKey, PLAN_LIMITS } = require("../_lib/apiKey");

// Disable body parser so webhook can receive raw body for signature verification
export const config = { api: { bodyParser: false } };

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const PRICES = {
  pro:        process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

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
    metadata: { stripe_customer_id: customerId },
  });
  if (error) throw error;
  return key;
}

async function revokeKeysByCustomer(customerId) {
  await getClient().from("api_keys").update({ revoked: true }).contains("metadata", { stripe_customer_id: customerId });
}

// POST /api/stripe/checkout — create Stripe Checkout session
async function handleCheckout(body, req, res) {
  const { plan, email } = body;
  if (!plan || !PRICES[plan]) return res.status(400).json({ error: "invalid_plan", valid: Object.keys(PRICES) });

  const origin = req.headers.origin || "https://humbletrust.vercel.app";
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
    console.error("Stripe checkout error", e);
    return res.status(500).json({ error: "checkout_failed", message: e.message });
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
    return res.status(400).json({ error: `Webhook error: ${e.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;
        const plan  = session.metadata?.plan || "pro";
        const email = session.customer_details?.email || session.customer_email;
        const cid   = session.customer;
        const key = await provisionApiKey(cid, email, plan);
        if (key) console.log(`Provisioned ${plan} key for ${email}: ${key.slice(0, 16)}...`);
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
  res.setHeader("Access-Control-Allow-Origin", "*");
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
