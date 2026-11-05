import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { Document, SyncOperation } from "../domain/model";
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  payload: text("payload", { mode: "json" }).$type<Document>().notNull(),
});
export const outbox = sqliteTable("outbox", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  documentId: text("document_id").notNull(),
  payload: text("payload", { mode: "json" })
    .$type<SyncOperation["payload"]>()
    .notNull(),
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
});
export const preferences = sqliteTable("preferences", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
