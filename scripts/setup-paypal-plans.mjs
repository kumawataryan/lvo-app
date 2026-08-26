// One-time setup: creates a PayPal Product plus Monthly and Yearly Billing Plans,
// and prints the plan IDs to paste into .env as PAYPAL_PLAN_ID_MONTHLY / PAYPAL_PLAN_ID_YEARLY.
//
// Usage:
//   node --env-file=.env scripts/setup-paypal-plans.mjs
//
// Requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to already be set.
// Set PAYPAL_ENV=live to target production instead of the sandbox.

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

if (!clientId || !clientSecret) {
  console.error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. Set them in .env first.");
  process.exit(1);
}

async function getAccessToken() {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Failed to authenticate: ${data.error_description || response.statusText}`);
  return data.access_token;
}

async function paypalPost(token, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path} failed: ${data.message || response.statusText}`);
  return data;
}

const token = await getAccessToken();

const product = await paypalPost(token, "/v1/catalogs/products", {
  name: "Craft Library subscription",
  type: "SERVICE",
  category: "SOFTWARE",
});
console.log(`Created PayPal product ${product.id}`);

const monthly = await paypalPost(token, "/v1/billing/plans", {
  product_id: product.id,
  name: "Monthly subscription",
  billing_cycles: [{
    frequency: { interval_unit: "MONTH", interval_count: 1 },
    tenure_type: "REGULAR",
    sequence: 1,
    total_cycles: 0, // 0 = infinite, until cancelled
    pricing_scheme: { fixed_price: { value: "1.50", currency_code: "USD" } },
  }],
  payment_preferences: { auto_bill_outstanding: true },
});
console.log(`PAYPAL_PLAN_ID_MONTHLY=${monthly.id}`);

const yearly = await paypalPost(token, "/v1/billing/plans", {
  product_id: product.id,
  name: "Yearly subscription",
  billing_cycles: [{
    frequency: { interval_unit: "YEAR", interval_count: 1 },
    tenure_type: "REGULAR",
    sequence: 1,
    total_cycles: 0,
    pricing_scheme: { fixed_price: { value: "15.00", currency_code: "USD" } },
  }],
  payment_preferences: { auto_bill_outstanding: true },
});
console.log(`PAYPAL_PLAN_ID_YEARLY=${yearly.id}`);

console.log("\nAdd the two PAYPAL_PLAN_ID_* lines above to your .env file.");
