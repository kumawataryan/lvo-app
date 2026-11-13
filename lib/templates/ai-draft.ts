import type { TemplateSpecInput } from "./specs";

// Shared by the server route (prompt + parsing) and the add-template form (types only).

export type AiDifficulty = "easy" | "medium" | "advanced";
export type AiDraftField = "description" | "supplies" | "details" | "tags" | "time" | "meta";

export type AiDraftInput = {
  title: string;
  categoryNames: string[];
  minimumAge: number;
  maximumAge: number;
  difficulty: AiDifficulty;
  durationMinutes: number;
  // Extra facts typed by the author. These count as facts the draft may use.
  notes: string;
  // Up to three photos as https URLs or small JPEG/PNG/WebP data URLs. The featured photo comes first.
  imageUrls: string[];
};

export type AiDraftSuggestion = {
  description: string;
  supplies: string[];
  details: TemplateSpecInput[];
  tags: string[];
  durationMinutes: number;
  difficulty: AiDifficulty;
  // Five SEO title options the author can pick from.
  titleIdeas: string[];
  // Plain-text Vimeo description. The template and website links are added by the app, not the model.
  vimeoDescription: string;
  // SEO meta title (up to 70 characters) and meta description (up to 180) for search results.
  metaTitle: string;
  metaDescription: string;
  // Ten SEO file names for the printable and images, as lowercase hyphenated slugs without extensions.
  filenameIdeas: string[];
};

const LIBRARY_CONTEXT = `About the business: Lovely Vibes Only Craft Library (lovely.diy) is an online craft library for children aged 0 to 16. Each template is one craft or activity that a parent or teacher prints at home and does with a child.

Categories: DIY (hands-on projects to make and keep), Coloring (colouring pages), Activities (tasks and games with a clear outcome), Drawing (step-by-step drawing guides), Worksheets (practice sheets for skills), Craft Classes (video-led lessons), Stories (read-along or story-led activities).

Readers are parents, grandparents, caregivers and teachers. They skim on a phone and want to know quickly: does it suit my child's age, how long does it take, what do I need to gather, and can my child mostly do it alone.

Brand voice: calm, warm, honest and specific, like someone who has actually made this with a child. No emojis, no exclamation marks, no sales language.`;

const GROUNDING_RULES = `Grounding rules (most important):
- Use only facts you can see in the title, the categories, the ages, the difficulty, the time, the author's extra context, or the attached photos.
- Never invent an occasion, setting, season, weather, holiday, place, person, brand, price, subscription, video, or print size. If a fact is not given, leave it out.
- Do not state a purpose, a recipient, a gift, or an occasion (for example "a decorative gift" or "for a party") unless the title says so.
- If photos are attached, base the description and supplies on what they show. Do not describe anything a photo does not show.
- With no photos, name only the materials the craft cannot be done without, and never name decorative extras (eyes, felt, glitter, ribbon) unless the title says so. Keep the rest of the copy about the steps.

Write for people first (Google's guidance on helpful content):
- Answer the question a parent asks: what will my child make, how hard is it, how long, what do I need.
- Be accurate and specific. Generic copy that could describe any craft is not helpful.
- Do not stuff keywords. Each sentence must read naturally to a person.

description:
- One or two sentences, 120 to 240 characters.
- Name the craft and at least one concrete step or material. Say what the child does with their hands.
- Do not copy the title word for word. Do not start with the title.
- Ban filler words: fun, creative, beautiful, amazing, perfect, great, special, lovely, magical, unique, endless, journey, delve, must-have.

supplies:
- 3 to 8 items this craft specifically needs. Plain names. No brands. No generic household filler.

tags (search terms, not repeats of the title):
- Each tag has at least 2 words, and most have 3 or more. Single words are not allowed.
- Each tag must add a new search angle that the title does not already cover. Do not repeat the title or its words in the same order. Do not write a tag that is the title, or that only rearranges it.
- Never use age-related words in tags: no ages, age numbers, "aged", "year-old", "preschool", "preschooler", "toddler", "baby", "infant", "teen", "kids", "children", "child". Age is shown elsewhere on the listing.
- Good angles, when supported by the input: skill level ("easy paper craft for beginners"), materials visible in the photos ("coloured paper flower craft"), category with the craft ("diy paper craft project"), what the child practises ("hand cutting and folding practice").
- Use lowercase. Up to 10 tags. No generic filler such as "kids activity", "simple craft", or "fun craft".

Do not contradict the given ages, difficulty and time.`;

const SEO_RULES = `Title ideas (search-optimised, people first):
- Return exactly 5 titles. Each is 35 to 65 characters.
- Put the craft noun first, the way a parent would type it into search. Keep the subject of the original title.
- Each title must differ from the others in wording, not just punctuation. No keyword lists, no "|" separators, no repeated words across titles.
- Stay grounded: only the facts from the input and photos, no occasions or gifts.
- Title case is not required. Write like a page title a person would click.

Meta title and meta description (search results):
- metaTitle: 45 to 65 characters. Lead with the craft, then one grounded detail. Plain words, no keyword lists, no "|" separators.
- metaDescription: 120 to 170 characters. One or two sentences that tell a parent what the child will make and what they need. Use the same grounding rules. No URLs, no emojis.
- Neither may repeat the other word for word.

File names:
- Return exactly 10 names. Lowercase, words joined with hyphens, no spaces, no extension.
- 3 to 6 words each. Use the craft and the main materials or steps from the title and photos.
- Each name must be distinct. No age words, no occasions, no gifts.

Vimeo description:
- Plain text, 2 to 3 short paragraphs, 300 to 700 characters total.
- Open with what the video shows, naming the craft. Then what the child makes and what the adult needs.
- Use the same grounding rules as the listing. No URLs, no links, no hashtags, no emojis.
- Do not repeat the title word for word more than once.`;

