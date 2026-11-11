import { View } from "react-native";
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
} from "../../ui/components";
import { useAuth, useDocuments } from "../../ui/provider";
import { useSettings } from "../../ui/store";

export default function Home() {
  const { data: documents = [], isLoading, error } = useDocuments();
  const { email, ownerId } = useAuth();
  const t = useTheme();
  const settings = useSettings();

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            variant="labelLarge"
            style={{ color: t.colors.primary, letterSpacing: 2 }}
          >
            LEARNACCESS
          </Text>
          <Text
            variant="headlineSmall"
            style={{ fontWeight: "800", marginTop: 8 }}
          >
            Một chút mỗi ngày,{"\n"}hiểu thêm thật nhiều.
          </Text>
        </View>
      </View>

      <Text style={{ opacity: 0.7 }}>
        Chào {email ? email.split("@")[0] : "bạn"}! Hôm nay mình học gì nhỉ?
      </Text>

      {/* Banner nhắc đăng nhập nếu đang là khách */}
      {ownerId === "local" && <GuestBanner />}

      <LinearGradient
        colors={["#6650D8", "#43338E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 26, borderRadius: 28, gap: 16, overflow: "hidden" }}
      >
        <View
          style={{
            position: "absolute",
            right: -28,
            top: -28,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: "#ffffff12",
          }}
        />
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: "#ffffff22",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 20,
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "600" }}>
            TÀI LIỆU CỦA BẠN, CÁCH HỌC CỦA BẠN
          </Text>
        </View>
        <Text
          variant="headlineMedium"
          style={{ color: "#FFF", fontWeight: "800" }}
        >
          Từ trang giấy{"\n"}đến điều bạn hiểu.
        </Text>
        <Text style={{ color: "#E8E1FF", lineHeight: 24, maxWidth: 420 }}>
          Chụp tài liệu, nắm ý chính và lắng nghe bài học — ngay trong một ứng
          dụng.
        </Text>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Button
            mode="contained"
            icon="plus"
            buttonColor="#F5D778"
            textColor="#33275C"
            contentStyle={{ height: 48 }}
            onPress={() => router.push("/import")}
          >
            Thêm tài liệu mới
          </Button>
          <Button
            mode="outlined"
            icon="account-group"
            textColor="#FFFFFF"
            style={{ borderColor: "#FFFFFF88" }}
            contentStyle={{ height: 48 }}
            onPress={() => router.push("/community")}
          >
            Khám phá cộng đồng
          </Button>
        </View>
      </LinearGradient>

      {!settings.onboarded && (
        <Panel>
          <Text variant="titleMedium" style={{ fontWeight: "700" }}>
            Bắt đầu thật đơn giản
          </Text>
          <View style={{ gap: 15 }}>
            {[
              ["camera-outline", "01", "Chụp hoặc nhập tài liệu (PDF, Word, TXT, Ảnh)"],
              ["creation", "02", "Hiểu ý chính, đối chiếu nguồn & làm Quiz"],
              ["headphones", "03", "Nghe và ôn luyện Flashcard offline"],
            ].map(([icon, n, label]) => (
              <View
                key={n}
                style={{ flexDirection: "row", gap: 14, alignItems: "center" }}
              >
                <Icon source={icon} size={24} color={t.colors.primary} />
                <Text style={{ opacity: 0.4 }}>{n}</Text>
                <Text style={{ flex: 1 }}>{label}</Text>
              </View>
            ))}
          </View>
          <Button onPress={() => settings.change({ onboarded: true })}>
            Mình đã hiểu
          </Button>
        </Panel>
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text variant="titleLarge" style={{ fontWeight: "800" }}>
          Tiếp tục khám phá
        </Text>
        <Button onPress={() => router.push("/library")}>Xem tất cả</Button>
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
          title="Một thư viện đang chờ bạn"
          description="Thêm trang sách hoặc bài giảng đầu tiên. Nội dung sẽ được lưu ngay trên thiết bị."
          action={() => router.push("/import")}
        />
      )}

      <Panel color={t.colors.surfaceVariant}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Icon
            source="lightbulb-on-outline"
            size={26}
            color={t.colors.primary}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="titleSmall">Học tập thông minh hơn</Text>
            <Text style={{ lineHeight: 22, opacity: 0.75 }}>
              Sau khi tóm tắt AI, hãy chuyển sang tab &quot;Ôn tập&quot; để kiểm tra kiến thức bằng Flashcard và đề trắc nghiệm tự động!
            </Text>
          </View>
        </View>
      </Panel>
    </Screen>
  );
}
