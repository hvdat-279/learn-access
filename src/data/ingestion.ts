import { File, Directory, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { ocr, pdf } from "./native";
import { repository, createDocument } from "./repository";
import { validateFile, MAX_PAGES, type Document } from "../domain/model";

export async function prepare(
  ownerId: string,
  assets: { uri: string; name?: string; size?: number; mimeType?: string }[],
): Promise<Document> {
  if (assets.length > MAX_PAGES) throw new Error("Chỉ chọn tối đa 5 ảnh.");
  
  const name = assets[0]?.name?.toLowerCase() || "";
  const mime = assets[0]?.mimeType?.toLowerCase() || "";
  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  const isText = mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv");

  const document = createDocument(
    ownerId,
    assets[0]?.name?.replace(/\.[^.]+$/, "") || "Bài học mới",
    isPdf ? "pdf" : isText ? "text" : "image",
  );

  const directory = new Directory(Paths.document, ownerId, document.id);
  directory.create({ intermediates: true, idempotent: true });

  for (const asset of assets) {
    const file = new File(asset.uri);
    validateFile(asset.size ?? file.size);

    if (isText) {
      let content = "";
      try {
        content = await file.text();
      } catch {
        const res = await fetch(asset.uri);
        content = await res.text();
      }
      const paragraphs = content
        .split(/\r?\n\s*\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      document.status = "ready";
      document.blocks = (paragraphs.length ? paragraphs : [content]).map((text) => ({
        id: Crypto.randomUUID(),
        page: 1,
        text,
        original: text,
      }));
      await repository.save(document);
      return document;
    } else if (isPdf) {
      const source = new File(directory, "source.pdf");
      file.copy(source);
      const count = await pdf.pageCount(source.uri);
      validateFile(source.size, count);
      for (let index = 0; index < count; index++) {
        const uri = await pdf.renderPage(source.uri, index);
        const id = Crypto.randomUUID();
        const dest = new File(directory, id + ".jpg");
        new File(uri).move(dest);
        document.pages.push({ id, uri: dest.uri, status: "pending" });
      }
    } else {
      const normalized = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.55, format: SaveFormat.JPEG },
      );
      const id = Crypto.randomUUID();
      const dest = new File(directory, id + ".jpg");
      new File(normalized.uri).move(dest);
      document.pages.push({ id, uri: dest.uri, status: "pending" });
    }
  }
  return document;
}

export async function recognizeDocument(
  document: Document,
  signal: AbortSignal,
  onProgress: (doc: Document, index: number) => void,
): Promise<Document> {
  if (document.status === "ready" && document.blocks.length > 0) {
    return document;
  }
  const originalText = document.blocks.map((b) => b.text).join("\n");
  let current = { ...document, pages: document.pages.map((p) => ({ ...p })) };
  for (let i = 0; i < current.pages.length; i++) {
    if (signal.aborted) break;
    if (current.pages[i].status === "done") continue;
    try {
      const texts = await ocr.recognize(current.pages[i].uri);
      if (signal.aborted) break;
      if (!texts.some((t) => t.trim()))
        throw new Error(
          "Không tìm thấy chữ. Hãy chụp lại rõ hơn hoặc nhập văn bản thủ công.",
        );
      current.blocks = [
        ...current.blocks.filter((b) => b.page !== i + 1),
        ...texts
          .filter((t) => t.trim())
          .map((text) => ({
            id: Crypto.randomUUID(),
            page: i + 1,
            text,
            original: text,
          })),
      ].sort((a, b) => a.page - b.page);
      current.pages[i].status = "done";
      current.pages[i].error = undefined;
    } catch (error) {
      current.pages[i].status = "error";
      current.pages[i].error =
        error instanceof Error
          ? error.message
          : "Không thể nhận diện trang này.";
    }
    await repository.save(current, false);
    onProgress({ ...current, pages: [...current.pages] }, i + 1);
  }
  const changed = originalText !== current.blocks.map((b) => b.text).join("\n");

  // Tự động nhận diện tiêu đề bài học từ dòng đầu tiên nếu tiêu đề đang là mặc định
  let nextTitle = current.title;
  if (
    (nextTitle === "Bài học mới" ||
      (nextTitle.length === 36 && nextTitle.includes("-"))) &&
    current.blocks.length > 0
  ) {
    const firstBlockText = current.blocks[0].text.trim();
    const firstLine = firstBlockText
      .split("\n")[0]
      .trim()
      .replace(/^#+\s*/, "")
      .replace(/^[0-9]+[.)]\s*/, "");
    if (firstLine.length >= 4) {
      nextTitle = firstLine.slice(0, 50);
    }
  }

  current = {
    ...current,
    title: nextTitle,
    status: "review",
    version:
      changed && document.blocks.length
        ? document.version + 1
        : document.version,
  };
  await repository.save(current);
  return current;
}
