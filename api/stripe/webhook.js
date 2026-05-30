const Stripe  = require("stripe");
const { getClient } = require("../_lib/db");
const { generateKey, hashKey, PLAN_LIMITS } = require("../_lib/apiKey");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Vercel disables body parsing for raw webhooks
export const config = { api: { bodyParser: false } };

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
  const key   = generateKey();
  const hash  = hashKey(key);
  const prefix = key.slice(0, 12);
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const { data: existing } = await db
    .from("api_keys")
    .select("id")
    .eq("owner_email", email)
    .eq("plan", plan)
    .eq("revoked", false)
    .maybeSingle();

  if (existing) return null; // already has a key for this plan

  const { error } = await db.from("api_keys").insert({
    key_hash:     hash,
    key_prefix:   prefix,
    owner_email:  email || null,
    owner_wallet: null,
    plan,
    daily_limit:  limit,
    label:        `Stripe ${plan} subscription`,
    metadata:     { stripe_customer_id: customerId },
  });

  if (error) throw error;
  return key;
}

async function revokeKeysByCustomer(customerId) {
  const db = getClient();
  await db
    .from("api_keys")
    .update({ revoked: true })
    .contains("metadata", { stripe_customer_id: customerId });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const rawBody = await getRawBody(req);

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
        if (key) {
          console.log(`Provisioned ${plan} key for ${email}: ${key.slice(0, 16)}...`);
          // TODO: send key via email (Resend/SendGrid)
        }
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
        // Could downgrade to free tier here
        break;
      }
    }
  } catch (e) {
    console.error("Webhook handler error", e);
    return res.status(500).json({ error: "handler_error" });
  }

  return res.status(200).json({ received: true });
};
