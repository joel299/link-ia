import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUploadsDir } from "@/lib/db";

const SAFE_FILENAME_RE = /^[a-f0-9-]+\.(png|jpg|jpeg|webp)$/;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;

  if (!SAFE_FILENAME_RE.test(filename)) {
    return NextResponse.json(
      { error: "Nome de arquivo inválido." },
      { status: 400 }
    );
  }

  const uploadsDir = path.resolve(getUploadsDir());
  const filePath = path.resolve(uploadsDir, filename);

  if (!filePath.startsWith(uploadsDir + path.sep)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filename).slice(1).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Imagem não encontrada." },
      { status: 404 }
    );
  }
}
