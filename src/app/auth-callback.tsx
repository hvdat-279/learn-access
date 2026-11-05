import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Button, TextInput } from "react-native-paper";
import { Screen, Heading, Notice } from "../ui/components";
import { requireBackend } from "../data/supabase";
export default function Callback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    code
      ? "Đang xác nhận…"
      : "Liên kết thiếu mã xác nhận. Hãy yêu cầu email mới.",
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!code) return;
    void requireBackend()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        setMessage(
          error
            ? error.message
            : "Đã xác nhận. Bạn có thể đặt mật khẩu mới hoặc vào thư viện.",
        );
        setReady(!error);
      });
  }, [code]);
  return (
    <Screen>
      <Heading title="Xác nhận tài khoản" />
      <Notice text={message} />
      {ready && (
        <>
          <TextInput
            mode="outlined"
            label="Mật khẩu mới"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            disabled={password.length < 8}
            mode="contained"
            onPress={async () => {
              const { error } = await requireBackend().auth.updateUser({
                password,
              });
              if (error) setMessage(error.message);
              else router.replace("/profile");
            }}
          >
            Cập nhật mật khẩu
          </Button>
          <Button onPress={() => router.replace("/profile")}>
            Vào ứng dụng
          </Button>
        </>
      )}
    </Screen>
  );
}
