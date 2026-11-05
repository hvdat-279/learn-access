import { useState } from "react";
import { Button, TextInput, SegmentedButtons, Text } from "react-native-paper";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Screen, Heading, Panel, Notice } from "../ui/components";
import { requireBackend, configured } from "../data/supabase";
WebBrowser.maybeCompleteAuthSession();
export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    const client = requireBackend();
    if (!email.trim()) throw new Error("Hãy nhập email.");
    if (mode === "reset") {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL("auth-callback"),
      });
      if (error) throw error;
      setMessage("Kiểm tra email để đặt lại mật khẩu.");
      return;
    }
    if (password.length < 8) throw new Error("Mật khẩu cần ít nhất 8 ký tự.");
    const result =
      mode === "login"
        ? await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        : await client.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: Linking.createURL("auth-callback") },
          });
    if (result.error) throw result.error;
    if (result.data.session) router.replace("/profile");
    else
      setMessage(
        "Kiểm tra email để xác nhận tài khoản, sau đó quay lại đăng nhập.",
      );
  }
  return (
    <Screen>
      <Heading
        back
        title="Chào mừng bạn"
        subtitle="Mang thư viện theo bạn, trên mọi thiết bị."
      />
      <Panel>
        <SegmentedButtons
          value={mode}
          onValueChange={setMode}
          buttons={[
            { value: "login", label: "Đăng nhập" },
            { value: "signup", label: "Đăng ký" },
          ]}
        />
        <TextInput
          label="Email"
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        {mode !== "reset" && (
          <TextInput
            label="Mật khẩu"
            mode="outlined"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}
        <Button
          mode="contained"
          loading={busy}
          disabled={busy || !configured}
          onPress={() => perform(submit)}
        >
          {mode === "login"
            ? "Đăng nhập"
            : mode === "signup"
              ? "Tạo tài khoản"
              : "Gửi email khôi phục"}
        </Button>
        <Button onPress={() => setMode(mode === "reset" ? "login" : "reset")}>
          {mode === "reset" ? "Quay lại đăng nhập" : "Quên mật khẩu?"}
        </Button>
        <Text style={{ textAlign: "center", opacity: 0.5 }}>hoặc</Text>
        <Button
          icon="google"
          mode="outlined"
          disabled={busy || !configured}
          onPress={() =>
            perform(async () => {
              const client = requireBackend();
              const redirectTo = Linking.createURL("auth-callback");
              const { data, error } = await client.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo, skipBrowserRedirect: true },
              });
              if (error) throw error;
              if (data.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                  data.url,
                  redirectTo,
                );
                if (result.type === "success") {
                  const code = new URL(result.url).searchParams.get("code");
                  if (!code) throw new Error("Không nhận được mã đăng nhập.");
                  const { error } =
                    await client.auth.exchangeCodeForSession(code);
                  if (error) throw error;
                  router.replace("/profile");
                }
              }
            })
          }
        >
          Tiếp tục với Google
        </Button>
      </Panel>
      {!configured && (
        <Notice text="Dịch vụ tài khoản chưa được cấu hình. Bạn vẫn có thể dùng thư viện cục bộ; thêm biến môi trường Supabase để bật đăng nhập." />
      )}
      {!!message && <Notice text={message} />}
      {!!error && <Notice error text={error} />}
    </Screen>
  );
}
