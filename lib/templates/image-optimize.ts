const MAX_DIMENSION = 2048;
const WEBP_QUALITY = 0.82;

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> decode path (e.g. unsupported source type).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resizes to a max 2048px edge and re-encodes as WebP so gallery/featured images use minimal storage. Falls back to the original file if the browser can't do canvas/WebP encoding. */
export async function optimizeImageToWebp(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);
    if ("close" in image) image.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob) return file;

    const filename = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
    return new File([blob], filename, { type: "image/webp" });
  } catch {
    return file;
  }
}
