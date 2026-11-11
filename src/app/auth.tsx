import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  TextInput,
  SegmentedButtons,
  Text,
  Icon,
  useTheme,
} from "react-native-paper";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Screen, Heading, Panel, Notice } from "../ui/components";
import { requireBackend, configured } from "../data/supabase";
WebBrowser.maybeCompleteAuthSession();
export default function Auth() {
  const t = useTheme();
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
      <Panel accent>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: t.colors.surfaceVariant,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon source="school-outline" size={24} color={t.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              {mode === "login"
                ? "Đăng nhập tài khoản"
                : mode === "signup"
                  ? "Tạo tài khoản học tập"
                  : "Khôi phục mật khẩu"}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: t.colors.onSurfaceVariant }}
            >
              Đồng bộ thư viện & mở khóa tính năng AI
            </Text>
          </View>
        </View>
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
          outlineStyle={{ borderRadius: 14 }}
          value={email}
          onChangeText={setEmail}
        />
        {mode !== "reset" && (
          <TextInput
            label="Mật khẩu"
            mode="outlined"
            secureTextEntry
            outlineStyle={{ borderRadius: 14 }}
            value={password}
            onChangeText={setPassword}
          />
        )}
        <Button
          mode="contained"
          loading={busy}
          disabled={busy || !configured}
          contentStyle={{ height: 46 }}
          style={{ borderRadius: 14 }}
          onPress={() => perform(submit)}
        >
          {mode === "login"
            ? "Đăng nhập"
            : mode === "signup"
              ? "Tạo tài khoản"
              : "Gửi email khôi phục"}
        </Button>
        <Button
          compact
          onPress={() => setMode(mode === "reset" ? "login" : "reset")}
        >
          {mode === "reset" ? "Quay lại đăng nhập" : "Quên mật khẩu?"}
        </Button>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.outlineVariant }} />
          <Text variant="labelSmall" style={{ color: t.colors.onSurfaceVariant }}>
            hoặc
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.outlineVariant }} />
        </View>
        <Button
          icon="google"
          mode="outlined"
          disabled={busy || !configured}
          contentStyle={{ height: 46 }}
          style={{ borderRadius: 14 }}
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
