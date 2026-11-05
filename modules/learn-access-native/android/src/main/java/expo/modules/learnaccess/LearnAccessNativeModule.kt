package expo.modules.learnaccess

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.tasks.await
import java.io.File
import java.util.UUID

class LearnAccessNativeModule : Module() {
 private fun localFile(uri: String): File {
  val parsed = Uri.parse(uri)
  require(parsed.scheme == "file") { "Only local files are supported" }
  return File(requireNotNull(parsed.path))
 }
 override fun definition() = ModuleDefinition {
  Name("LearnAccessNative")
  AsyncFunction("recognize") Coroutine { uri: String ->
   val context = requireNotNull(appContext.reactContext)
   val image = InputImage.fromFilePath(context, Uri.fromFile(localFile(uri)))
   val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
   try { recognizer.process(image).await().textBlocks.map { it.text } }
   finally { recognizer.close() }
  }
  AsyncFunction("pageCount") { uri: String ->
   ParcelFileDescriptor.open(localFile(uri), ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
    PdfRenderer(descriptor).use { renderer -> renderer.pageCount }
   }
  }
  AsyncFunction("renderPage") { uri: String, index: Int ->
   val context = requireNotNull(appContext.reactContext)
   ParcelFileDescriptor.open(localFile(uri), ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
    PdfRenderer(descriptor).use { renderer ->
     require(renderer.pageCount in 1..5) { "PDF must have 1 to 5 pages" }
     renderer.openPage(index).use { page ->
      val scale = 1800.0 / maxOf(page.width, page.height)
      val bitmap = Bitmap.createBitmap(maxOf(1,(page.width*scale).toInt()), maxOf(1,(page.height*scale).toInt()), Bitmap.Config.ARGB_8888)
      try {
       bitmap.eraseColor(Color.WHITE)
       page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
       val output = File(context.cacheDir,"learnaccess-${UUID.randomUUID()}.jpg")
       output.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG,90,it) }
       Uri.fromFile(output).toString()
      } finally { bitmap.recycle() }
     }
    }
   }
  }
 }
}
