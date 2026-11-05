# LearnAccess

Ứng dụng học tập React Native + Expo Router: nhập tài liệu → OCR offline → sửa văn bản → AI tóm tắt có đối chiếu nguồn → đọc/nghe → lưu và đồng bộ.

## Chạy ứng dụng

Yêu cầu Node.js 24 và npm. Routes nằm trong `src/app/`.

```bash
npm ci
npm start
```

- `npm run web`: xem giao diện, thư viện văn bản và tùy chỉnh trên trình duyệt. Adapter web lưu văn bản thực trong localStorage; SQLite, OCR/PDF và đồng bộ file dùng trên Android/iPhone. Web **không thay thế** kiểm thử native OCR/PDF/file và TTS trên điện thoại.
- Android/iPhone: dùng **Expo Development Build**. Expo Go không chứa module `LearnAccessNative`.
- Chưa điền key: ứng dụng vẫn cho dùng thư viện cục bộ, dán/sửa văn bản, tìm kiếm, yêu thích và tùy chỉnh đọc. Native OCR/PDF không cần API key nhưng cần development/preview build.
- `preview` APK là bản độc lập, không cần máy tính chạy Metro. `development` cần Metro.

## Điền cấu hình sau

Đã có `.env` trống trên workspace; file này không được đưa vào Git. Khi clone lại, sao chép `.env.example` thành `.env`.

| Biến                            | Điền ở đâu                     | Công dụng                                                        |
| ------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | `.env`                         | URL project Supabase                                             |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env`                         | Anon/public key, có thể nằm trong ứng dụng; RLS bảo vệ dữ liệu   |
| `EXPO_PUBLIC_EAS_PROJECT_ID`    | `.env` / GitHub Variables      | ID project Expo dùng để build                                    |
| `EXPO_ACCOUNT_OWNER`            | `.env` / GitHub Variables      | Tên tài khoản hoặc tổ chức Expo                                  |
| `GEMINI_API_KEY`                | Supabase Edge Function Secrets | Khóa AI, **không đặt trong ứng dụng**                            |
| `GEMINI_MODEL`                  | Supabase Edge Function Secrets | ID model Gemini hỗ trợ structured output trong tài khoản của bạn |
| `AI_DAILY_LIMIT`                | Supabase Edge Function Secrets | Mặc định 20 yêu cầu/tài khoản/ngày UTC                           |

Không cần mật khẩu PostgreSQL hay service-role key trong ứng dụng. Sau khi đổi `.env`, khởi động lại Expo bằng `npm start -- --clear`; bản APK đã build cần build lại để cập nhật public env.

## Thiết lập Supabase

1. Tạo project, lấy URL và anon key cho `.env`.
2. Chạy migration `supabase/migrations/202611030001_initial.sql` trong SQL Editor, hoặc dùng Supabase CLI:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   npx supabase functions deploy study
   ```

3. Trong Edge Functions → Secrets, điền `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_LIMIT`. Các biến `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` do Supabase cung cấp cho function, không sao chép vào app.
4. Authentication → URL Configuration: cho phép `learnaccess://auth-callback` (và URL localhost callback nếu thử web).
5. Bật email/password; thiết lập email gửi xác nhận/khôi phục phù hợp. Nếu dùng Google, bật Google provider và cấu hình OAuth client/redirect của Supabase.
6. Storage bucket riêng tư `documents` và RLS được migration tạo tự động.

Local documents không tự bị đưa vào tài khoản vừa đăng nhập. Người dùng bấm **Cá nhân → Nhập tài liệu cục bộ vào tài khoản** để chuyển rõ ràng.

## Build APK từ GitHub

Workflow: `.github/workflows/build-apk.yml` → **Actions → Build Android APK → Run workflow**. GitHub điều phối build trên Expo và đính kèm APK vào Artifacts.

Cấu hình ban đầu một lần:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest credentials --platform android
```

Tạo/liên kết Expo project và tạo keystore Android từ mục credentials để build non-interactive có đủ thông tin. Nếu CLI cần hoàn tất thiết lập build lần đầu, làm theo hướng dẫn của Expo; không đưa keystore/mật khẩu vào Git.

GitHub → Settings → Secrets and variables → Actions:

**Secrets**

- `EXPO_TOKEN`: access token tài khoản Expo có quyền build project.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: anon key Supabase; có thể để trống khi chỉ build bản dùng cục bộ.

**Variables**

- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `EXPO_ACCOUNT_OWNER`
- `EXPO_PUBLIC_SUPABASE_URL` (có thể để trống khi chưa cấu hình backend)

Workflow truyền các public env tới worker build. Không truyền `GEMINI_API_KEY` hoặc service-role key. Chọn `preview` để nhận APK độc lập; chọn `development` để nhận bản dùng với `npm start`.

Cho iPhone: dùng profile development/preview và cấu hình Apple signing, provisioning, thiết bị trên Expo. Việc có mã nguồn iOS không đồng nghĩa đã ký/cài hoặc nghiệm thu trên iPhone.

## Cấu trúc

```text
src/app/          Màn hình Expo Router
src/ui/           Theme, component, session, UI state
src/domain/       Mô hình, interface, phiên bản văn bản, kiểm tra nguồn AI
src/data/         SQLite/Drizzle, file, native adapter, AI và sync
modules/          Module ML Kit + PdfRenderer/PDFKit
supabase/         Migration, RLS, RPC đồng bộ và Edge Function
.github/workflows/ Kiểm tra mã và build APK
```

SQLite lưu Document cùng Page, Block, AiResult, ReadingProgress trong một aggregate JSON; outbox và preferences có bảng riêng. Lưu aggregate và enqueue cùng transaction. Thiết kế này giảm rủi ro lưu dở một tài liệu nhiều trang và giữ đúng các thực thể nghiệp vụ trong báo cáo.

## Các lệnh kiểm tra khi cần

```bash
npm run typecheck
npm run lint
npm test
npm run test:backend
```

Tests đã chuẩn bị để chạy khi cần; không cần API key. Backend test dùng PostgreSQL nhúng để kiểm tra migration/RLS/version/quota, không thay thế staging Supabase. Chưa có nghiệm thu end-to-end với tài khoản thật hoặc trên hai điện thoại. Chi tiết: [tình trạng triển khai](docs/IMPLEMENTATION.md), [báo cáo 1](docs/REPORT-1.md), [kịch bản demo](docs/DEMO.md).
