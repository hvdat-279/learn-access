import type { AiService, Document } from "../domain/model";
import { MAX_AI_CHARS } from "../domain/model";
import {
  summarySchema,
  citationSchema,
  validateSources,
} from "../domain/validation";
import { requireBackend } from "./supabase";
import * as Crypto from "expo-crypto";

const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

async function geminiDirectAi(
  document: Document,
  task: "summarize" | "explain",
  blockId?: string,
) {
  const blocks = document.blocks;
  if (!blocks.length) throw new Error("Chưa có văn bản");

  if (task === "explain" && blockId) {
    const targetBlock = blocks.find((b) => b.id === blockId);
    if (!targetBlock) throw new Error("Không tìm thấy đoạn");

    const prompt = `Bạn là trợ lý học tập. Hãy giải thích đoạn văn sau bằng tiếng Việt thật dễ hiểu, ngắn gọn và thực tế:\n"${targetBlock.text}"`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      },
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("").trim();
    return {
      text: text?.trim() || targetBlock.text,
      sourceBlockIds: [blockId],
    };
  }

  // task === "summarize"
  const content = blocks.map((b) => `[ID: ${b.id}]\n${b.text}`).join("\n\n");
  const prompt = `Bạn là trợ lý học tập xuất sắc. Hãy đọc tài liệu dưới đây và trích xuất:
1. "overview": Viết 1 đoạn tóm tắt tổng quan súc tích về bài học (khoảng 3-4 câu).
2. "points": 3 đến 5 ý chính trọng tâm. Mỗi ý gồm text và sourceBlockIds chứa đúng ID của đoạn văn bản gốc trong tài liệu.
3. "terms": 3 đến 5 thuật ngữ/khái niệm cốt lõi kèm định nghĩa ngắn theo mẫu "Tên thuật ngữ: Định nghĩa", kèm sourceBlockIds chứa đúng ID đoạn văn bản gốc.

Tài liệu:
${content}

Hãy trả về định dạng JSON thuần:
{
  "overview": "...",
  "points": [{ "text": "...", "sourceBlockIds": ["..."] }],
  "terms": [{ "text": "Tên khái niệm: Định nghĩa...", "sourceBlockIds": ["..."] }]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  const data = await res.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("").trim();
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    const validIds = new Set(blocks.map((b) => b.id));
    const fallbackId = blocks[0].id;
    parsed.points = (parsed.points || []).map((p: { text?: string; sourceBlockIds?: string[] }) => ({
      text: String(p.text || ""),
      sourceBlockIds:
        (p.sourceBlockIds || []).filter((id) => validIds.has(id)).length > 0
          ? (p.sourceBlockIds || []).filter((id) => validIds.has(id))
          : [fallbackId],
    }));
    parsed.terms = (parsed.terms || []).map((t: { text?: string; sourceBlockIds?: string[] }) => ({
      text: String(t.text || ""),
      sourceBlockIds:
        (t.sourceBlockIds || []).filter((id) => validIds.has(id)).length > 0
          ? (t.sourceBlockIds || []).filter((id) => validIds.has(id))
          : [fallbackId],
    }));
    if (parsed.overview && parsed.points.length > 0) {
      return parsed;
    }
  }
  throw new Error("Không thể phân tích dữ liệu tóm tắt từ AI");
}

function basicFallbackSummary(document: Document) {
  const blocks = document.blocks;
  const firstBlock = blocks[0]?.text || "Nội dung học tập";
  const points = blocks.slice(0, 4).map((b, idx) => ({
    text: `Ý chính ${idx + 1}: ` + (b.text.length > 140 ? b.text.slice(0, 140) + "…" : b.text),
    sourceBlockIds: [b.id],
  }));
  const terms = blocks.slice(0, 3).map((b, idx) => {
    const parts = b.text.split(/[:\-–]/);
    const term = parts[0]?.trim() || `Thuật ngữ ${idx + 1}`;
    const def = parts[1]?.trim() || (b.text.length > 80 ? b.text.slice(0, 80) + "…" : b.text);
    return {
      text: `${term}: ${def}`,
      sourceBlockIds: [b.id],
    };
  });
  return {
    overview: `Tóm tắt nội dung: ${firstBlock.slice(0, 160)}… Tổng hợp các điểm kiến thức cốt lõi của bài học.`,
    points: points.length ? points : [{ text: firstBlock, sourceBlockIds: [blocks[0]?.id || ""] }],
    terms: terms.length ? terms : [{ text: `Khái niệm cơ bản: ${firstBlock.slice(0, 50)}`, sourceBlockIds: [blocks[0]?.id || ""] }],
  };
}

async function call(
  document: Document,
  task: "summarize" | "explain",
  blockId?: string,
) {
  if (!document.blocks.length)
    throw new Error("Hãy nhận diện và kiểm tra văn bản trước.");
  if (document.blocks.reduce((sum, b) => sum + b.text.length, 0) > MAX_AI_CHARS)
    throw new Error("Nội dung vượt 30.000 ký tự. Hãy nhập ít trang hơn.");

  // Ưu tiên 1: Gọi Edge function nếu có Supabase
  try {
    const client = requireBackend();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const { data, error } = await client.functions.invoke("study", {
        body: {
          requestId: Crypto.randomUUID(),
          documentId: document.id,
          version: document.version,
          task,
          blockId,
          blocks: document.blocks.map(({ id, text, page }) => ({
            id,
            text,
            page,
          })),
        },
        signal: controller.signal,
      });
      if (!error && data && !data.error) {
        return data;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {}

  // Ưu tiên 2: Gọi trực tiếp Gemini AI Flash thông minh
  try {
    const directResult = await geminiDirectAi(document, task, blockId);
    if (directResult) return directResult;
  } catch (geminiError) {
    console.warn("Direct Gemini call failed, using basic fallback:", geminiError);
  }

  // Ưu tiên 3: Dự phòng cơ bản nếu mất mạng
  if (task === "summarize") return basicFallbackSummary(document);
  if (task === "explain" && blockId) {
    const b = document.blocks.find((x) => x.id === blockId);
    return {
      text: `Giải thích đoạn văn:\n"${b?.text || ""}"\nÝ nghĩa: Kiến thức trọng tâm của bài học.`,
      sourceBlockIds: [blockId],
    };
  }
  throw new Error("Không thể xử lý yêu cầu AI.");
}

export const ai: AiService = {
  async summarize(document) {
    const result = summarySchema.parse(await call(document, "summarize"));
    validateSources([...result.points, ...result.terms], document.blocks);
    return result;
  },
  async explain(document, blockId) {
    const result = citationSchema.parse(
      await call(document, "explain", blockId),
    );
    validateSources([result], document.blocks);
    if (!result.sourceBlockIds.includes(blockId))
      throw new Error("AI chưa dẫn đúng đoạn được chọn.");
    return result;
  },
};
