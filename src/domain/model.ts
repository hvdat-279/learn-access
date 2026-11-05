export type Block = {
  id: string;
  page: number;
  original: string;
  text: string;
};
export type Page = {
  id: string;
  uri: string;
  remotePath?: string;
  status: "pending" | "done" | "error";
  error?: string;
};
export type Citation = { text: string; sourceBlockIds: string[] };
export type Summary = {
  overview: string;
  points: Citation[];
  terms: Citation[];
};
export type AiResult = {
  version: number;
  summary?: Summary;
  explanations: Record<string, Citation>;
};
export type Document = {
  id: string;
  ownerId: string;
  title: string;
  kind: "image" | "pdf" | "text";
  pages: Page[];
  blocks: Block[];
  version: number;
  serverVersion: number;
  favorite: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  ai?: AiResult;
  progress: { mode: "original" | "summary"; index: number };
  status: "processing" | "review" | "ready";
};
export type SyncOperation = {
  id: string;
  documentId: string;
  ownerId: string;
  payload: Document;
  attempts: number;
  error?: string;
};
export interface DocumentRepository {
  list(ownerId: string): Promise<Document[]>;
  get(id: string, ownerId: string): Promise<Document | undefined>;
  save(document: Document, enqueue?: boolean): Promise<void>;
}
export interface OcrService {
  recognize(uri: string): Promise<string[]>;
}
export interface PdfService {
  pageCount(uri: string): Promise<number>;
  renderPage(uri: string, index: number): Promise<string>;
}
export interface AiService {
  summarize(document: Document): Promise<Summary>;
  explain(document: Document, blockId: string): Promise<Citation>;
}
export interface SpeechService {
  stop(): Promise<void>;
  play(text: string, onDone: () => void): void;
}
export interface SyncService {
  run(ownerId: string): Promise<void>;
}
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_PAGES = 5;
export const MAX_AI_CHARS = 30_000;
export function validateFile(size: number, pages = 1) {
  if (!Number.isFinite(size) || size <= 0)
    throw new Error("File rỗng hoặc không đọc được.");
  if (size > MAX_FILE_SIZE) throw new Error("Vui lòng chọn file tối đa 20 MB.");
  if (pages < 1 || pages > MAX_PAGES)
    throw new Error("Vui lòng chọn tài liệu từ 1 đến 5 trang.");
}
export function editBlock(
  document: Document,
  id: string,
  text: string,
): Document {
  if (!document.blocks.some((b) => b.id === id))
    throw new Error("Không tìm thấy đoạn văn.");
  if (!text.trim()) throw new Error("Đoạn văn không được để trống.");
  if (document.blocks.find((b) => b.id === id)?.text === text) return document;
  return {
    ...document,
    blocks: document.blocks.map((b) => (b.id === id ? { ...b, text } : b)),
    version: document.version + 1,
    updatedAt: new Date().toISOString(),
  };
}
export function speechSegments(
  document: Document,
  mode: "original" | "summary",
) {
  if (mode === "summary") {
    if (!document.ai?.summary || document.ai.version !== document.version)
      return [];
    return [
      document.ai.summary.overview,
      ...document.ai.summary.points.map((p) => p.text),
    ];
  }
  return document.blocks.map((b) => b.text);
}
export function applySummary(
  document: Document,
  version: number,
  summary: Summary,
): Document {
  if (document.version !== version)
    throw new Error("Văn bản đã thay đổi. Hãy tạo lại tóm tắt.");
  return {
    ...document,
    ai: {
      version,
      summary,
      explanations:
        document.ai?.version === version ? document.ai.explanations : {},
    },
  };
}
