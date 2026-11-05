import { and, eq } from "drizzle-orm";
import { File, Directory, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { db } from "./db";
import { outbox } from "./schema";
import { repository } from "./repository";
import { requireBackend } from "./supabase";
import type { Document, SyncService } from "../domain/model";
const running = new Map<string, Promise<void>>();
async function execute(ownerId: string) {
  const client = requireBackend();
  async function checkOwner() {
    const { data } = await client.auth.getSession();
    if (data.session?.user.id !== ownerId)
      throw new Error("Phiên đăng nhập đã thay đổi.");
  }
  await checkOwner();
  const operations = db
    .select()
    .from(outbox)
    .where(eq(outbox.ownerId, ownerId))
    .all();
  for (const operation of operations) {
    if (!db.select().from(outbox).where(eq(outbox.id, operation.id)).get())
      continue;
    try {
      await checkOwner();
      const latest = await repository.get(operation.documentId, ownerId);
      if (!latest) {
        db.delete(outbox).where(eq(outbox.id, operation.id)).run();
        continue;
      }
      const payload: Document = JSON.parse(JSON.stringify(operation.payload));
      for (const page of payload.pages) {
        const existing = latest.pages.find((p) => p.id === page.id);
        if (existing?.remotePath) page.remotePath = existing.remotePath;
        if (!page.remotePath && page.uri) {
          const path = `${ownerId}/${payload.id}/${page.id}.jpg`;
          const bytes = await new File(page.uri).bytes();
          const { error } = await client.storage
            .from("documents")
            .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
          if (error) throw error;
          page.remotePath = path;
        }
        page.uri = "";
      }
      await checkOwner();
      const { data, error } = await client.rpc("sync_document", {
        p_operation_id: operation.id,
        p_id: payload.id,
        p_base_version: latest.serverVersion,
        p_payload: payload,
      });
      if (error) throw error;
      await checkOwner();
      const current = await repository.get(payload.id, ownerId);
      if (!current) continue;
      if (data.conflict) {
        const copy: Document = {
          ...current,
          id: Crypto.randomUUID(),
          title: current.title + " (bản xung đột)",
          serverVersion: 0,
          deleted: false,
          updatedAt: new Date().toISOString(),
        };
        copy.pages = copy.pages.map((p) => ({
          ...p,
          id: Crypto.randomUUID(),
          remotePath: undefined,
        }));
        await repository.save(copy);
        db.delete(outbox)
          .where(
            and(eq(outbox.documentId, payload.id), eq(outbox.ownerId, ownerId)),
          )
          .run();
        await repository.save(
          { ...data.payload, ownerId, serverVersion: data.version },
          false,
        );
      } else {
        await repository.save(
          {
            ...current,
            serverVersion: data.version,
            pages: current.pages.map((p) => ({
              ...p,
              remotePath:
                payload.pages.find((r) => r.id === p.id)?.remotePath ??
                p.remotePath,
            })),
          },
          false,
        );
        db.delete(outbox).where(eq(outbox.id, operation.id)).run();
      }
    } catch (error) {
      db.update(outbox)
        .set({
          attempts: operation.attempts + 1,
          error: error instanceof Error ? error.message : "Lỗi đồng bộ",
        })
        .where(eq(outbox.id, operation.id))
        .run();
      throw error;
    }
  }
  await checkOwner();
  const { data, error } = await client
    .from("documents")
    .select("id,payload,version")
    .eq("owner_id", ownerId);
  if (error) throw error;
  const directory = new Directory(Paths.document, "synced", ownerId);
  directory.create({ idempotent: true, intermediates: true });
  for (const row of data ?? []) {
    await checkOwner();
    if (
      db
        .select()
        .from(outbox)
        .where(and(eq(outbox.documentId, row.id), eq(outbox.ownerId, ownerId)))
        .get()
    )
      continue;
    const local = await repository.get(row.id, ownerId);
    const document: Document = {
      ...row.payload,
      ownerId,
      serverVersion: row.version,
      ...(local && local.version === row.payload.version
        ? { progress: local.progress }
        : {}),
    };
    for (const page of document.pages) {
      const cached = local?.pages.find((p) => p.id === page.id)?.uri;
      if (cached && new File(cached).exists) {
        page.uri = cached;
        continue;
      }
      if (page.remotePath && !document.deleted) {
        const { data: link, error } = await client.storage
          .from("documents")
          .createSignedUrl(page.remotePath, 60);
        if (error) throw error;
        const target = new File(directory, page.id + ".jpg");
        if (!target.exists)
          await File.downloadFileAsync(link.signedUrl, target);
        page.uri = target.uri;
      }
    }
    await checkOwner();
    // A user may edit while downloads are running. Never replace a new local edit.
    if (
      !db
        .select()
        .from(outbox)
        .where(and(eq(outbox.documentId, row.id), eq(outbox.ownerId, ownerId)))
        .get()
    )
      await repository.save(document, false);
  }
  if (pendingCount(ownerId) > 0) await execute(ownerId);
}
export const sync: SyncService = {
  run(ownerId) {
    if (ownerId === "local") return Promise.resolve();
    const existing = running.get(ownerId);
    if (existing) return existing;
    const promise = execute(ownerId).finally(() => running.delete(ownerId));
    running.set(ownerId, promise);
    return promise;
  },
};
export function pendingCount(ownerId: string) {
  return db.select().from(outbox).where(eq(outbox.ownerId, ownerId)).all()
    .length;
}
