export type Block = {
  id: string;
  page: number;
  original: string;
  text: string;
  highlight?: "yellow" | "green" | "blue" | "none";
  note?: string;
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

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  known?: boolean;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  userAnswer?: number;
};

export type AiResult = {
  version: number;
  summary?: Summary;
  explanations: Record<string, Citation>;
  flashcards?: Flashcard[];
  quiz?: QuizQuestion[];
};

export type Document = {
  id: string;
  ownerId: string;
  title: string;
  kind: "image" | "pdf" | "text" | "docx";
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
  folder?: string;
  isPublic?: boolean;
  authorName?: string;
  likes?: number;
  originalId?: string;
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
  get(id: string, ownerId: string): Promise<Document | null | undefined>;
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
  generateQuiz?(document: Document): Promise<QuizQuestion[]>;
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

export function setBlockHighlight(
  document: Document,
  id: string,
  highlight: "yellow" | "green" | "blue" | "none",
): Document {
  return {
    ...document,
    blocks: document.blocks.map((b) =>
      b.id === id ? { ...b, highlight: highlight === "none" ? undefined : highlight } : b,
    ),
    version: document.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function setBlockNote(
  document: Document,
  id: string,
  note: string,
): Document {
  return {
    ...document,
    blocks: document.blocks.map((b) =>
      b.id === id ? { ...b, note: note.trim() || undefined } : b,
    ),
    version: document.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function setDocumentFolder(
  document: Document,
  folder?: string,
): Document {
  return {
    ...document,
    folder: folder?.trim() || undefined,
    version: document.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function setDocumentPublic(
  document: Document,
  isPublic: boolean,
  authorName?: string,
): Document {
  return {
    ...document,
    isPublic,
    authorName: authorName ?? document.authorName,
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
  
  // Tự động tạo Flashcards từ các thuật ngữ và ý chính
  const flashcards: Flashcard[] = [
    ...summary.terms.map((t, idx) => {
      const parts = t.text.split(/:\s*|\s*-\s*|\s*—\s*/);
      return {
        id: `term-${idx}-${Date.now()}`,
        front: parts[0]?.trim() || `Thuật ngữ ${idx + 1}`,
        back: parts.slice(1).join(": ").trim() || t.text,
      };
    }),
    ...summary.points.map((p, idx) => ({
      id: `point-${idx}-${Date.now()}`,
      front: `Trọng tâm ${idx + 1}: Nội dung cốt lõi là gì?`,
      back: p.text,
    })),
  ];

  return {
    ...document,
    ai: {
      version,
      summary,
      flashcards: flashcards.length > 0 ? flashcards : document.ai?.flashcards,
      quiz: document.ai?.version === version ? document.ai.quiz : undefined,
      explanations:
        document.ai?.version === version ? document.ai.explanations : {},
    },
  };
}

export function applyQuiz(
  document: Document,
  quiz: QuizQuestion[],
): Document {
  return {
    ...document,
    ai: {
      ...(document.ai ?? { version: document.version, explanations: {} }),
      quiz,
    },
  };
}

export function applyFlashcards(
  document: Document,
  flashcards: Flashcard[],
): Document {
  return {
    ...document,
    ai: {
      ...(document.ai ?? { version: document.version, explanations: {} }),
      flashcards,
    },
  };
}
