import { expect, test } from "@jest/globals";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { readFunctionFailure } from "../src/data/functions";

test("reads status and JSON errors from React Native response-like objects", async () => {
  const context = {
    status: 502,
    async json() {
      return { error: "Gemini chưa nhận diện được ảnh này." };
    },
  };

  await expect(
    readFunctionFailure(new FunctionsHttpError(context)),
  ).resolves.toEqual({
    message: "Gemini chưa nhận diện được ảnh này.",
    status: 502,
    retryable: true,
  });
});

test("falls back to a cloned text body when JSON parsing fails", async () => {
  const context = {
    status: 401,
    clone() {
      return {
        async text() {
          return JSON.stringify({ message: "Phiên đăng nhập không hợp lệ." });
        },
      };
    },
    async json() {
      throw new SyntaxError("not json");
    },
  };

  await expect(
    readFunctionFailure(new FunctionsHttpError(context)),
  ).resolves.toEqual({
    message: "Phiên đăng nhập không hợp lệ.",
    status: 401,
    retryable: false,
  });
});

test("keeps the HTTP status when the response body is unreadable", async () => {
  const context = {
    status: 413,
    async json() {
      throw new SyntaxError("not json");
    },
  };

  await expect(
    readFunctionFailure(new FunctionsHttpError(context)),
  ).resolves.toEqual({
    message: "Máy chủ phản hồi lỗi (413).",
    status: 413,
    retryable: false,
  });
});
