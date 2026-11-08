// Browser preview adapter. Native builds use SQLite/Drizzle in repository.ts.
import * as Crypto from "expo-crypto";
import type { Document, DocumentRepository } from "../domain/model";
import { SAMPLE_COMMUNITY_DOCUMENTS } from "./communityData";

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

export const repository: DocumentRepository & {
  listPublic(): Promise<Document[]>;
  toggleLike(id: string, liked?: boolean): Promise<number>;
  cloneToMyLibrary(document: Document, myOwnerId: string): Promise<Document>;
} = {
  async list(ownerId) {
    return read()
      .filter((d) => d.ownerId === ownerId && !d.deleted)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id, ownerId) {
    // 1. Kiểm tra tài liệu của người dùng hiện tại
    const fromList = read().find((d) => d.id === id && d.ownerId === ownerId);
    if (fromList && !fromList.deleted) return fromList;

    // 2. Kiểm tra xem có phải tài liệu công khai trong localStorage không
    const anyPublic = read().find((d) => d.id === id && d.isPublic && !d.deleted);
    if (anyPublic) return anyPublic;

    // 3. Kiểm tra trong kho mẫu cộng đồng
    return SAMPLE_COMMUNITY_DOCUMENTS.find((d) => d.id === id) ?? null;
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
  async listPublic() {
    const all = read().filter((d) => !d.deleted && d.isPublic);
    const merged = [...SAMPLE_COMMUNITY_DOCUMENTS];
    for (const d of all) {
      const idx = merged.findIndex((m) => m.id === d.id);
      if (idx >= 0) merged[idx] = d;
      else merged.unshift(d);
    }
    return merged;
  },
  async toggleLike(id: string, liked?: boolean) {
    const documents = read();
    const local = documents.find((d) => d.id === id);
    if (local) {
      local.likes = Math.max(0, (local.likes ?? 0) + (liked ? 1 : -1));
      globalThis.localStorage?.setItem(key, JSON.stringify(documents));
      listeners.forEach((l) => l());
      return local.likes;
    }
    return 0;
  },
  async cloneToMyLibrary(document: Document, myOwnerId: string): Promise<Document> {
    const list = await this.list(myOwnerId);
    const existing = list.find(
      (d) => (d.originalId && d.originalId === document.id) || d.title === `${document.title} (Bản sao)`,
    );
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
