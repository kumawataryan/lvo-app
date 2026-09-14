import { downloadDropboxFile } from "@/lib/dropbox/server";

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!/^\/lvo-files\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(gallery-[1-9][0-9]*|thumbnail)\.[a-z0-9]+$/i.test(path)) {
    return Response.json({ error: "Invalid file path." }, { status: 400 });
  }

  const dropboxResponse = await downloadDropboxFile(path).catch(() => null);
  if (!dropboxResponse?.ok || !dropboxResponse.body) return Response.json({ error: "File not found." }, { status: 404 });
  // Dropbox's download API always responds with application/octet-stream regardless of
  // the file's actual type, which makes next/image's optimizer reject the response —
  // infer the real image type from the filename extension instead.
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return new Response(dropboxResponse.body, {
    headers: {
      "Content-Type": IMAGE_CONTENT_TYPES[extension] ?? dropboxResponse.headers.get("content-type") ?? "application/octet-stream",
      // Uploaded template paths contain immutable UUIDs, so browsers, the Next.js
      // image optimizer, and the CDN can safely retain them without re-fetching Dropbox.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
