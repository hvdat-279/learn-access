import { requireOptionalNativeModule } from "expo-modules-core";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { OcrService, PdfService } from "../domain/model";
import { invokeAuthenticated } from "./functions";

type NativeApi = {
  recognize(uri: string): Promise<string[]>;
  pageCount(uri: string): Promise<number>;
  renderPage(uri: string, page: number): Promise<string>;
};

async function getBase64(uri: string): Promise<string> {
  try {
    const file = new File(uri);
    const b = await file.base64();
    if (b) return b;
  } catch {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystemLegacy = require("expo-file-system/legacy");
    const b = await FileSystemLegacy.readAsStringAsync(uri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    if (b) return b;
  } catch {}
  return "";
}

async function geminiVisionOcr(uri: string): Promise<string[]> {
  try {
    // 1. Tối ưu ảnh siêu nhẹ (1024px, nén 0.5) và lấy TRỰC TIẾP Base64 từ expo-image-manipulator
    let base64 = "";
    try {
      const optimized = await manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.5, format: SaveFormat.JPEG, base64: true },
      );
      if (optimized.base64) {
        base64 = optimized.base64;
      }
    } catch (e) {
      console.warn("manipulateAsync base64 error:", e);
    }

    if (!base64) {
      base64 = await getBase64(uri);
    }

    if (!base64) {
      throw new Error("Không thể đọc được dữ liệu ảnh để gửi AI.");
    }

    const cleanBase64 = base64
      .replace(/^data:image\/[a-z]+;base64,/, "")
      .trim();
    const data = await invokeAuthenticated<{ text: string }>(
      "ocr",
      {
        requestId: Crypto.randomUUID(),
        imageBase64: cleanBase64,
        mimeType: "image/jpeg",
      },
      60000,
    );
    const text = data.text?.trim() || "";
    if (text) {
      const paragraphs = text
        .split(/\n\s*\n/)
        .map((p: string) => p.trim())
        .filter(Boolean);
      return paragraphs.length > 0 ? paragraphs : [text];
    }
    return [];
  } catch (e) {
    console.warn("Gemini OCR error:", e);
    throw e;
  }
}

function native() {
  const module = requireOptionalNativeModule<NativeApi>("LearnAccessNative");
  if (!module)
    throw new Error(
      "PDF native cần bản Development Build trên Android hoặc iPhone. Expo Go và web không có module này.",
    );
  return module;
}

export const ocr: OcrService = {
  recognize: async (uri) => {
    const mod = requireOptionalNativeModule<NativeApi>("LearnAccessNative");
    if (mod) {
      try {
        const results = await mod.recognize(uri);
        if (results && results.length > 0) return results;
      } catch {
        // Fallback to Gemini OCR below
      }
    }
    // Fallback qua Supabase; Gemini key không nằm trong ứng dụng.
    const cloudTexts = await geminiVisionOcr(uri);
    if (cloudTexts && cloudTexts.length > 0) {
      return cloudTexts;
    }
    throw new Error(
      "Không tìm thấy chữ trong ảnh. Hãy chụp rõ nét hơn hoặc dán văn bản thủ công.",
    );
  },
};

export const pdf: PdfService = {
  pageCount: (uri) => native().pageCount(uri),
  renderPage: (uri, index) => native().renderPage(uri, index),
};
