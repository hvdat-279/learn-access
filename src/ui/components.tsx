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

// ─── Screen wrapper ──────────────────────────────────────────────────────────
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
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 8 }}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Heading ─────────────────────────────────────────────────────────────────
export function Heading({
  title,
  subtitle,
  back = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      {back && (
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginLeft: -4,
            borderRadius: 10,
            backgroundColor: pressed ? t.colors.surfaceVariant : "transparent",
          })}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Icon source="arrow-left" size={20} color={t.colors.primary} />
          <Text
            variant="labelLarge"
            style={{ color: t.colors.primary, fontWeight: "700" }}
          >
            Quay lại
          </Text>
        </Pressable>
      )}
      <Text
        variant="headlineMedium"
        style={{ fontWeight: "800", letterSpacing: -0.4 }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          variant="bodyLarge"
          style={{
            color: t.colors.onSurfaceVariant,
            lineHeight: 23,
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

// ─── Panel / Card ─────────────────────────────────────────────────────────────
export function Panel({
  children,
  color,
  accent,
}: {
  children: React.ReactNode;
  color?: string;
  accent?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.panel,
        !theme.dark && styles.cardShadow,
        {
          backgroundColor: color ?? theme.colors.surface,
          borderColor: accent
            ? theme.colors.primary + "45"
            : theme.colors.outlineVariant,
        },
      ]}
    >
      {children}
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
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
      <View style={{ alignItems: "center", gap: 14, paddingVertical: 28 }}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: theme.colors.surfaceVariant,
              width: 72,
              height: 72,
              borderRadius: 24,
            },
          ]}
        >
          <Icon
            source="book-open-page-variant-outline"
            size={36}
            color={theme.colors.primary}
          />
        </View>
        <Text
          variant="titleLarge"
          style={{ fontWeight: "700", textAlign: "center" }}
        >
          {title}
        </Text>
        <Text
          style={{
            textAlign: "center",
            color: theme.colors.onSurfaceVariant,
            lineHeight: 22,
            maxWidth: 300,
          }}
        >
          {description}
        </Text>
        {action && (
          <Button
            mode="contained"
            icon="plus"
            onPress={action}
            contentStyle={{ height: 46 }}
            style={{ borderRadius: 14, marginTop: 4 }}
          >
            {label}
          </Button>
        )}
      </View>
    </Panel>
  );
}

