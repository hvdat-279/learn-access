import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { requireBackend } from "./supabase";

type FunctionFailure = {
  message: string;
  status?: number;
  retryable?: boolean;
};

type ResponseLike = {
  status?: unknown;
  clone?: () => ResponseLike;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

function messageFromBody(body: unknown): string | undefined {
  if (typeof body === "string") return body.trim() || undefined;
  if (!body || typeof body !== "object") return undefined;
  const value = body as {
    error?: unknown;
    message?: unknown;
  };
  if (typeof value.error === "string") return value.error;
  if (
    value.error &&
    typeof value.error === "object" &&
    "message" in value.error &&
    typeof value.error.message === "string"
  )
    return value.error.message;
  return typeof value.message === "string" ? value.message : undefined;
}

async function responseMessage(
  context: ResponseLike,
): Promise<string | undefined> {
  let copy: ResponseLike | undefined;
  try {
    copy = context.clone?.();
  } catch {}

  if (context.json) {
    try {
      const message = messageFromBody(await context.json());
      if (message) return message;
    } catch {}
  }

  const textSource = copy ?? context;
  if (!textSource.text) return undefined;
  try {
    const body = (await textSource.text()).trim();
    if (!body || body.startsWith("<")) return undefined;
    try {
      return messageFromBody(JSON.parse(body));
    } catch {
      return body.length <= 300 ? body : undefined;
    }
  } catch {
    return undefined;
  }
}

export async function readFunctionFailure(
  error: unknown,
): Promise<FunctionFailure> {
  if (error instanceof FunctionsHttpError) {
    const context = error.context as ResponseLike;
    const status =
      typeof context?.status === "number" ? context.status : undefined;
    const message = context ? await responseMessage(context) : undefined;
    return {
      message:
        message ?? `Máy chủ phản hồi lỗi${status ? ` (${status})` : ""}.`,
      status,
      retryable: status === undefined || status >= 500,
    };
  }
  if (error instanceof FunctionsRelayError)
    return { message: "Supabase chưa chuyển được yêu cầu.", retryable: true };
  if (error instanceof FunctionsFetchError)
    return {
      message: "Không kết nối được tới máy chủ. Hãy kiểm tra mạng.",
      retryable: true,
    };
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
      const failure = await readFunctionFailure(error);
      if (failure.status === 401 && attempt === 0) {
        const { error: refreshError } = await client.auth.refreshSession();
        if (!refreshError) continue;
      }
      if (failure.retryable && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw new Error(failure.message);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Không thể xử lý yêu cầu.");
}
