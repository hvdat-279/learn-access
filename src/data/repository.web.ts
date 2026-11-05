// Browser preview adapter. Native builds use SQLite/Drizzle in repository.ts.
// The preview persists actual user-entered content; it never synthesizes OCR/AI results.
import * as Crypto from "expo-crypto";
import type { Document, DocumentRepository } from "../domain/model";
const key = "learnaccess.preview.documents.v1";
const listeners = new Set<() => void>();
function read(): Document[] {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key) || "[]");
  } catch {
    return [];
  }
}
export function onLocalChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const repository: DocumentRepository = {
  async list(ownerId) {
    return read()
      .filter((d) => d.ownerId === ownerId && !d.deleted)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id, ownerId) {
    return read().find((d) => d.id === id && d.ownerId === ownerId);
  },
  async save(document, enqueue = true) {
    const documents = read();
    const index = documents.findIndex(
      (d) => d.id === document.id && d.ownerId === document.ownerId,
    );
    if (index < 0) documents.push(document);
    else documents[index] = document;
    globalThis.localStorage?.setItem(key, JSON.stringify(documents));
    if (enqueue) listeners.forEach((listener) => listener());
  },
};
export const preference = {
  get(key: string) {
    return (
      globalThis.localStorage?.getItem("learnaccess.preview." + key) ??
      undefined
    );
  },
  set(key: string, value: string) {
    globalThis.localStorage?.setItem("learnaccess.preview." + key, value);
  },
};
export function createDocument(
  ownerId: string,
  title: string,
  kind: Document["kind"],
): Document {
  const now = new Date().toISOString();
  return {
    id: Crypto.randomUUID(),
    ownerId,
    title,
    kind,
    pages: [],
    blocks: [],
    version: 1,
    serverVersion: 0,
    favorite: false,
    deleted: false,
    createdAt: now,
    updatedAt: now,
    progress: { mode: "original", index: 0 },
    status: "processing",
  };
}
