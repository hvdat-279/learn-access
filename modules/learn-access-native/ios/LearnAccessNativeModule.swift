import ExpoModulesCore
import PDFKit
import UIKit
import MLKitVision
import MLKitTextRecognition

public class LearnAccessNativeModule: Module {
 private func localURL(_ uri: String) throws -> URL {
  guard let url = URL(string: uri), url.isFileURL else { throw NSError(domain: "LearnAccess", code: 1, userInfo: [NSLocalizedDescriptionKey: "Only local files are supported"]) }
  return url
 }
 private func document(_ uri: String) throws -> PDFDocument {
  guard let pdf = PDFDocument(url: try localURL(uri)), !pdf.isLocked else { throw NSError(domain: "LearnAccess", code: 2, userInfo: [NSLocalizedDescriptionKey: "PDF bị khóa hoặc không hợp lệ."]) }
  return pdf
 }
 public func definition() -> ModuleDefinition {
  Name("LearnAccessNative")
  AsyncFunction("recognize") { (uri: String) async throws -> [String] in
   let url = try self.localURL(uri)
   guard let image = UIImage(contentsOfFile: url.path) else { throw NSError(domain: "LearnAccess", code: 3, userInfo: [NSLocalizedDescriptionKey: "Không đọc được ảnh."]) }
   let input = VisionImage(image: image)
   input.orientation = image.imageOrientation
   let recognizer = TextRecognizer.textRecognizer(options: TextRecognizerOptions())
   let result = try await recognizer.process(input)
   return result.blocks.map { $0.text }
  }
  AsyncFunction("pageCount") { (uri: String) throws -> Int in
   return try self.document(uri).pageCount
  }
  AsyncFunction("renderPage") { (uri: String, index: Int) throws -> String in
   let pdf = try self.document(uri)
   guard (1...5).contains(pdf.pageCount), let page = pdf.page(at: index) else { throw NSError(domain: "LearnAccess", code: 4, userInfo: [NSLocalizedDescriptionKey: "PDF chỉ hỗ trợ 1 đến 5 trang."]) }
   let bounds = page.bounds(for: .mediaBox)
   let scale = 1800 / max(bounds.width, bounds.height)
   let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
   let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = true
   let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
    UIColor.white.setFill(); context.fill(CGRect(origin: .zero, size: size))
    context.cgContext.translateBy(x: 0, y: size.height)
    context.cgContext.scaleBy(x: scale, y: -scale)
    context.cgContext.translateBy(x: -bounds.origin.x, y: -bounds.origin.y)
    page.draw(with: .mediaBox, to: context.cgContext)
   }
   let output = FileManager.default.temporaryDirectory.appendingPathComponent("learnaccess-\(UUID().uuidString).jpg")
   guard let data = image.jpegData(compressionQuality: 0.9) else { throw NSError(domain: "LearnAccess", code: 5) }
   try data.write(to: output)
   return output.absoluteString
  }
 }
}
