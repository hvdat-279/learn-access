import { useState } from "react";
import { View, ScrollView } from "react-native";
import {
  Button,
  Searchbar,
  Chip,
  Text,
  useTheme,
  Icon,
  Dialog,
  Portal,
} from "react-native-paper";
import { router } from "expo-router";
import {
  Screen,
  Heading,
  Panel,
  Loading,
  Notice,
  StatusChip,
  getDocumentKindStyle,
  styles,
} from "../../ui/components";
import {
  useAuth,
  usePublicDocuments,
  useDocuments,
  refreshPublicDocuments,
  refreshDocuments,
} from "../../ui/provider";
import { repository, preference } from "../../data/repository";
import type { Document } from "../../domain/model";

export default function Community() {
  const t = useTheme();
  const { ownerId } = useAuth();
  const isGuest = ownerId === "local";

  const { data: documents = [], isLoading, error } = usePublicDocuments();
  const { data: myDocuments = [] } = useDocuments();
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = preference.get("community_liked_docs");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [likedFilter, setLikedFilter] = useState(false);

  // Dialog yêu cầu đăng nhập khi khách bấm tương tác
  const [authDialogVisible, setAuthDialogVisible] = useState(false);
  const [authDialogReason, setAuthDialogReason] = useState("");

  const q = search.toLocaleLowerCase("vi");

  // Danh sách các môn học / thư mục có trong tài liệu công khai
  const folders = Array.from(
    new Set(documents.map((d) => d.folder).filter(Boolean)),
  ) as string[];

  const filtered = documents.filter((d) => {
    const matchFolder = selectedFolder === "all" || d.folder === selectedFolder;
    const matchLiked = !likedFilter || Boolean(likedIds[d.id]);
    const matchSearch =
      (d.title + " " + (d.authorName ?? "") + " " + (d.folder ?? "") + " " + d.blocks.map((b) => b.text).join(" "))
        .toLocaleLowerCase("vi")
        .includes(q);
    return matchFolder && matchLiked && matchSearch;
  });

  async function handleLike(id: string) {
    // 1. Kiểm tra nếu là khách -> Yêu cầu đăng nhập
    if (isGuest) {
      setAuthDialogReason("thả tim và tương tác với các bài học trên Cộng đồng");
      setAuthDialogVisible(true);
      return;
    }

    const isCurrentlyLiked = Boolean(likedIds[id]);
    const nextLiked = { ...likedIds, [id]: !isCurrentlyLiked };
    setLikedIds(nextLiked);
    try {
      preference.set("community_liked_docs", JSON.stringify(nextLiked));
    } catch {}

    await repository.toggleLike(id, !isCurrentlyLiked);
    await refreshPublicDocuments();
  }

  async function handleClone(doc: Document) {
    // 1. Kiểm tra nếu là khách -> Yêu cầu đăng nhập
    if (isGuest) {
      setAuthDialogReason("lưu tài liệu này về Thư viện cá nhân để học và làm Quiz offline");
      setAuthDialogVisible(true);
      return;
    }

    if (
      myDocuments.some(
        (m) =>
          !m.deleted &&
          ((m.originalId && m.originalId === doc.id) ||
            m.title === `${doc.title} (Bản sao)` ||
            m.id === doc.id),
      )
    ) {
      return;
    }

    setSavingId(doc.id);
    try {
      await repository.cloneToMyLibrary(doc, ownerId);
      await refreshDocuments();
    } catch {
      // Bỏ qua lỗi hoặc lưu thất bại không hiện thông báo rác
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Screen>
      <Heading
        title="Cộng đồng học tập"
        subtitle="Kho tài liệu số hóa, tóm tắt và câu hỏi ôn thi do sinh viên chia sẻ."
      />

      {/* Banner nhắc nhở nếu đang ở chế độ Khách */}
      {isGuest && (
        <View
          style={{
            backgroundColor: t.colors.surface,
            padding: 14,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            borderWidth: 1,
            borderColor: t.colors.outlineVariant,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleSmall" style={{ fontWeight: "700" }}>
              Bạn đang ở chế độ Khách
            </Text>
            <Text
              variant="bodySmall"
              style={{
                color: t.colors.onSurfaceVariant,
                lineHeight: 18,
              }}
            >
              Đọc tự do · Đăng nhập để thả tim và lưu bài
            </Text>
          </View>
          <Button
            mode="contained-tonal"
            compact
            icon="login"
            onPress={() => router.push("/auth")}
            style={{ borderRadius: 10 }}
          >
            Đăng nhập
          </Button>
        </View>
      )}

      <Searchbar
        placeholder="Tìm môn học, tác giả, tài liệu…"
        value={search}
        onChangeText={setSearch}
        elevation={0}
        style={{
          backgroundColor: t.colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.colors.outlineVariant,
        }}
      />

      {/* Bộ lọc theo môn học / chuyên đề */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        <Chip
          selected={selectedFolder === "all" && !likedFilter}
          showSelectedCheck={false}
          onPress={() => {
            setSelectedFolder("all");
            setLikedFilter(false);
          }}
        >
          Tất cả · {documents.length}
        </Chip>
        <Chip
          icon="heart"
          selected={likedFilter}
          showSelectedCheck={false}
          onPress={() => setLikedFilter(!likedFilter)}
        >
          Đã thích ({Object.values(likedIds).filter(Boolean).length})
        </Chip>
        {folders.map((f) => (
          <Chip
            key={f}
            selected={selectedFolder === f}
            showSelectedCheck={false}
            onPress={() => setSelectedFolder(selectedFolder === f ? "all" : f)}
          >
            {f}
          </Chip>
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text variant="labelLarge" style={{ color: t.colors.onSurfaceVariant }}>
          Hiển thị {filtered.length} tài liệu cộng đồng
        </Text>
      </View>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <Notice error text="Không tải được dữ liệu cộng đồng." />
      ) : filtered.length ? (
        filtered.map((d) => {
          const isLiked = Boolean(likedIds[d.id]);
          const displayLikes = (d.likes ?? 0) + (isLiked ? 1 : 0);
          const isSaved = myDocuments.some(
            (m) =>
              !m.deleted &&
              ((m.originalId && m.originalId === d.id) ||
                m.title === `${d.title} (Bản sao)` ||
                m.id === d.id),
          );
          const kindStyle = getDocumentKindStyle(d.kind, t.dark);
          const authorInitial = (d.authorName || "A").charAt(0).toUpperCase();

          return (
            <Panel key={d.id}>
              <View style={{ gap: 12 }}>
                {/* Header card: Icon & Tiêu đề */}
                <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                  <View style={[styles.iconBox, { backgroundColor: kindStyle.bg }]}>
                    <Icon source={kindStyle.icon} color={kindStyle.color} size={28} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="titleMedium" style={{ fontWeight: "700", lineHeight: 22 }}>
                      {d.title}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: t.colors.primaryContainer,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: t.colors.onPrimaryContainer,
                          }}
                        >
                          {authorInitial}
                        </Text>
                      </View>
                      <Text
                        variant="bodySmall"
                        style={{ color: t.colors.onSurfaceVariant }}
                      >
                        <Text style={{ fontWeight: "600", color: t.colors.onSurface }}>
                          {d.authorName || "Ẩn danh"}
                        </Text>{" "}
                        · {new Date(d.createdAt).toLocaleDateString("vi-VN")}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Tóm tắt ngắn nếu có */}
                {d.ai?.summary?.overview && (
                  <Text
                    numberOfLines={2}
                    style={{
                      color: t.colors.onSurfaceVariant,
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                  >
                    {d.ai.summary.overview}
                  </Text>
                )}

                {/* Tags thông tin */}
                <View style={styles.chipRow}>
                  {d.folder && (
                    <StatusChip icon="folder-outline" label={d.folder} />
                  )}
                  <StatusChip
                    icon="book-open-outline"
                    label={`${d.blocks.length} đoạn`}
                    tone="primary"
                  />
                  {d.ai?.flashcards && (
                    <StatusChip
                      icon="cards-outline"
                      label={`${d.ai.flashcards.length} thẻ nhớ`}
                      tone="success"
                    />
                  )}
                  {d.ai?.quiz && (
                    <StatusChip
                      icon="help-circle-outline"
                      label={`${d.ai.quiz.length} câu Quiz`}
                      tone="accent"
                    />
                  )}
                </View>

                {/* Actions: Thả tim, Xem chi tiết & Lưu về thư viện */}
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: t.colors.outlineVariant,
                    paddingTop: 10,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Button
                      mode="text"
                      compact
                      icon={isLiked ? "heart" : "heart-outline"}
                      textColor={isLiked ? "#E11D48" : undefined}
                      onPress={() => handleLike(d.id)}
                    >
                      {displayLikes} {isLiked ? "Đã thích" : "Thích"}
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      icon="eye-outline"
                      style={{ borderRadius: 10 }}
                      onPress={() => router.push(`/document/${d.id}`)}
                    >
                      Xem chi tiết
                    </Button>
                  </View>
                  <Button
                    mode={isSaved ? "contained-tonal" : "contained"}
                    icon={isSaved ? "check" : "download"}
                    loading={savingId === d.id}
                    disabled={savingId === d.id || isSaved}
                    onPress={() => handleClone(d)}
                    style={{ width: "100%", borderRadius: 14 }}
                    contentStyle={{ height: 42 }}
                  >
                    {isSaved ? "Đã lưu vào Thư viện" : "Lưu về Thư viện để học offline"}
                  </Button>
                </View>
              </View>
            </Panel>
          );
        })
      ) : (
        <Panel>
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: t.colors.surfaceVariant,
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                },
              ]}
            >
              <Icon source="magnify-close" size={32} color={t.colors.primary} />
            </View>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              Không tìm thấy tài liệu phù hợp
            </Text>
            <Text
              style={{
                color: t.colors.onSurfaceVariant,
                textAlign: "center",
                lineHeight: 21,
                maxWidth: 280,
              }}
            >
              Hãy thử tìm kiếm với từ khóa khác hoặc chia sẻ tài liệu của bạn lên cộng đồng!
            </Text>
          </View>
        </Panel>
      )}

      {/* Dialog yêu cầu đăng nhập khi khách thực hiện tương tác */}
      <Portal>
        <Dialog visible={authDialogVisible} onDismiss={() => setAuthDialogVisible(false)}>
          <Dialog.Title>Yêu cầu đăng nhập</Dialog.Title>
          <Dialog.Content>
            <Text style={{ lineHeight: 22 }}>
              Bạn cần đăng nhập tài khoản để có thể {authDialogReason}.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAuthDialogVisible(false)}>Để sau</Button>
            <Button
              mode="contained"
              icon="login"
              onPress={() => {
                setAuthDialogVisible(false);
                router.push("/auth");
              }}
            >
              Đăng nhập ngay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}
