import { useEffect, useState } from "react";
import { View, ScrollView } from "react-native";
import {
  Button,
  Text,
  Switch,
  Chip,
  RadioButton,
  TextInput,
  useTheme,
} from "react-native-paper";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { Screen, Heading, Panel, Notice } from "../../ui/components";
import { useAuth, refreshDocuments, queryClient } from "../../ui/provider";
import { useSettings } from "../../ui/store";
import { supabase } from "../../data/supabase";
import { sync, pendingCount } from "../../data/sync";
import { repository } from "../../data/repository";
import * as Crypto from "expo-crypto";
export default function Profile() {
  const t = useTheme();
  const { ownerId, email } = useAuth();
  const settings = useSettings();
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = pendingCount(ownerId);
  useEffect(() => {
    void Speech.getAvailableVoicesAsync()
      .then(setVoices)
      .catch(() => {});
    return () => {
      void Speech.stop();
    };
  }, []);
  useEffect(() => {
    if (ownerId === "local") return;
    void supabase?.auth.getSession().then(({ data }) => {
      setDisplayName(data.session?.user.user_metadata?.display_name ?? "");
    });
  }, [ownerId]);
  async function task(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Heading
        title="Góc học tập của bạn"
        subtitle="Điều chỉnh để việc học dễ chịu hơn."
      />
      <Panel>
        <Text variant="titleLarge">{email || "Thư viện trên thiết bị"}</Text>
        <Text style={{ opacity: 0.7, lineHeight: 24 }}>
          {ownerId === "local"
            ? "Bạn đang dùng cục bộ. Đăng nhập để tạo nội dung AI và đồng bộ tài liệu."
            : "Tài liệu được lưu trên máy và đồng bộ vào tài khoản của bạn."}
        </Text>
        {ownerId === "local" ? (
          <Button mode="contained" onPress={() => router.push("/auth")}>
            Đăng nhập / Đăng ký
          </Button>
        ) : (
          <>
            <TextInput
              mode="outlined"
              label="Tên hiển thị"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={80}
            />
            <Button
              disabled={busy || !displayName.trim()}
              onPress={() =>
                task(async () => {
                  const { error } = await supabase!.auth.updateUser({
                    data: { display_name: displayName.trim() },
                  });
                  if (error) throw error;
                  setMessage("Đã cập nhật hồ sơ.");
                })
              }
            >
              Lưu hồ sơ
            </Button>
            <Text>{pending} thao tác chờ đồng bộ</Text>
            <Button
              mode="contained"
              icon="sync"
              loading={busy}
              disabled={busy}
              onPress={() =>
                task(async () => {
                  await sync.run(ownerId);
                  await refreshDocuments();
                  setMessage("Đã đồng bộ thư viện.");
                })
              }
            >
              Đồng bộ ngay
            </Button>
            <Button
              disabled={busy}
              onPress={() =>
                task(async () => {
                  const local = await repository.list("local");
                  for (const d of local) {
                    const copy = {
                      ...d,
                      id: Crypto.randomUUID(),
                      ownerId,
                      serverVersion: 0,
                      pages: d.pages.map((p) => ({
                        ...p,
                        id: Crypto.randomUUID(),
                        remotePath: undefined,
                      })),
                    };
                    await repository.save(copy);
                    await repository.save({ ...d, deleted: true }, false);
                  }
                  await refreshDocuments();
                  setMessage(
                    `Đã nhập ${local.length} tài liệu cục bộ vào tài khoản.`,
                  );
                })
              }
            >
              Nhập tài liệu cục bộ vào tài khoản
            </Button>
          </>
        )}
      </Panel>
      <Panel>
        <Text variant="titleLarge">Không gian đọc</Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text>Giao diện tối</Text>
          <Switch
            accessibilityLabel="Giao diện tối"
            value={settings.dark}
            onValueChange={(dark) => settings.change({ dark })}
          />
        </View>
        <Text>Cỡ chữ</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {[16, 18, 22, 26, 32].map((fontSize) => (
            <Chip
              key={fontSize}
              selected={settings.fontSize === fontSize}
              onPress={() => settings.change({ fontSize })}
            >
              {fontSize}
            </Chip>
          ))}
        </View>
        <Text>Giãn dòng</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[1.4, 1.7, 2].map((lineHeight) => (
            <Chip
              key={lineHeight}
              selected={settings.lineHeight === lineHeight}
              onPress={() => settings.change({ lineHeight })}
            >
              {lineHeight}
            </Chip>
          ))}
        </View>
        <Text
          style={{
            fontSize: settings.fontSize,
            lineHeight: settings.fontSize * settings.lineHeight,
          }}
        >
          Học theo nhịp của bạn. Mỗi trang sách là một khởi đầu mới.
        </Text>
      </Panel>
      <Panel>
        <Text variant="titleLarge">Giọng đọc</Text>
        <View
          style={{
            maxHeight: 220,
            borderWidth: 1,
            borderColor: t.colors.outlineVariant ?? "rgba(150, 150, 150, 0.25)",
            borderRadius: 12,
            overflow: "hidden",
            marginVertical: 6,
          }}
        >
          <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }}>
            <RadioButton.Group
              value={settings.voice}
              onValueChange={(voice) => settings.change({ voice })}
            >
              <RadioButton.Item label="Mặc định của thiết bị" value="" />
              {voices
                .filter(
                  (v) => v.language.startsWith("vi") || v.language.startsWith("en"),
                )
                .map((v) => (
                  <RadioButton.Item
                    key={v.identifier}
                    label={v.name + " · " + v.language}
                    value={v.identifier}
                  />
                ))}
            </RadioButton.Group>
          </ScrollView>
        </View>
        <Button
          icon="volume-high"
          onPress={() => {
            void Speech.stop().then(() =>
              Speech.speak(
                "Chào bạn, cùng LearnAccess học một điều mới hôm nay.",
                {
                  language: "vi-VN",
                  voice: settings.voice || undefined,
                  rate: settings.rate,
                  onError: () =>
                    setMessage(
                      "Không phát được giọng đọc. Kiểm tra cài đặt giọng nói trên thiết bị.",
                    ),
                },
              ),
            );
          }}
        >
          Thử giọng đọc
        </Button>
        <Text style={{ opacity: 0.7, lineHeight: 22 }}>
          Để nghe offline, tải giọng tiếng Việt trong cài đặt giọng nói của
          thiết bị rồi thử ở chế độ máy bay. Trên iPhone, kiểm tra chế độ im
          lặng nếu không có âm thanh.
        </Text>
      </Panel>
      {!!message && <Notice text={message} />}
      {ownerId !== "local" && (
        <Button
          textColor="#B3261E"
          disabled={busy}
          onPress={() =>
            task(async () => {
              await Speech.stop();
              await queryClient.cancelQueries();
              const { error } = await supabase!.auth.signOut({
                scope: "local",
              });
              if (error) throw error;
              queryClient.clear();
              router.replace("/");
            })
          }
        >
          Đăng xuất trên thiết bị
        </Button>
      )}
      <Text style={{ textAlign: "center", opacity: 0.5 }}>
        LearnAccess · Học tập dễ tiếp cận
      </Text>
    </Screen>
  );
}
