import { and, eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";
import { db } from "./db";
import { documents, outbox, preferences } from "./schema";
import type { Document, DocumentRepository } from "../domain/model";
import { SAMPLE_COMMUNITY_DOCUMENTS } from "./communityData";

const listeners = new Set<() => void>();
export function onLocalChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const repository: DocumentRepository & {
  listPublic(): Promise<Document[]>;
  toggleLike(id: string, liked?: boolean): Promise<number>;
  cloneToMyLibrary(document: Document, myOwnerId: string): Promise<Document>;
} = {
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
    // 1. Kiểm tra tài liệu thuộc sở hữu của người dùng hiện tại
    const local = db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)))
      .get()?.payload;
    if (local && !local.deleted) return local;

    // 2. Nếu không tìm thấy, kiểm tra xem có phải tài liệu công khai trên SQLite của thiết bị
    const anyDoc = db.select().from(documents).where(eq(documents.id, id)).get()?.payload;
    if (anyDoc && anyDoc.isPublic && !anyDoc.deleted) return anyDoc;

    // 3. Kiểm tra trong kho mẫu cộng đồng
    return SAMPLE_COMMUNITY_DOCUMENTS.find((d) => d.id === id) ?? null;
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
  async listPublic() {
    const all = db
      .select()
      .from(documents)
      .all()
      .map((r) => r.payload)
      .filter((d) => !d.deleted && d.isPublic);

    const merged = [...SAMPLE_COMMUNITY_DOCUMENTS];
    for (const d of all) {
      const idx = merged.findIndex((m) => m.id === d.id);
      if (idx >= 0) merged[idx] = d;
      else merged.unshift(d);
    }
    return merged;
  },
  async toggleLike(id: string, liked?: boolean) {
    const local = db.select().from(documents).where(eq(documents.id, id)).get();
    if (local) {
      const nextLikes = Math.max(0, (local.payload.likes ?? 0) + (liked ? 1 : -1));
      await this.save({ ...local.payload, likes: nextLikes }, false);
      listeners.forEach((l) => l());
      return nextLikes;
    }
    return 0;
  },
  async cloneToMyLibrary(document: Document, myOwnerId: string): Promise<Document> {
    // 1. Kiểm tra xem người dùng đã từng lưu tài liệu này chưa (tránh trùng lặp)
    const existing = db
      .select()
      .from(documents)
      .where(eq(documents.ownerId, myOwnerId))
      .all()
      .map((r) => r.payload)
      .find((d) => !d.deleted && ((d.originalId && d.originalId === document.id) || d.title === `${document.title} (Bản sao)`));

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const clone: Document = {
      ...JSON.parse(JSON.stringify(document)),
      id: Crypto.randomUUID(),
      originalId: document.id,
      ownerId: myOwnerId,
      title: `${document.title} (Bản sao)`,
      isPublic: false,
      serverVersion: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.save(clone);
    return clone;
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
