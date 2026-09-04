import { downloadDropboxFile } from "@/lib/dropbox/server";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!/^\/lvo-files\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/gallery-[1-9][0-9]*\.[a-z0-9]+$/i.test(path)) {
    return Response.json({ error: "Invalid file path." }, { status: 400 });
  }

  const dropboxResponse = await downloadDropboxFile(path).catch(() => null);
  if (!dropboxResponse?.ok || !dropboxResponse.body) return Response.json({ error: "File not found." }, { status: 404 });
  return new Response(dropboxResponse.body, {
    headers: {
      "Content-Type": dropboxResponse.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
