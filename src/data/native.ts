import { requireOptionalNativeModule } from "expo-modules-core";
import type { OcrService, PdfService } from "../domain/model";
type NativeApi = {
  recognize(uri: string): Promise<string[]>;
  pageCount(uri: string): Promise<number>;
  renderPage(uri: string, page: number): Promise<string>;
};
function native() {
  const module = requireOptionalNativeModule<NativeApi>("LearnAccessNative");
  if (!module)
    throw new Error(
      "OCR/PDF cần bản Development Build trên Android hoặc iPhone. Expo Go và web không có module này.",
    );
  return module;
}
export const ocr: OcrService = { recognize: (uri) => native().recognize(uri) };
export const pdf: PdfService = {
  pageCount: (uri) => native().pageCount(uri),
  renderPage: (uri, index) => native().renderPage(uri, index),
};
