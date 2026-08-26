// One-time setup: creates the Monthly and Yearly recurring Plans in Razorpay
// and prints the plan IDs to paste into .env as RAZORPAY_PLAN_ID_MONTHLY / RAZORPAY_PLAN_ID_YEARLY.
//
// Usage:
//   node --env-file=.env scripts/setup-razorpay-plans.mjs
//
// Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to already be set.
// Safe to re-run — Razorpay doesn't dedupe plans, so only run this once per amount/period combo
// you need; if you re-run it, you'll get new plan IDs and should update your .env accordingly.

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Set them in .env first.");
  process.exit(1);
}

const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

async function createPlan({ period, interval, amount, name }) {
  const response = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      period,
      interval,
      item: {
        name,
        amount,
        currency: "INR",
      },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to create plan "${name}": ${data.error?.description || response.statusText}`);
  }
  return data;
}

const monthly = await createPlan({ period: "monthly", interval: 1, amount: 12900, name: "Monthly subscription" });
console.log(`RAZORPAY_PLAN_ID_MONTHLY=${monthly.id}`);

const yearly = await createPlan({ period: "yearly", interval: 1, amount: 129900, name: "Yearly subscription" });
console.log(`RAZORPAY_PLAN_ID_YEARLY=${yearly.id}`);

console.log("\nAdd the two lines above to your .env file.");
