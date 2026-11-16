const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export interface ImageUploadResult {
  url?: string;
  error?: string;
}

/**
 * Shared upload helper for profile images (avatar and cover).
 * Uses the existing authenticated /api/uploads endpoint and never exposes
 * the stored file path to the user beyond the returned public URL.
 */
export async function uploadImage(file: File): Promise<ImageUploadResult> {
  if (!file.type.startsWith("image/")) {
    return { error: "Envie um arquivo de imagem (PNG, JPG ou WebP)." };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "A imagem deve ter no máximo 2 MB." };
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/uploads", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      return { error: data.error || "Não foi possível enviar a imagem." };
    }
    return { url: data.url as string };
  } catch {
    return { error: "Erro de conexão ao enviar imagem." };
  }
}
