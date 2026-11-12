import { View, Pressable } from "react-native";
import { Button, Text, Icon, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Screen,
  Panel,
  DocumentCard,
  Empty,
  Loading,
  Notice,
  GuestBanner,
  styles,
} from "../../ui/components";
import { useAuth, useDocuments } from "../../ui/provider";
import { useSettings } from "../../ui/store";

function StatCard({
  value,
  label,
  icon,
  iconColor,
  iconBg,
  onPress,
}: {
  value: number;
  label: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      style={({ pressed }) => [
        !t.dark && styles.cardShadow,
        {
          flex: 1,
          backgroundColor: t.colors.surface,
          borderRadius: 16,
          padding: 12,
          gap: 8,
          borderWidth: 1,
          borderColor: t.colors.outlineVariant,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon source={icon} size={17} color={iconColor} />
        </View>
        <Text
          variant="titleLarge"
          style={{ fontWeight: "800", color: t.colors.onSurface }}
        >
          {value}
        </Text>
      </View>
      <Text
        variant="labelMedium"
        style={{ color: t.colors.onSurfaceVariant, fontWeight: "600" }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StepRow({
  step,
  icon,
  title,
  desc,
}: {
  step: string;
  icon: string;
  title: string;
  desc: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: t.colors.primaryContainer,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon source={icon} size={18} color={t.colors.onPrimaryContainer} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSmall" style={{ fontWeight: "700" }}>
          {step}. {title}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: t.colors.onSurfaceVariant, lineHeight: 18 }}
        >
          {desc}
        </Text>
      </View>
    </View>
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
              letterSpacing: 1.6,
              fontWeight: "700",
            }}
          >
            LEARNACCESS
          </Text>
          <Text
            variant="headlineSmall"
            style={{ fontWeight: "800", letterSpacing: -0.4 }}
            numberOfLines={1}
          >
            Chào, {firstName}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel="Mở hồ sơ học tập"
          style={({ pressed }) => [
            !t.dark && styles.cardShadow,
            {
              backgroundColor: t.colors.surface,
              borderRadius: 22,
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: t.colors.outlineVariant,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Icon source="account-outline" size={22} color={t.colors.primary} />
        </Pressable>
      </View>

      {/* ── Thẻ học tập chính ── */}
      <LinearGradient
        colors={t.dark ? ["#1E3A5F", "#152945"] : ["#1E40AF", "#1A3380"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 22,
          borderRadius: 22,
          gap: 12,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -35,
            top: -35,
            width: 170,
            height: 170,
            borderRadius: 85,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        />
        <View
          style={{
            position: "absolute",
            right: 10,
            bottom: -40,
            width: 130,
            height: 130,
            borderRadius: 65,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />

        <Text
          variant="labelSmall"
          style={{
            color: "#BFDBFE",
            letterSpacing: 1.4,
            fontWeight: "700",
          }}
        >
          KHÔNG GIAN HỌC TẬP
        </Text>

        <Text
          variant="headlineMedium"
          style={{
            color: "#FFFFFF",
            fontWeight: "800",
            lineHeight: 34,
            letterSpacing: -0.4,
          }}
        >
          Từ trang giấy{"\n"}đến điều bạn hiểu.
        </Text>
        <Text
          style={{
            color: "#DBEAFE",
            lineHeight: 21,
            fontSize: 14,
            maxWidth: 380,
          }}
        >
          Chụp tài liệu, tóm tắt ý chính, nghe lại bài giảng và làm Quiz ôn tập.
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 6,
          }}
        >
          <Button
            mode="contained"
            icon="plus"
            buttonColor="#FFFFFF"
            textColor="#1E3A8A"
            contentStyle={{ height: 46 }}
            style={{ borderRadius: 999, flex: 1 }}
            onPress={() => router.push("/import")}
          >
            Thêm tài liệu
          </Button>
          <Button
            mode="outlined"
            icon="account-group-outline"
            textColor="#FFFFFF"
            style={{
              borderColor: "rgba(255,255,255,0.45)",
              borderRadius: 999,
            }}
            contentStyle={{ height: 46 }}
            onPress={() => router.push("/community")}
          >
            Cộng đồng
          </Button>
        </View>
      </LinearGradient>

      {/* ── Guest banner ── */}
      {ownerId === "local" && <GuestBanner />}

      {/* ── 3 ô thống kê học tập tách rời ── */}
      {documents.length > 0 && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            value={documents.length}
            label="Tài liệu"
            icon="file-document-outline"
            iconColor={t.dark ? "#60A5FA" : "#2463EB"}
            iconBg={t.dark ? "#1E3A5F" : "#EFF6FF"}
            onPress={() => router.push("/library")}
          />
          <StatCard
            value={summarizedCount}
            label="Tóm tắt"
            icon="text-box-outline"
            iconColor={t.dark ? "#818CF8" : "#3B5BDB"}
            iconBg={t.dark ? "#222B4F" : "#EEF2FF"}
            onPress={() => router.push("/library")}
          />
          <StatCard
            value={quizCount}
            label="Bộ Quiz"
            icon="help-circle-outline"
            iconColor={t.dark ? "#4ADE80" : "#16A34A"}
            iconBg={t.dark ? "#143A22" : "#ECFDF5"}
            onPress={() => router.push("/library")}
          />
        </View>
      )}

      {/* ── Hướng dẫn nhanh ── */}
      {!settings.onboarded && (
        <Panel>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              Bắt đầu nhanh
            </Text>
            <Button
              onPress={() => settings.change({ onboarded: true })}
              compact
            >
              Ẩn
            </Button>
          </View>
          <View style={{ gap: 14 }}>
            <StepRow
              step="1"
              icon="camera-outline"
              title="Nhập tài liệu"
              desc="Chụp trang sách, chọn ảnh hoặc mở tệp PDF, TXT."
            />
            <StepRow
              step="2"
              icon="text-box-check-outline"
              title="Tóm tắt ý chính"
              desc="Rút gọn nội dung trọng tâm và trích xuất thuật ngữ."
            />
            <StepRow
              step="3"
              icon="headphones"
              title="Ôn tập chủ động"
              desc="Nghe đọc bài học, lật thẻ Flashcard và làm Quiz."
            />
          </View>
        </Panel>
      )}

      {/* ── Tài liệu gần đây ── */}
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

      {/* ── Mẹo học tập ── */}
      <Panel color={t.dark ? t.colors.surfaceVariant : "#EEF4FF"}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View
            style={{
              backgroundColor: t.colors.surface,
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              source="lightbulb-on-outline"
              size={20}
              color={t.colors.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleSmall" style={{ fontWeight: "700" }}>
              Mẹo ôn bài hiệu quả
            </Text>
            <Text
              style={{
                lineHeight: 20,
                color: t.colors.onSurfaceVariant,
                fontSize: 13,
              }}
            >
              Sau khi tóm tắt tài liệu, mở tab{" "}
              <Text style={{ fontWeight: "700", color: t.colors.primary }}>
                &quot;Ôn tập&quot;
              </Text>{" "}
              để lật thẻ ghi nhớ.
            </Text>
          </View>
        </View>
      </Panel>
    </Screen>
  );
}
