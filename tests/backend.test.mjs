import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";
const op = "44444444-4444-4444-8444-444444444444";
const payload = {
  id: documentId,
  ownerId: alice,
  title: "Private lesson",
  blocks: [],
  pages: [],
};
before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 INSERT INTO auth.users VALUES ('${alice}'),('${bob}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
 CREATE SCHEMA storage;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
 GRANT USAGE ON SCHEMA public,storage TO authenticated,anon;
 GRANT ALL ON storage.objects TO authenticated;
 `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202611030001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202611120001_retry_pending_ai.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
after(async () => db?.close());
async function asUser(id, action) {
  await db.exec("SET ROLE authenticated");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await action();
  } finally {
    await db.exec("RESET ROLE");
  }
}
async function sync(operation, base, body = payload) {
  return (
    await db.query(
      "SELECT public.sync_document($1,$2,$3,$4::jsonb) AS result",
      [operation, documentId, base, JSON.stringify(body)],
    )
  ).rows[0].result;
}
test("first save and retry are idempotent", async () => {
  await asUser(alice, async () => {
    const a = await sync(op, 0);
    const b = await sync(op, 0);
    assert.deepEqual(a, b);
    assert.equal(a.version, 1);
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM public.documents"))
        .rows[0].n,
      1,
    );
  });
});
test("RLS hides documents and storage files from another account", async () => {
  await db.query(
    "INSERT INTO storage.objects(id,bucket_id,name) VALUES($1,$2,$3)",
    [crypto.randomUUID(), "documents", alice + "/private.jpg"],
  );
  await asUser(bob, async () => {
    assert.equal(
      (await db.query("SELECT * FROM public.documents")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("SELECT * FROM storage.objects")).rows.length,
      0,
    );
    await assert.rejects(
      sync(crypto.randomUUID(), 1, { ...payload, ownerId: bob }),
    );
    await assert.rejects(
      db.query("INSERT INTO storage.objects VALUES($1,$2,$3)", [
        crypto.randomUUID(),
        "documents",
        alice + "/attack.jpg",
      ]),
    );
  });
});
test("authenticated users cannot bypass version checking with direct writes", async () => {
  await asUser(alice, async () => {
    await assert.rejects(db.query("UPDATE public.documents SET version=99"));
    await assert.rejects(
      db.query("SELECT public.reserve_ai($1,$2,$3,20)", [
        alice,
        crypto.randomUUID(),
        "hash",
      ]),
    );
  });
});
test("stale writes return conflict without overwriting newer data", async () => {
  await asUser(alice, async () => {
    const updated = await sync(crypto.randomUUID(), 1, {
      ...payload,
      title: "Updated",
    });
    assert.equal(updated.version, 2);
    const conflict = await sync(crypto.randomUUID(), 1, {
      ...payload,
      title: "Stale",
    });
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.payload.title, "Updated");
    assert.equal(conflict.version, 2);
  });
});
test("tombstones persist through the same version protocol", async () => {
  await asUser(alice, async () => {
    await sync(crypto.randomUUID(), 2, { ...payload, deleted: true });
    assert.equal(
      (await db.query("SELECT payload FROM documents")).rows[0].payload.deleted,
      true,
    );
  });
});
test("AI quota counts unique requests and rejects requests over limit", async () => {
  const id = crypto.randomUUID();
  const reserve = (request) =>
    db.query("SELECT reserve_ai($1,$2,$3,2) AS result", [
      alice,
      request,
      "hash",
    ]);
  const a = await reserve(id);
  assert.equal(a.rows[0].result.cached, false);
  const pendingRetry = await reserve(id);
  assert.equal(pendingRetry.rows[0].result.cached, false);
  assert.equal(pendingRetry.rows[0].result.retry, true);
  await db.query("UPDATE ai_requests SET result=$1::jsonb WHERE id=$2", [
    JSON.stringify({ text: "done" }),
    id,
  ]);
  const completedRetry = await reserve(id);
  assert.equal(completedRetry.rows[0].result.cached, true);
  assert.equal(completedRetry.rows[0].result.result.text, "done");
  await reserve(crypto.randomUUID());
  await assert.rejects(reserve(crypto.randomUUID()));
});
