import React from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import {
  Text,
  useTheme,
  Button,
  Icon,
  Chip,
  ActivityIndicator,
  RadioButton,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { Document } from "../domain/model";

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.screen}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Heading({
  title,
  subtitle,
  back = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
}) {
  return (
    <View style={{ gap: 8, marginBottom: 8 }}>
      {back && (
        <Button
          icon="arrow-left"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={{ alignSelf: "flex-start" }}
        >
          Quay lại
        </Button>
      )}
      <Text variant="headlineMedium" style={{ fontWeight: "800" }}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="bodyLarge" style={{ opacity: 0.7, lineHeight: 24 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

export function Panel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.panel, { backgroundColor: color ?? theme.colors.surface }]}
    >
      {children}
    </View>
  );
}

export function Empty({
  title,
  description,
  action,
  label = "Thêm tài liệu",
}: {
  title: string;
  description: string;
  action?: () => void;
  label?: string;
}) {
  const theme = useTheme();
  return (
    <Panel>
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 24 }}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Icon
            source="book-open-page-variant-outline"
            size={36}
            color={theme.colors.primary}
          />
        </View>
        <Text variant="titleLarge">{title}</Text>
        <Text style={{ textAlign: "center", opacity: 0.7, lineHeight: 24 }}>
          {description}
        </Text>
        {action && (
          <Button mode="contained" onPress={action}>
            {label}
          </Button>
        )}
      </View>
    </Panel>
  );
}

export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="alert"
      style={{
        padding: 14,
        borderRadius: 14,
        backgroundColor: error
          ? t.colors.errorContainer
          : t.colors.surfaceVariant,
        color: error ? t.colors.onErrorContainer : t.colors.onSurface,
        lineHeight: 22,
      }}
    >
      {text}
    </Text>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 40 }}>
      <ActivityIndicator />
      <Text style={{ textAlign: "center", marginTop: 12 }}>
        Đang mở tài liệu…
      </Text>
    </View>
  );
}

export function GuestBanner() {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        padding: 18,
        borderRadius: 24,
        gap: 12,
        borderWidth: 1.5,
        borderColor: t.colors.primary + "44",
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            backgroundColor: t.colors.primaryContainer ?? "#ede9fe",
            padding: 8,
            borderRadius: 12,
          }}
        >
          <Icon source="shield-account-outline" size={24} color={t.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: "700" }}>
            Chế độ Khách (Offline)
          </Text>
          <Text variant="bodySmall" style={{ opacity: 0.7 }}>
            Dữ liệu đang được lưu cục bộ trên thiết bị
          </Text>
        </View>
      </View>
      <Text style={{ opacity: 0.8, lineHeight: 21 }}>
        Đăng nhập tài khoản để mở khóa toàn bộ tính năng **AI tóm tắt**, **tạo đề trắc nghiệm Quiz**, và **đồng bộ tài liệu lên đám mây**.
      </Text>
      <Button
        mode="contained"
        icon="login"
        onPress={() => router.push("/auth")}
        style={{ alignSelf: "flex-start" }}
      >
        Đăng nhập / Đăng ký ngay
      </Button>
    </View>
  );
}

export function DocumentCard({
  document,
  selectionMode,
  selected,
  onToggleSelect,
  onLongPress,
  onShare,
}: {
  document: Document;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
  onShare?: () => void;
}) {
  const t = useTheme();
  const pending = document.serverVersion === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"Mở " + document.title}
      onPress={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect();
        } else {
          router.push(`/document/${document.id}`);
        }
      }}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.panel,
        {
          backgroundColor: t.colors.surface,
          opacity: pressed ? 0.7 : 1,
          borderWidth: selected ? 2 : 1,
          borderColor: selected
            ? t.colors.primary
            : (t.colors.outlineVariant ?? "rgba(150, 150, 150, 0.2)"),
        },
      ]}
    >
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        {selectionMode && (
          <RadioButton
            value={document.id}
            status={selected ? "checked" : "unchecked"}
            onPress={onToggleSelect}
          />
        )}
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: document.kind === "pdf" ? "#FFF0D5" : "#EAE5FF",
            },
          ]}
        >
          <Icon
            source={
              document.kind === "pdf"
                ? "file-pdf-box"
                : document.kind === "docx"
                ? "file-word-box"
                : "text-box-outline"
            }
            color="#5945C6"
            size={30}
          />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            variant="titleMedium"
            style={{ fontWeight: "700" }}
            numberOfLines={2}
          >
            {document.title}
          </Text>
          <Text variant="bodySmall" style={{ opacity: 0.65 }}>
            {document.pages.length || 1} trang ·{" "}
            {new Date(document.updatedAt).toLocaleDateString("vi-VN")}
            {document.favorite ? " · ★" : ""}
          </Text>
        </View>
        {!selectionMode && <Icon source="chevron-right" size={22} />}
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            flex: 1,
          }}
        >
          <Chip compact icon="check-circle-outline">
            Đã lưu trên máy
          </Chip>
          {document.folder && (
            <Chip compact icon="folder-outline">
              {document.folder}
            </Chip>
          )}
          {document.ai?.summary && (
            <Chip compact icon="creation">
              {document.ai.version === document.version
                ? "Có tóm tắt"
                : "Cần cập nhật AI"}
            </Chip>
          )}
          {document.ai?.quiz && (
            <Chip compact icon="help-circle-outline">
              Quiz
            </Chip>
          )}
          {document.isPublic && (
            <Chip compact icon="earth">
              Cộng đồng {document.likes ? `· ❤️ ${document.likes}` : ""}
            </Chip>
          )}
          {Boolean(document.originalId || document.title.includes("(Bản sao)")) && (
            <Chip compact icon="download-outline">
              Từ Cộng đồng
            </Chip>
          )}
          {document.ownerId !== "local" && (
            <Text variant="labelSmall">
              {pending ? "Chờ đồng bộ" : "Đã có bản đám mây"}
            </Text>
          )}
        </View>

        {!selectionMode && onShare && (
          <Button
            mode="outlined"
            compact
            icon={document.isPublic ? "earth" : "share-variant-outline"}
            textColor={document.isPublic ? t.colors.primary : undefined}
            onPress={onShare}
          >
            {document.isPublic ? "Đang chia sẻ" : "Chia sẻ"}
          </Button>
        )}
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: {
    padding: 24,
    paddingBottom: 110,
    gap: 20,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  panel: { padding: 20, borderRadius: 24, gap: 16 },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  wrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
