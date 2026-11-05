import { and, eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { db } from "./db";
import { documents, outbox, preferences } from "./schema";
import type { Document, DocumentRepository } from "../domain/model";
const listeners = new Set<() => void>();
export function onLocalChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const repository: DocumentRepository = {
  async list(ownerId) {
    return db
      .select()
      .from(documents)
      .where(eq(documents.ownerId, ownerId))
      .all()
      .map((r) => r.payload)
      .filter((d) => !d.deleted)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id, ownerId) {
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
      .get()?.payload;
  },
  async save(document, enqueue = true) {
    db.transaction((tx) => {
      tx.insert(documents)
        .values({
          id: document.id,
          ownerId: document.ownerId,
          payload: document,
        })
        .onConflictDoUpdate({
          target: documents.id,
          set: { payload: document },
        })
        .run();
      if (enqueue && document.ownerId !== "local") {
        tx.insert(outbox)
          .values({
            id: Crypto.randomUUID(),
            ownerId: document.ownerId,
            documentId: document.id,
            payload: document,
          })
          .run();
      }
    });
    if (enqueue && document.ownerId !== "local")
      listeners.forEach((listener) => listener());
  },
};
export const preference = {
  get(key: string) {
    return db.select().from(preferences).where(eq(preferences.key, key)).get()
      ?.value;
  },
  set(key: string, value: string) {
    db.insert(preferences)
      .values({ key, value })
      .onConflictDoUpdate({ target: preferences.key, set: { value } })
      .run();
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