const SYSTEM_PROMPT = `You are the listing writer for Lovely Vibes Only Craft Library. A staff member is creating a new template and will review everything you write before it goes live, so every line must be accurate and useful.

${LIBRARY_CONTEXT}

${GROUNDING_RULES}

${SEO_RULES}

Output rules: reply with one JSON object and nothing else. No markdown, no code fence, no commentary. Use exactly these keys: description (string), supplies (array of strings), tags (array of strings), durationMinutes (integer), difficulty ("easy" | "medium" | "advanced"), titleIdeas (array of exactly 5 strings), vimeoDescription (string), filenameIdeas (array of exactly 10 strings), metaTitle (string), metaDescription (string). Do not include any other keys.`;

export type DraftMessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export function buildDraftMessages(input: AiDraftInput): Array<{ role: "system" | "user"; content: DraftMessageContent }> {
  const hasImages = input.imageUrls.length > 0;
  const photoNote = hasImages
    ? `Photos attached: ${input.imageUrls.length}. The first is the featured image. Describe only what these photos show.`
    : "Photos attached: none. Write only from the title, categories, ages, difficulty and time.";
  const notes = input.notes.trim();
  const user = `Template title: "${input.title}"
Categories: ${input.categoryNames.join(", ") || "not chosen yet"}
Ages: ${input.minimumAge} to ${input.maximumAge}
Difficulty: ${input.difficulty}
Time needed: ${input.durationMinutes} minutes
Author's extra context: ${notes ? `"${notes}"` : "none"}
${photoNote}

Return only the JSON object.`;

  const content: DraftMessageContent = hasImages
    ? [
      { type: "text", text: user },
      ...input.imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    ]
    : user;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

// Shortens text to a limit without cutting a word in half or leaving a dangling comma.
function cutAtWord(value: string, max: number) {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:–—-]+$/, "");
}

function cleanList(value: unknown, max: number, itemLength: number) {
  if (!Array.isArray(value)) return [];
  const items = value.map((item) => cleanText(item, itemLength)).filter(Boolean);
  return [...new Set(items)].slice(0, max);
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// File names are slugs: lowercase, hyphenated, no extension. Age words and invented occasions are dropped, as with tags.
function usableFilenames(value: unknown) {
  return cleanList(value, 10, 80)
    .map((name) => name.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60))
    .filter((name) => name.split("-").length >= 3 && !AGE_WORDS.test(name.replace(/-/g, " ")) && !INVENTED_CONTEXT_WORDS.test(name.replace(/-/g, " ")))
    .filter((name, index, all) => all.indexOf(name) === index);
}

// Keeps line breaks (for Vimeo paragraphs) but trims each line and drops empty runs.
function cleanBlock(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

// Turns the model's raw text into a clean suggestion that fits the template form's limits.
const AGE_WORDS = /\b(ages?|aged|\d+\s*(-|to)\s*\d+|\d+\s*(year|yr)s?|years?\s*old|preschool\w*|toddlers?|babies|baby|infants?|teens?|teenagers?|kids?|children|child|boys?|girls?)\b/;

// Occasions, gifts and settings are never invented, so tags containing them are dropped.
const INVENTED_CONTEXT_WORDS = /\b(gifts?|presents?|birthdays?|parties|party|christmas|holidays?|valentine|halloween|easter|diwali|summer|winter|autumn|spring|rainy|bedtime|classroom|school)\b/;

const normalizeWords = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Tags must be 2+ words and must not repeat or overlap the title, so they add search angles instead of competing with it.
function usableTags(value: unknown, title: string) {
  const titleKey = normalizeWords(title);
  const titleWords = new Set(titleKey.split(" "));
  return cleanList(value, 10, 60)
    .map((tag) => tag.toLowerCase())
    .filter((tag) => {
      const key = normalizeWords(tag);
      const words = key.split(" ").filter(Boolean);
      if (words.length < 2) return false;
      if (AGE_WORDS.test(key)) return false;
      if (INVENTED_CONTEXT_WORDS.test(key)) return false;
      if (key === titleKey || titleKey.includes(key)) return false;
      // Reject a tag whose words are all already in the title (a rearrangement of it).
      return !words.every((word) => titleWords.has(word));
    });
}

export function parseAiDraft(raw: string, fallback: { title: string; durationMinutes: number; difficulty: AiDifficulty }): AiDraftSuggestion | null {
  const data = extractJsonObject(raw);
  if (!data) return null;

  const description = cleanText(data.description, 280);
  if (!description) return null;

  const duration = Number(data.durationMinutes);
  const difficulty = data.difficulty === "easy" || data.difficulty === "medium" || data.difficulty === "advanced"
    ? data.difficulty
    : fallback.difficulty;

  return {
    description,
    supplies: cleanList(data.supplies, 8, 40),
    // Details are never generated; the author fills them in.
    details: [],
    titleIdeas: cleanList(data.titleIdeas, 5, 120).filter((title) => title.split(" ").length >= 3),
    vimeoDescription: cleanBlock(data.vimeoDescription, 1000),
    filenameIdeas: usableFilenames(data.filenameIdeas),
    metaTitle: cutAtWord(cleanText(data.metaTitle, 200), 70),
    metaDescription: cutAtWord(cleanText(data.metaDescription, 400), 180),
    tags: usableTags(data.tags, fallback.title),
    durationMinutes: Number.isFinite(duration) && duration >= 1 && duration <= 1440 ? Math.round(duration) : fallback.durationMinutes,
    difficulty,
  };
}
