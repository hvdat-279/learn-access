import { z } from "zod";
import type { Block } from "./model";
export const citationSchema = z.object({
  text: z.string().min(1).max(10000),
  sourceBlockIds: z.array(z.string()).min(1).max(50),
});
export const summarySchema = z.object({
  overview: z.string().min(1).max(10000),
  points: z.array(citationSchema).min(1).max(20),
  terms: z.array(citationSchema).max(20),
});
export function validateSources<T extends { sourceBlockIds: string[] }>(
  items: T[],
  blocks: Pick<Block, "id">[],
): T[] {
  const ids = new Set(blocks.map((b) => b.id));
  if (
    items.some(
      (item) =>
        !item.sourceBlockIds.length ||
        item.sourceBlockIds.some((id) => !ids.has(id)),
    )
  )
    throw new Error("Kết quả AI có tham chiếu không hợp lệ. Hãy thử lại.");
  return items;
}
