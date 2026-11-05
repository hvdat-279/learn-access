import type { AiService, Document } from "../domain/model";
import { MAX_AI_CHARS } from "../domain/model";
import {
  summarySchema,
  citationSchema,
  validateSources,
} from "../domain/validation";
import { requireBackend } from "./supabase";
import * as Crypto from "expo-crypto";
async function call(
  document: Document,
  task: "summarize" | "explain",
  blockId?: string,
) {
  if (!document.blocks.length)
    throw new Error("Hãy nhận diện và kiểm tra văn bản trước.");
  if (document.blocks.reduce((sum, b) => sum + b.text.length, 0) > MAX_AI_CHARS)
    throw new Error("Nội dung vượt 30.000 ký tự. Hãy nhập ít trang hơn.");
  const client = requireBackend();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
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
    if (error) {
      let message = "Không thể tạo nội dung AI. Kiểm tra mạng và thử lại.";
      try {
        const body = await error.context?.json();
        if (body?.error) message = body.error;
      } catch {
        /* Generic message for transport errors. */
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timer);
  }
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
