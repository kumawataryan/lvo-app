import { isValidUnsubscribe, unsubscribeLead } from "@/lib/leads/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const token = url.searchParams.get("token") ?? "";

  const page = (title: string, message: string, status: number) =>
    new Response(
      `<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;color:#111"><h1 style="font-size:22px">${title}</h1><p>${message}</p></body></html>`,
      { status, headers: { "content-type": "text/html; charset=utf-8" } },
    );

  if (!email || !token || !isValidUnsubscribe(email, token)) {
    return page("Link not valid", "This unsubscribe link is invalid or incomplete.", 400);
  }
  try {
    await unsubscribeLead(email);
    return page("You're unsubscribed", "You won't receive more emails from us at this address.", 200);
  } catch (error) {
    console.error("Unsubscribe failed", error);
    return page("Something went wrong", "We couldn't update your preference. Please try again later.", 500);
  }
}
