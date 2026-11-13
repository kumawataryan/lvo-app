import { canUserAddTemplates } from "@/lib/auth/permissions";
import { buildDraftMessages, parseAiDraft, type AiDraftInput, type AiDifficulty } from "@/lib/templates/ai-draft";
import { createSupabaseAuthServerClient } from "@/lib/supabase/server";
import { openRouterConfig, requestOpenRouterText } from "@/lib/templates/openrouter";

const DIFFICULTIES: AiDifficulty[] = ["easy", "medium", "advanced"];
const MAX_IMAGES = 3;
const MAX_IMAGE_URL_LENGTH = 600_000;

// Only https links or small inline JPEG/PNG/WebP data URLs reach the model.
function isAllowedImageUrl(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= MAX_IMAGE_URL_LENGTH
    && (/^https:\/\/[^\s]+$/.test(value) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}

// Drafts only generate text. Nothing here writes to Supabase.
export async function POST(request: Request) {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!canUserAddTemplates(user)) return Response.json({ error: "You do not have permission." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (title.length < 3) return Response.json({ error: "Type a title first (at least 3 letters)." }, { status: 400 });

  const input: AiDraftInput = {
    title,
    categoryNames: Array.isArray(body.categoryNames)
      ? body.categoryNames.filter((name): name is string => typeof name === "string").map((name) => name.slice(0, 60)).slice(0, 6)
      : [],
    minimumAge: clampInteger(body.minimumAge, 0, 16, 4),
    maximumAge: clampInteger(body.maximumAge, 0, 16, 8),
    difficulty: DIFFICULTIES.includes(body.difficulty as AiDifficulty) ? body.difficulty as AiDifficulty : "easy",
    durationMinutes: clampInteger(body.durationMinutes, 1, 1440, 15),
    notes: typeof body.notes === "string" ? body.notes.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 500) : "",
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.filter(isAllowedImageUrl).slice(0, MAX_IMAGES) : [],
  };

  const { keys, model } = openRouterConfig();
  if (!keys.length) return Response.json({ error: "AI drafts are not configured yet." }, { status: 503 });

  const messages = buildDraftMessages(input);
  const fallback = { title: input.title, durationMinutes: input.durationMinutes, difficulty: input.difficulty };

  try {
    // One retry: free models sometimes return prose or a truncated object.
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await requestOpenRouterText(messages, { keys, model });
      const suggestion = parseAiDraft(raw, fallback);
      if (suggestion) return Response.json({ suggestion });
    }
    return Response.json({ error: "The AI draft came back incomplete. Try again." }, { status: 502 });
  } catch (error) {
    // Log the real reason on the server; the author only sees the friendly message.
    console.error("AI draft failed:", error);
    return Response.json({ error: "Could not reach the AI service. Try again in a moment." }, { status: 502 });
  }
}
