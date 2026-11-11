import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return response({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user)
      return response({ error: "Vui lòng đăng nhập lại." }, 401);

    const raw = await req.text();
    if (raw.length > 5_500_000)
      return response({ error: "Ảnh quá lớn để nhận diện." }, 413);
    const input = JSON.parse(raw) as {
      requestId?: string;
      imageBase64?: string;
      mimeType?: string;
    };
    if (
      !input.requestId?.match(/^[0-9a-f-]{36}$/i) ||
      !input.imageBase64 ||
      input.imageBase64.length > 4_000_000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(input.mimeType ?? "")
    )
      return response({ error: "Dữ liệu ảnh không hợp lệ." }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL");
    if (!apiKey || !model)
      return response({ error: "Dịch vụ AI chưa được cấu hình." }, 503);

    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(input.imageBase64),
        ),
      ),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: reservation, error: quotaError } = await admin.rpc(
      "reserve_ai",
      {
        p_owner: user.id,
        p_request: input.requestId,
        p_hash: hash,
        p_limit: Number(Deno.env.get("AI_DAILY_LIMIT") || 20),
      },
    );
    if (quotaError) {
      console.error("reserve_ai failed", quotaError.code, quotaError.message);
      const quotaReached = quotaError.message.includes(
        "Daily AI limit reached",
      );
      return response(
        {
          error: quotaReached
            ? "Đã hết lượt AI hôm nay."
            : "Chưa khởi tạo được lượt AI. Kiểm tra migration reserve_ai.",
        },
        quotaReached ? 429 : 503,
      );
    }
    if (reservation.cached)
      return reservation.result
        ? response(reservation.result)
        : response({ error: "Yêu cầu đang được xử lý." }, 409);

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Trích xuất trung thực toàn bộ chữ tiếng Việt hoặc tiếng Anh trong ảnh. Bỏ qua thanh công cụ và phần ngoài lề. Giữ các đoạn văn. Chỉ trả về phần chữ.",
                },
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: input.imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      },
    );
    const generated = await upstream.json();
    if (!upstream.ok) {
      console.error(
        "Gemini OCR failed",
        upstream.status,
        generated?.error?.message ?? "Unknown Gemini error",
      );
      return response(
        {
          error:
            upstream.status === 429
              ? "Gemini đã hết quota. Hãy thử lại sau."
              : "Gemini chưa nhận diện được ảnh này.",
        },
        502,
      );
    }
    const text = generated.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();
    if (!text) return response({ error: "Không tìm thấy chữ trong ảnh." }, 422);

    const result = { text };
    const { error: saveError } = await admin
      .from("ai_requests")
      .update({ result })
      .eq("id", input.requestId)
      .eq("owner_id", user.id);
    if (saveError)
      return response({ error: "Chưa lưu được kết quả OCR." }, 503);
    return response(result);
  } catch (error) {
    console.error(
      "ocr failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return response({ error: "Không xử lý được ảnh." }, 502);
  }
});
