const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  pro:        process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

const PLAN_NAMES = { pro: "PRO", enterprise: "Enterprise" };
const DAILY_LIMITS = { pro: 10000, enterprise: 999999 };

// POST /api/stripe/checkout
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const { plan, email } = req.body || {};

  if (!plan || !PRICES[plan]) {
    return res.status(400).json({ error: "invalid_plan", valid: Object.keys(PRICES) });
  }

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
      subscription_data: {
        metadata: { plan, source: "humbletrust_api" },
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url, session_id: session.id });
  } catch (e) {
    console.error("Stripe checkout error", e);
    return res.status(500).json({ error: "checkout_failed", message: e.message });
  }
};
