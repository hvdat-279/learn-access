import { View, Pressable } from "react-native";
import { Button, Text, Icon, useTheme } from "react-native-paper";
import { router } from "expo-router";
import {
  Screen,
  Panel,
  DocumentCard,
  Empty,
  Loading,
  Notice,
  GuestBanner,
} from "../../ui/components";
import { useAuth, useDocuments } from "../../ui/provider";
import { useSettings } from "../../ui/store";

// Thẻ hướng dẫn nhanh (hỗ trợ Light & Dark mode)
function FeatureCard({
  icon,
  tone,
  title,
  desc,
}: {
  icon: string;
  tone: "primary" | "secondary" | "tertiary";
  title: string;
  desc: string;
}) {
  const t = useTheme();
  const colors = {
    primary: {
      icon: t.colors.primary,
      bg: t.colors.primaryContainer,
    },
    secondary: {
      icon: t.colors.secondary,
      bg: t.colors.secondaryContainer,
    },
    tertiary: {
      icon: t.colors.tertiary,
      bg: t.colors.tertiaryContainer,
    },
  }[tone];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.surface,
        borderRadius: 16,
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: t.colors.outlineVariant,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon source={icon} size={20} color={colors.icon} />
      </View>
      <Text variant="titleSmall" style={{ fontWeight: "700", lineHeight: 18 }}>
        {title}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: t.colors.onSurfaceVariant, lineHeight: 17 }}
      >
        {desc}
      </Text>
    </View>
  );
}