// ─── Notice / Alert ───────────────────────────────────────────────────────────
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 14,
        borderRadius: 14,
        backgroundColor: error
          ? t.colors.errorContainer
          : t.colors.surfaceVariant,
        alignItems: "flex-start",
      }}
    >
      <Icon
        source={error ? "alert-circle-outline" : "information-outline"}
        size={20}
        color={error ? t.colors.onErrorContainer : t.colors.primary}
      />
      <Text
        accessibilityRole="alert"
        style={{
          flex: 1,
          color: error ? t.colors.onErrorContainer : t.colors.onSurface,
          lineHeight: 22,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────
export function Loading() {
  const t = useTheme();
  return (
    <View
      style={{
        padding: 40,
        alignItems: "center",
        gap: 14,
      }}
    >
      <ActivityIndicator size="large" color={t.colors.primary} />
      <Text
        variant="bodyMedium"
        style={{ textAlign: "center", color: t.colors.onSurfaceVariant }}
      >
        Đang tải…
      </Text>
    </View>
  );
}

// ─── Guest banner ─────────────────────────────────────────────────────────────
export function GuestBanner() {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.secondaryContainer,
        padding: 18,
        borderRadius: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: t.colors.secondary + "44",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            backgroundColor: t.colors.secondary + "22",
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon source="school-outline" size={24} color={t.colors.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            variant="titleSmall"
            style={{ fontWeight: "800", color: t.colors.onSecondaryContainer }}
          >
            Chế độ Khách · Offline
          </Text>
          <Text
            variant="bodySmall"
            style={{
              color: t.colors.onSecondaryContainer,
              opacity: 0.8,
              lineHeight: 18,
            }}
          >
            Dữ liệu được lưu riêng trên thiết bị này
          </Text>
        </View>
      </View>
      <Text
        style={{
          lineHeight: 21,
          color: t.colors.onSecondaryContainer,
          opacity: 0.9,
          fontSize: 13,
        }}
      >
        Đăng nhập để mở khóa{" "}
        <Text style={{ fontWeight: "700", color: t.colors.onSecondaryContainer }}>
          AI tóm tắt
        </Text>
        ,{" "}
        <Text style={{ fontWeight: "700", color: t.colors.onSecondaryContainer }}>
          tạo Quiz
        </Text>{" "}
        và{" "}
        <Text style={{ fontWeight: "700", color: t.colors.onSecondaryContainer }}>
          đồng bộ đám mây
        </Text>
        .
      </Text>
      <Button
        mode="contained"
        icon="login"
        buttonColor={t.colors.secondary}
        textColor={t.dark ? "#1A0E00" : "#FFFFFF"}
        onPress={() => router.push("/auth")}
        contentStyle={{ height: 42 }}
        style={{ alignSelf: "flex-start", borderRadius: 12 }}
      >
        Đăng nhập / Đăng ký
      </Button>
    </View>
  );
}

// ─── Kind styling helper ──────────────────────────────────────────────────────
export function getDocumentKindStyle(kind: Document["kind"], dark: boolean) {
  if (kind === "pdf") {
    return {
      icon: "file-pdf-box",
      color: dark ? "#FB923C" : "#EA6332",
      bg: dark ? "#4A2310" : "#FFEDD5",
    };
  }
  if (kind === "docx") {
    return {
      icon: "file-word-box",
      color: dark ? "#38BDF8" : "#0284C7",
      bg: dark ? "#0C334A" : "#E0F2FE",
    };
  }
  return {
    icon: "text-box-outline",
    color: dark ? "#34D399" : "#0B8775",
    bg: dark ? "#0F3D34" : "#CCFBF1",
  };
}

// ─── DocumentCard ─────────────────────────────────────────────────────────────
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
  const kindStyle = getDocumentKindStyle(document.kind, t.dark);

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
        !t.dark && styles.cardShadow,
        {
          backgroundColor: t.colors.surface,
          opacity: pressed ? 0.78 : 1,
          borderColor: selected ? t.colors.primary : t.colors.outlineVariant,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      {/* Top row: icon + title + chevron */}
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        {selectionMode && (
          <RadioButton
            value={document.id}
            status={selected ? "checked" : "unchecked"}
            onPress={onToggleSelect}
          />
        )}
        <View style={[styles.iconBox, { backgroundColor: kindStyle.bg }]}>
          <Icon source={kindStyle.icon} color={kindStyle.color} size={28} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text
            variant="titleMedium"
            style={{ fontWeight: "700", lineHeight: 22 }}
            numberOfLines={2}
          >
            {document.title}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: t.colors.onSurfaceVariant }}
          >
            {document.pages.length || 1} trang ·{" "}
            {new Date(document.updatedAt).toLocaleDateString("vi-VN")}
            {document.favorite ? " · Yêu thích" : ""}
          </Text>
        </View>
        {!selectionMode && (
          <Icon
            source="chevron-right"
            size={20}
            color={t.colors.onSurfaceVariant}
          />
        )}
      </View>

      {/* Chips row */}
      <View style={styles.chipRow}>
        <StatusChip icon="check-circle-outline" label="Đã lưu" tone="success" />
        {document.folder && (
          <StatusChip icon="folder-outline" label={document.folder} />
        )}
        {document.ai?.summary && (
          <StatusChip
            icon="creation"
            label={
              document.ai.version === document.version
                ? "Có tóm tắt"
                : "Cần cập nhật AI"
            }
            tone={
              document.ai.version === document.version ? "primary" : "warning"
            }
          />
        )}
        {document.ai?.quiz && (
          <StatusChip
            icon="help-circle-outline"
            label="Quiz"
            tone="accent"
          />
        )}
        {document.isPublic && (
          <StatusChip
            icon="earth"
            label={
              document.likes ? `Cộng đồng · ${document.likes} thích` : "Cộng đồng"
            }
            tone="primary"
          />
        )}
        {Boolean(document.originalId || document.title.includes("(Bản sao)")) && (
          <StatusChip
            icon="download-outline"
            label="Từ Cộng đồng"
            tone="success"
          />
        )}
        {document.ownerId !== "local" && (
          <Text
            variant="labelSmall"
            style={{ color: t.colors.onSurfaceVariant, alignSelf: "center" }}
          >
            {pending ? "Chờ đồng bộ" : "Đã đồng bộ"}
          </Text>
        )}
      </View>

      {/* Share button */}
      {!selectionMode && onShare && (
        <Button
          mode={document.isPublic ? "contained-tonal" : "outlined"}
          compact
          icon={document.isPublic ? "earth" : "share-variant-outline"}
          onPress={onShare}
          style={{ alignSelf: "flex-start", borderRadius: 10 }}
        >
          {document.isPublic ? "Đang chia sẻ" : "Chia sẻ lên Cộng đồng"}
        </Button>
      )}
    </Pressable>
  );
}

// ─── Chip nhỏ trạng thái (hỗ trợ cả Light & Dark mode) ────────────────────────
export function StatusChip({
  icon,
  label,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "accent";
}) {
  const t = useTheme();
  const palette = {
    neutral: {
      color: t.colors.onSurfaceVariant,
      bg: t.colors.surfaceVariant,
    },
    primary: {
      color: t.dark ? "#34D399" : "#0B8775",
      bg: t.dark ? "#0F3D34" : "#CCFBF1",
    },
    success: {
      color: t.dark ? "#4ADE80" : "#15803D",
      bg: t.dark ? "#143A22" : "#DCFCE7",
    },
    warning: {
      color: t.dark ? "#FBBF24" : "#B45309",
      bg: t.dark ? "#423009" : "#FEF3C7",
    },
    accent: {
      color: t.dark ? "#FB923C" : "#EA6332",
      bg: t.dark ? "#4A2310" : "#FFEDD5",
    },
  }[tone];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: palette.bg,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
      }}
    >
      <Icon source={icon} size={13} color={palette.color} />
      <Text
        variant="labelSmall"
        style={{ color: palette.color, fontWeight: "700" }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  screen: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  panel: {
    padding: 18,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
  },
  cardShadow: {
    shadowColor: "#0B8775",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  wrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});

export { Chip };
