import { requireOptionalNativeModule } from "expo-modules-core";
import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { OcrService, PdfService } from "../domain/model";

type NativeApi = {
  recognize(uri: string): Promise<string[]>;
  pageCount(uri: string): Promise<number>;
  renderPage(uri: string, page: number): Promise<string>;
};

const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

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

    const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, "").trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Bạn là chuyên gia số hóa tài liệu. Hãy đọc và trích xuất TOÀN BỘ chữ (tiếng Việt hoặc tiếng Anh) trong bức ảnh này một cách trung thực và đầy đủ nhất. Nếu ảnh chụp màn hình, hãy bỏ qua các thành phần ngoài lề như thanh công cụ, tên tab trình duyệt. Giữ nguyên định dạng các đoạn văn bản. Chỉ trả về nội dung chữ nhận diện được.",
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Gemini OCR HTTP status:", res.status, errText);
      throw new Error(`Máy chủ AI phản hồi lỗi (${res.status}).`);
    }
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: { text?: string }) => p.text || "").join("").trim();
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
    // Fallback thông minh: Dùng Gemini Vision OCR khi chạy trên Expo Go
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
