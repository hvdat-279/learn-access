import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { requireBackend } from "./supabase";

type FunctionFailure = { message: string; status?: number };

async function readFailure(error: unknown): Promise<FunctionFailure> {
  if (error instanceof FunctionsHttpError) {
    const status =
      error.context instanceof Response ? error.context.status : undefined;
    try {
      const body = await error.context.json();
      if (typeof body?.error === "string")
        return { message: body.error, status };
    } catch {}
    return {
      message: `Máy chủ phản hồi lỗi${status ? ` (${status})` : ""}.`,
      status,
    };
  }
  if (error instanceof FunctionsRelayError)
    return { message: "Supabase chưa chuyển được yêu cầu." };
  if (error instanceof FunctionsFetchError)
    return { message: "Không kết nối được tới máy chủ. Hãy kiểm tra mạng." };
  return {
    message: error instanceof Error ? error.message : "Không gọi được dịch vụ.",
  };
}

export async function invokeAuthenticated<T>(
  name: string,
  body: Record<string, unknown>,
  timeoutMs = 50000,
): Promise<T> {
  const client = requireBackend();
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();
  if (sessionError || !sessionData.session)
    throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { data, error } = await client.functions.invoke(name, {
        body,
        signal: controller.signal,
      });
      if (!error) {
        if (data?.error) throw new Error(String(data.error));
        if (!data) throw new Error("Dịch vụ không trả về dữ liệu.");
        return data as T;
      }
      const failure = await readFailure(error);
      if (failure.status === 401 && attempt === 0) {
        const { error: refreshError } = await client.auth.refreshSession();
        if (!refreshError) continue;
      }
      throw new Error(failure.message);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Không thể xử lý yêu cầu.");
}