// Ô thống kê gọn trên Trang chủ
function StatTile({
  value,
  label,
  icon,
  color,
  bg,
  onPress,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
  bg: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: t.colors.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: t.colors.outlineVariant,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon source={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium" style={{ fontWeight: "800", lineHeight: 20 }}>
          {value}
        </Text>
        <Text
          variant="labelSmall"
          style={{ color: t.colors.onSurfaceVariant }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Home() {
  const { data: documents = [], isLoading, error } = useDocuments();
  const { email, ownerId } = useAuth();
  const t = useTheme();
  const settings = useSettings();

  const firstName = email ? email.split("@")[0] : "bạn";
  const summarizedCount = documents.filter((d) => Boolean(d.ai?.summary)).length;
  const quizCount = documents.filter((d) => Boolean(d.ai?.quiz?.length)).length;

  return (
    <Screen>
      {/* ── Topbar ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            variant="labelMedium"
            style={{
              color: t.colors.primary,
              letterSpacing: 1.8,
              fontWeight: "800",
            }}
          >
            LEARNACCESS
          </Text>
          <Text
            variant="headlineSmall"
            style={{ fontWeight: "800", letterSpacing: -0.4 }}
            numberOfLines={1}
          >
            Chào {firstName}, cùng học nhé
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel="Mở hồ sơ học tập"
          style={({ pressed }) => ({
            backgroundColor: t.colors.surface,
            borderRadius: 12,
            width: 42,
            height: 42,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.colors.outlineVariant,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon source="account-outline" size={22} color={t.colors.primary} />
        </Pressable>
      </View>

      {/* ── Guest banner ── */}
      {ownerId === "local" && <GuestBanner />}

      {/* ── Thẻ giới thiệu chính (Sáng, tươi, gọn gàng) ── */}
      <View
        style={{
          backgroundColor: t.dark ? "#0F4C42" : "#0B8775",
          padding: 22,
          borderRadius: 18,
          gap: 14,
          borderWidth: 1,
          borderColor: t.dark ? "#1B6B5E" : "#097263",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              variant="labelSmall"
              style={{
                color: "#FFFFFF",
                letterSpacing: 1.2,
                fontWeight: "700",
              }}
            >
              SỔ TAY HỌC TẬP
            </Text>
          </View>
          <Icon source="book-open-page-variant-outline" size={20} color="#CCFBF1" />
        </View>

        <Text
          variant="headlineMedium"
          style={{
            color: "#FFFFFF",
            fontWeight: "800",
            lineHeight: 33,
            letterSpacing: -0.4,
          }}
        >
          Từ trang giấy{"\n"}đến điều bạn hiểu.
        </Text>
        <Text
          style={{
            color: "#CCFBF1",
            lineHeight: 22,
            fontSize: 14,
            maxWidth: 380,
          }}
        >
          Số hóa trang sách, rút gọn ý chính, nghe lại bài giảng và tự kiểm tra bằng Quiz.
        </Text>

        <View
          style={{
            height: 1,
            backgroundColor: "rgba(255,255,255,0.18)",
            marginVertical: 2,
          }}
        />

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Button
            mode="contained"
            icon="plus"
            buttonColor="#FFFFFF"
            textColor="#0B8775"
            contentStyle={{ height: 44 }}
            style={{ borderRadius: 12, flex: 1 }}
            onPress={() => router.push("/import")}
          >
            Thêm tài liệu
          </Button>
          <Button
            mode="outlined"
            icon="account-group-outline"
            textColor="#FFFFFF"
            style={{ borderColor: "rgba(255,255,255,0.55)", borderRadius: 12 }}
            contentStyle={{ height: 44 }}
            onPress={() => router.push("/community")}
          >
            Cộng đồng
          </Button>
        </View>
      </View>

      {/* ── Thống kê học tập nhanh ── */}
      {documents.length > 0 && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatTile
            value={documents.length}
            label="Tài liệu"
            icon="book-open-outline"
            color={t.colors.primary}
            bg={t.colors.primaryContainer}
            onPress={() => router.push("/library")}
          />
          <StatTile
            value={summarizedCount}
            label="Tóm tắt"
            icon="text-box-check-outline"
            color={t.colors.tertiary}
            bg={t.colors.tertiaryContainer}
            onPress={() => router.push("/library")}
          />
          <StatTile
            value={quizCount}
            label="Bộ Quiz"
            icon="help-circle-outline"
            color={t.colors.secondary}
            bg={t.colors.secondaryContainer}
            onPress={() => router.push("/library")}
          />
        </View>
      )}

      {/* ── Tính năng nhanh ── */}
      {!settings.onboarded && (
        <View style={{ gap: 10 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              Quy trình 3 bước
            </Text>
            <Button
              onPress={() => settings.change({ onboarded: true })}
              compact
            >
              Ẩn hướng dẫn
            </Button>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <FeatureCard
              icon="camera-outline"
              tone="primary"
              title="1. Nhập"
              desc="Chụp hoặc tải PDF, TXT"
            />
            <FeatureCard
              icon="text-box-check-outline"
              tone="tertiary"
              title="2. Tóm tắt"
              desc="Rút gọn ý & tạo Quiz"
            />
            <FeatureCard
              icon="headphones"
              tone="secondary"
              title="3. Ôn tập"
              desc="Nghe & lật thẻ nhớ"
            />
          </View>
        </View>
      )}

      {/* ── Recent docs ── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 2,
        }}
      >
        <Text
          variant="titleLarge"
          style={{ fontWeight: "800", letterSpacing: -0.3 }}
        >
          Học tiếp gần đây
        </Text>
        <Button
          onPress={() => router.push("/library")}
          compact
          icon="arrow-right"
          contentStyle={{ flexDirection: "row-reverse" }}
        >
          Xem tất cả
        </Button>
      </View>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <Notice
          error
          text="Không mở được thư viện. Hãy khởi động lại ứng dụng."
        />
      ) : documents.length ? (
        documents
          .slice(0, 3)
          .map((d) => <DocumentCard key={d.id} document={d} />)
      ) : (
        <Empty
          title="Thư viện đang chờ bạn"
          description="Thêm bài giảng hoặc trang sách đầu tiên — nội dung được lưu ngay trên thiết bị."
          action={() => router.push("/import")}
        />
      )}

      {/* ── Tip footer ── */}
      <Panel color={t.colors.surfaceVariant}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View
            style={{
              backgroundColor: t.colors.primaryContainer,
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              source="lightbulb-on-outline"
              size={19}
              color={t.colors.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="titleSmall" style={{ fontWeight: "700" }}>
              Mẹo ôn bài hiệu quả
            </Text>
            <Text
              style={{
                lineHeight: 21,
                color: t.colors.onSurfaceVariant,
                fontSize: 13,
              }}
            >
              Sau khi tóm tắt tài liệu, mở tab{" "}
              <Text style={{ fontWeight: "700", color: t.colors.primary }}>
                &quot;Ôn tập&quot;
              </Text>{" "}
              để lật Flashcard và làm Quiz củng cố trí nhớ ngay nhé.
            </Text>
          </View>
        </View>
      </Panel>
    </Screen>
  );
}
