// Client-only: turns the template's photos into small JPEG data URLs for the AI draft.
// Existing photos are already public URLs, so they are passed through as-is.

const CONTEXT_EDGE = 768;
const CONTEXT_QUALITY = 0.8;

type ContextImage =
  | { kind: "new"; file: File }
  | { kind: "existing"; url: string };

async function decode(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h), release: () => bitmap.close() };
    } catch {
      // Fall back to an <img> element below.
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h), release: () => URL.revokeObjectURL(url) };
}

export async function toAiContextUrl(image: ContextImage): Promise<string | null> {
  if (image.kind === "existing") return /^https:\/\//.test(image.url) ? image.url : null;
  try {
    const source = await decode(image.file);
    const scale = Math.min(1, CONTEXT_EDGE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    // White behind transparent PNGs so they don't turn black when converted to JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    source.draw(context, width, height);
    source.release();
    return canvas.toDataURL("image/jpeg", CONTEXT_QUALITY);
  } catch {
    return null;
  }
}
