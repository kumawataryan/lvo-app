import { sendSubscriptionEmails } from "@/lib/email/subscription-emails";
import { sendDueTrialEmails } from "@/lib/email/trial-emails";

export const dynamic = "force-dynamic";

// Runs daily (see vercel.json). Requires CRON_SECRET; add ?dryRun=1 to list what would be sent without sending.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    const [subscriptions, trials] = await Promise.all([
      sendSubscriptionEmails({ dryRun }),
      sendDueTrialEmails({ dryRun }),
    ]);
    return Response.json({ subscriptions, trials });
  } catch (error) {
    console.error("Subscription email job failed", error);
    return Response.json({ error: "Subscription email job failed." }, { status: 500 });
  }
}
