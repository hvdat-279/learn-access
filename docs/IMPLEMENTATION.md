# Tình trạng triển khai

## Đã có mã nguồn

- Expo Router, Material 3, giao diện học tập tím chàm/vàng, Dark Mode.
- Trang chủ, thư viện, tìm tên/nội dung, yêu thích, đổi tên và xóa tài liệu.
- Tạo tài liệu từ camera, thư viện ảnh, PDF; xem trước, đổi thứ tự, xoay/bỏ trang.
- Module Android ML Kit Latin OCR đóng gói trên thiết bị và PdfRenderer; module iOS ML Kit/PDFKit.
- OCR tuần tự, lưu sau mỗi trang, trạng thái lỗi, thử lại trang chưa hoàn thành và hủy sau tác vụ đang chạy.
- Đối chiếu ảnh, sửa từng đoạn và giữ nguyên OCR gốc.
- Tóm tắt theo trang được chọn, thuật ngữ, diễn giải đoạn, dẫn nguồn theo block ID.
- Xác nhận gửi nội dung tới AI; schema validation, kiểm tra nguồn và phiên bản trước khi lưu.
- TTS từng đoạn, chuyển đoạn, tốc độ, lựa chọn giọng và lưu vị trí cục bộ.
- Email/password, xác nhận, khôi phục, Google OAuth và tên hiển thị qua Supabase.
- Lưu SQLite/Drizzle, outbox, retry, bản sao khi xung đột, tombstone, file riêng tư và RLS.
- Workflow build APK qua GitHub → Expo; public configuration để trống, server secrets tách khỏi app.

## Những điểm cần nghiệm thu sau khi cấu hình

Mã nguồn tích hợp không phải bằng chứng tính năng đã chạy trên dịch vụ/thiết bị thật.

- Native Android/iOS: compile, cài, quyền camera/thư viện, OCR tiếng Việt, PDF lỗi/khóa, RAM và tiếng đọc offline.
- Supabase thật: email, deep link, Google OAuth, refresh session, Storage và hai thiết bị đồng bộ.
- Gemini thật: model ID, schema hỗ trợ, độ đúng của bản tóm tắt/nguồn, timeout và quota.
- Accessibility: VoiceOver/TalkBack, cỡ chữ hệ thống lớn và tương phản trên máy thật.
- OCR: chưa đo CER; mục tiêu <=10% trên ảnh in rõ chưa được chứng minh.
- Chưa có APK đã nghiệm thu, bản iOS ký số hay video quay thiết bị. Theo yêu cầu hiện tại, build APK thực hiện qua GitHub sau khi điền cấu hình.

## Giới hạn có chủ đích

- Web là bản xem trước với localStorage và văn bản do người dùng nhập; không có OCR/PDF hoặc đồng bộ file. Bản native dùng SQLite/Drizzle như thiết kế.

- 5 trang và 20 MB/file. PDF render từng trang trước OCR; chưa xử lý cấu trúc bảng/công thức/chữ viết tay.
- 30.000 ký tự cho mỗi yêu cầu tóm tắt; chọn trang trong màn hình Tóm tắt để giảm đầu vào.
- AI cần mạng. TTS offline phụ thuộc giọng đã tải; app không tự tạo hay tải file MP3.
- Chỉ nghe foreground. Tiếp tục đọc lại đầu đoạn; không phát nền hoặc điều khiển màn hình khóa.
- Đồng bộ khi foreground, khi mạng trở lại, khi sửa dữ liệu và bằng nút thủ công; không cam kết chạy sau khi hệ điều hành đóng app.
- Tiến trình nghe được ưu tiên giữ trên thiết bị đang sử dụng; không có đồng bộ realtime vị trí nghe giữa máy.
- Xóa là tombstone; file và bản ghi cục bộ không bị purge ngay. Chính sách dọn file/retention là bước bổ sung trước vận hành lâu dài.
- Đồng bộ hiện tải metadata toàn bộ thư viện; chưa có phân trang cho thư viện rất lớn.
- Quiz/flashcards vẫn là Could-Have, chưa bật trong phiên bản này.

## Kiểm tra đã thực hiện trước khi chuyển sang ưu tiên code

- TypeScript và lint đã qua tại mốc triển khai ban đầu; sẽ chạy lại cho thay đổi cuối theo AGENTS.md.
- 13 ca nghiệp vụ: file limits, edit version, source validation, stale AI và TTS.
- 6 ca PostgreSQL nhúng: idempotency, RLS tài liệu/file, chặn ghi trực tiếp, xung đột, tombstone, quota.
- Bundle JavaScript Android/iOS thành công tại mốc ban đầu; không tương đương native build.
- Edge Function qua `deno check` tại mốc ban đầu.

## Tài liệu kỹ thuật tham chiếu

- Expo SDK 58: https://docs.expo.dev/versions/v58.0.0/
- Development builds: https://docs.expo.dev/develop/development-builds/introduction/
- CI build: https://docs.expo.dev/build/building-on-ci/
- SQLite web headers: https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/
- ML Kit languages: https://developers.google.com/ml-kit/vision/text-recognition/v2/languages
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
