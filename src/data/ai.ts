import * as Crypto from "expo-crypto";
import type { AiService, Document } from "../domain/model";
import { MAX_AI_CHARS } from "../domain/model";
import {
  citationSchema,
  summarySchema,
  validateSources,
} from "../domain/validation";
import { invokeAuthenticated } from "./functions";

async function call(
  document: Document,
  task: "summarize" | "explain",
  blockId?: string,
) {
  if (!document.blocks.length)
    throw new Error("Hãy nhận diện và kiểm tra văn bản trước.");
  if (
    document.blocks.reduce((sum, block) => sum + block.text.length, 0) >
    MAX_AI_CHARS
  )
    throw new Error("Nội dung vượt 30.000 ký tự. Hãy nhập ít trang hơn.");

  return invokeAuthenticated("study", {
    requestId: Crypto.randomUUID(),
    documentId: document.id,
    version: document.version,
    task,
    blockId,
    blocks: document.blocks.map(({ id, text, page }) => ({ id, text, page })),
  });
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
