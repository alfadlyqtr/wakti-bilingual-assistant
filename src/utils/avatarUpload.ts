const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MIN_BYTES_FOR_COMPRESSION = 250 * 1024;
const MAX_AVATAR_DIMENSION = 1080;
const LOSSY_IMAGE_QUALITY = 0.82;

type LoadedImageSource = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup?: () => void;
};

function getBaseName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return "avatar";
  const index = trimmed.lastIndexOf(".");
  if (index <= 0) return trimmed;
  return trimmed.slice(0, index) || "avatar";
}

function getExtensionFromType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/jpg":
    case "image/jpeg":
    default:
      return "jpg";
  }
}

function detectExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return getExtensionFromType(file.type);
}

function resolveOutputType(inputType: string): "image/jpeg" | "image/png" | "image/webp" {
  if (inputType === "image/png") return "image/png";
  if (inputType === "image/webp") return "image/webp";
  return "image/jpeg";
}

async function loadImageSource(file: File): Promise<LoadedImageSource> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
        cleanup: () => bitmap.close(),
      };
    } catch {
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = objectUrl;
    });

    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressAvatarImage(file: File): Promise<File | null> {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type) || file.size < MIN_BYTES_FOR_COMPRESSION) {
    return null;
  }

  try {
    const source = await loadImageSource(file);
    try {
      const maxDimension = Math.max(source.width, source.height);
      const scale = Math.min(1, MAX_AVATAR_DIMENSION / maxDimension);
      const targetWidth = Math.max(1, Math.round(source.width * scale));
      const targetHeight = Math.max(1, Math.round(source.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) return null;

      source.draw(context, targetWidth, targetHeight);
      const outputType = resolveOutputType(file.type);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outputType, outputType === "image/png" ? undefined : LOSSY_IMAGE_QUALITY);
      });

      if (!blob || blob.size >= file.size) return null;

      const baseName = getBaseName(file.name);
      const extension = getExtensionFromType(outputType);

      return new File([blob], `${baseName}.${extension}`, {
        type: outputType,
        lastModified: Date.now(),
      });
    } finally {
      source.cleanup?.();
    }
  } catch {
    return null;
  }
}

export async function prepareAvatarUploadFile(file: File): Promise<{ file: File; extension: string }> {
  const compressed = await compressAvatarImage(file);
  const preparedFile = compressed || file;
  return {
    file: preparedFile,
    extension: detectExtension(preparedFile),
  };
}
