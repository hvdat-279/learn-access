import * as Crypto from "expo-crypto";
import type { Document } from "../domain/model";
import { createDocument, repository } from "./repository";

export async function prepare(
  ownerId: string,
  assets: { uri: string; name?: string; size?: number; mimeType?: string }[],
): Promise<Document> {
  const name = assets[0]?.name?.toLowerCase() || "";
  const mime = assets[0]?.mimeType?.toLowerCase() || "";
  const isText = mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv");

  if (isText) {
    const res = await fetch(assets[0].uri);
    const content = await res.text();
    const document = createDocument(
      ownerId,
      assets[0]?.name?.replace(/\.[^.]+$/, "") || "Bài học mới",
      "text",
    );
    const paragraphs = content
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    document.status = "ready";
    document.blocks = (paragraphs.length ? paragraphs : [content]).map((text) => ({
      id: Crypto.randomUUID(),
      page: 1,
      text,
      original: text,
    }));
    await repository.save(document);
    return document;
  }

  throw new Error(
    "Chụp ảnh, OCR và PDF hoạt động trên bản Android/iPhone. Trên web bạn có thể nhập tệp văn bản .txt/.md hoặc dán văn bản bên dưới.",
  );
}

export async function recognizeDocument(
  document: Document,
  _signal: AbortSignal,
  _onProgress: (doc: Document, index: number) => void,
): Promise<Document> {
  if (document.status === "ready" && document.blocks.length > 0) {
    return document;
  }
  throw new Error("OCR chỉ hoạt động trên thiết bị Android/iPhone có native build.");
}
