import type { Document } from "../domain/model";
const message =
  "Chụp ảnh, OCR và PDF hoạt động trên bản Android/iPhone. Bạn có thể dán văn bản bên dưới để trải nghiệm trình đọc trên web.";
export async function prepare(
  _ownerId: string,
  _assets: { uri: string; name?: string; size?: number; mimeType?: string }[],
): Promise<Document> {
  throw new Error(message);
}
export async function recognizeDocument(
  _document: Document,
  _signal: AbortSignal,
  _onProgress: (doc: Document, index: number) => void,
): Promise<Document> {
  throw new Error(message);
}
