import { test, expect } from "@jest/globals";
import {
  applySummary,
  editBlock,
  speechSegments,
  validateFile,
  type Document,
} from "../src/domain/model";
import { summarySchema, validateSources } from "../src/domain/validation";
const doc: Document = {
  id: "doc",
  ownerId: "u",
  title: "Test",
  kind: "text",
  pages: [],
  blocks: [
    { id: "b1", page: 1, original: "Nội dung gốc", text: "Nội dung gốc" },
  ],
  version: 1,
  serverVersion: 0,
  favorite: false,
  deleted: false,
  createdAt: "",
  updatedAt: "",
  status: "ready",
  progress: { mode: "original", index: 0 },
};
const summary = {
  overview: "Tổng quan",
  points: [{ text: "Ý chính", sourceBlockIds: ["b1"] }],
  terms: [],
};
test("editing increments source version and leaves original text intact", () => {
  const result = editBlock(doc, "b1", "Nội dung sửa");
  expect(result.version).toBe(2);
  expect(result.blocks[0].original).toBe("Nội dung gốc");
  expect(doc.version).toBe(1);
});
test("no-op edits preserve source version", () =>
  expect(editBlock(doc, "b1", "Nội dung gốc")).toBe(doc));
test("rejects blank edits and unknown blocks", () => {
  expect(() => editBlock(doc, "b1", "  ")).toThrow();
  expect(() => editBlock(doc, "missing", "abc")).toThrow();
});
test("late AI result cannot overwrite newer text", () =>
  expect(() =>
    applySummary(editBlock(doc, "b1", "Sửa"), 1, summary),
  ).toThrow());
test("updated summary clears stale explanations", () => {
  const result = applySummary(
    {
      ...doc,
      ai: {
        version: 0,
        explanations: { b1: { text: "old", sourceBlockIds: ["b1"] } },
      },
    },
    1,
    summary,
  );
  expect(result.ai?.explanations).toEqual({});
});
test("citations must resolve to known source IDs", () => {
  expect(validateSources(summary.points, doc.blocks)).toEqual(summary.points);
  expect(() =>
    validateSources([{ text: "bad", sourceBlockIds: ["unknown"] }], doc.blocks),
  ).toThrow();
  expect(() =>
    validateSources([{ text: "bad", sourceBlockIds: [] }], doc.blocks),
  ).toThrow();
});
test("summary schema rejects unstructured responses", () => {
  expect(summarySchema.safeParse({ overview: "hello" }).success).toBe(false);
});
test("TTS excludes stale AI and preserves original block order", () => {
  expect(speechSegments(doc, "original")).toEqual(["Nội dung gốc"]);
  expect(
    speechSegments(
      { ...doc, ai: { version: 0, summary, explanations: {} } },
      "summary",
    ),
  ).toEqual([]);
  expect(speechSegments(applySummary(doc, 1, summary), "summary")).toEqual([
    "Tổng quan",
    "Ý chính",
  ]);
});
test.each([
  [0, 1],
  [21 * 1024 * 1024, 1],
  [1, 6],
  [1, 0],
])("rejects unsupported file limits: %i %i", (size, pages) =>
  expect(() => validateFile(size, pages)).toThrow(),
);
test("accepts the maximum supported input", () =>
  expect(() => validateFile(20 * 1024 * 1024, 5)).not.toThrow());
