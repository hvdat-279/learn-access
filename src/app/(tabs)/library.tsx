import { useState } from "react";
import { View, Share, ScrollView } from "react-native";
import {
  Button,
  Searchbar,
  Chip,
  Text,
  Dialog,
  Portal,
  TextInput,
  useTheme,
} from "react-native-paper";
import { router } from "expo-router";
import {
  Screen,
  Heading,
  DocumentCard,
  Empty,
  Loading,
  Notice,
} from "../../ui/components";
import { useDocuments, refreshDocuments, refreshPublicDocuments, useAuth } from "../../ui/provider";
import { repository } from "../../data/repository";
import { setDocumentPublic } from "../../domain/model";
import type { Document } from "../../domain/model";

export default function Library() {
  const t = useTheme();
  const { data = [], isLoading, error } = useDocuments();
  const [search, setSearch] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "mine" | "shared" | "community">("all");

  // Chế độ chọn nhiều để xóa (khi dí lâu vào tài liệu)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Chia sẻ tài liệu từ Thư viện
  const { ownerId, email } = useAuth();
  const isGuest = ownerId === "local";
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [authorNameText, setAuthorNameText] = useState("");
  const [authDialog, setAuthDialog] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);

  function handleOpenShare(doc: Document) {
    if (isGuest) {
      setAuthDialog(true);
      return;
    }
    setShareDoc(doc);
    setAuthorNameText(doc.authorName || email?.split("@")[0] || "Sinh viên");
  }

  async function handleToggleCommunity(doc: Document, isPublic: boolean) {
    setSharingBusy(true);
    try {
      const updated = setDocumentPublic(doc, isPublic, authorNameText.trim());
      await repository.save({ ...updated, updatedAt: new Date().toISOString() });
      await refreshDocuments();
      await refreshPublicDocuments();
      setShareDoc(null);
    } catch {
      // Bỏ qua hoặc log lỗi, không chèn banner rác
    } finally {
      setSharingBusy(false);
    }
  }

  async function handleNativeShare(doc: Document) {
    const text = `${doc.title}\n\n${doc.blocks.map((b) => b.text).join("\n\n")}`;
    try {
      await Share.share({
        title: doc.title,
        message: text,
      });
    } catch {}
  }

  const q = search.toLocaleLowerCase("vi");

  // Thu thập danh sách các thư mục hiện có
  const folders = Array.from(
    new Set(data.map((d) => d.folder).filter(Boolean)),
  ) as string[];

  // Phân loại tài liệu chuẩn xác:
  // - "Của tôi": do chính mình tạo ra (không có originalId và không phải là bản sao từ cộng đồng)
  // - "Đã chia sẻ": tài liệu của mình và đang bật chia sẻ lên Cộng đồng (isPublic: true)
  // - "Từ Cộng đồng": tài liệu lưu/sao chép từ bài đăng của người khác về máy (có originalId hoặc (Bản sao))
  const mineList = data.filter((d) => !d.originalId && !d.title.includes("(Bản sao)"));
  const mineCount = mineList.length;
  const sharedCount = mineList.filter((d) => Boolean(d.isPublic)).length;
  const communityCount = data.filter((d) => Boolean(d.originalId) || d.title.includes("(Bản sao)")).length;
  const favoriteCount = data.filter((d) => Boolean(d.favorite)).length;

  const list = data.filter((d) => {
    const isMine = !d.originalId && !d.title.includes("(Bản sao)");
    const isShared = isMine && Boolean(d.isPublic);
    const isFromCommunity = Boolean(d.originalId) || d.title.includes("(Bản sao)");

    if (sourceFilter === "mine" && !isMine) return false;
    if (sourceFilter === "shared" && !isShared) return false;
    if (sourceFilter === "community" && !isFromCommunity) return false;
    if (favorite && !d.favorite) return false;

    const matchFolder =
      selectedFolder === "all" ||
      (selectedFolder === "none" && !d.folder) ||
      d.folder === selectedFolder;

    const matchSearch = (
      d.title +
      " " +
      (d.folder ?? "") +
      " " +
      (d.authorName ?? "") +
      " " +
      d.blocks.map((b) => b.text).join(" ")
    )
      .toLocaleLowerCase("vi")
      .includes(q);

    return matchFolder && matchSearch;
  });

  function handleLongPress(docId: string) {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([docId]);
    }
  }

  function handleToggleSelect(docId: string) {
    setSelectedIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  }

  function handleSelectAll() {
    if (selectedIds.length === list.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(list.map((d) => d.id));
    }
  }

  async function handleDeleteSelected() {
    setDeleting(true);
    try {
      for (const id of selectedIds) {
        const doc = data.find((d) => d.id === id);
        if (doc) {
          await repository.save({
            ...doc,
            deleted: true,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      await refreshDocuments();
      setSelectionMode(false);
      setSelectedIds([]);
      setDeleteDialog(false);
    } catch (e) {
      console.warn("Lỗi khi xóa:", e);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <Heading
        title="Thư viện"
        subtitle="Những điều đã học, luôn ở đây."
      />

      {selectionMode ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: t.colors.surfaceVariant,
            padding: 12,
            borderRadius: 16,
            gap: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              Đã chọn: {selectedIds.length} / {list.length}
            </Text>
          </View>
          <Button mode="text" compact onPress={handleSelectAll}>
            {selectedIds.length === list.length ? "Bỏ chọn" : "Tất cả"}
          </Button>
          <Button
            mode="contained"
            compact
            buttonColor={t.colors.error}
            textColor={t.colors.onError}
            icon="delete"
            disabled={selectedIds.length === 0}
            onPress={() => setDeleteDialog(true)}
          >
            Xóa ({selectedIds.length})
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={() => {
              setSelectionMode(false);
              setSelectedIds([]);
            }}
          >
            Hủy
          </Button>
        </View>
      ) : (
        <Searchbar
          placeholder="Tìm tên, môn học hoặc nội dung…"
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
      )}

      {/* Bộ lọc trạng thái & Thư mục môn học */}
      {!selectionMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          <Chip
            selected={sourceFilter === "all" && !favorite && selectedFolder === "all"}
            showSelectedCheck={false}
            onPress={() => {
              setSourceFilter("all");
              setFavorite(false);
              setSelectedFolder("all");
            }}
          >
            Tất cả · {data.length}
          </Chip>
          <Chip
            icon="account-outline"
            selected={sourceFilter === "mine" && !favorite}
            showSelectedCheck={false}
            onPress={() => {
              setSourceFilter(sourceFilter === "mine" ? "all" : "mine");
              setFavorite(false);
            }}
          >
            Của tôi · {mineCount}
          </Chip>
          <Chip
            icon="earth"
            selected={sourceFilter === "shared" && !favorite}
            showSelectedCheck={false}
            onPress={() => {
              setSourceFilter(sourceFilter === "shared" ? "all" : "shared");
              setFavorite(false);
            }}
          >
            Đã chia sẻ · {sharedCount}
          </Chip>
          <Chip
            icon="download-outline"
            selected={sourceFilter === "community" && !favorite}
            showSelectedCheck={false}
            onPress={() => {
              setSourceFilter(sourceFilter === "community" ? "all" : "community");
              setFavorite(false);
            }}
          >
            Từ Cộng đồng · {communityCount}
          </Chip>
          <Chip
            icon={favorite ? "star" : "star-outline"}
            selected={favorite}
            showSelectedCheck={false}
            onPress={() => setFavorite(!favorite)}
          >
            Yêu thích · {favoriteCount}
          </Chip>
          {folders.map((f) => (
            <Chip
              key={f}
              selected={!favorite && selectedFolder === f}
              showSelectedCheck={false}
              onPress={() => {
                setFavorite(false);
                setSelectedFolder(selectedFolder === f ? "all" : f);
              }}
            >
              {f}
            </Chip>
          ))}
        </ScrollView>
      )}

      {!selectionMode && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            mode="contained"
            icon="plus"
            contentStyle={{ height: 44 }}
            style={{ flex: 1, borderRadius: 14 }}
            onPress={() => router.push("/import")}
          >
            Thêm tài liệu mới
          </Button>
          <Button
            mode="outlined"
            icon="account-group"
            contentStyle={{ height: 44 }}
            style={{ borderRadius: 14 }}
            onPress={() => router.push("/community")}
          >
            Cộng đồng
          </Button>
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text variant="labelLarge">
          {list.length} tài liệu{" "}
          {selectedFolder !== "all" ? `(Thư mục: ${selectedFolder})` : ""}
        </Text>
        {!selectionMode && list.length > 0 && (
          <Text variant="bodySmall" style={{ opacity: 0.6 }}>
            Dí lâu để chọn xóa nhiều
          </Text>
        )}
      </View>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <Notice error text="Không đọc được thư viện." />
      ) : list.length ? (
        list.map((d) => (
          <DocumentCard
            key={d.id}
            document={d}
            selectionMode={selectionMode}
            selected={selectedIds.includes(d.id)}
            onToggleSelect={() => handleToggleSelect(d.id)}
            onLongPress={() => handleLongPress(d.id)}
            onShare={() => handleOpenShare(d)}
          />
        ))
      ) : (
        <Empty
          title={search ? "Chưa tìm thấy tài liệu" : "Chưa có tài liệu ở đây"}
          description={
            search
              ? "Thử một từ khóa hoặc chuyển sang thư mục khác nhé."
              : "Tài liệu bạn thêm sẽ xuất hiện tại đây."
          }
        />
      )}

      <Portal>
        {/* Hộp thoại xóa */}
        <Dialog
          visible={deleteDialog}
          onDismiss={() => setDeleteDialog(false)}
        >
          <Dialog.Title>Xác nhận xóa tài liệu</Dialog.Title>
          <Dialog.Content>
            <Text>
              Bạn có chắc chắn muốn xóa {selectedIds.length} tài liệu đã chọn khỏi Thư viện không?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialog(false)} disabled={deleting}>
              Hủy
            </Button>
            <Button
              textColor={t.colors.error}
              loading={deleting}
              disabled={deleting}
              onPress={handleDeleteSelected}
            >
              Xóa ngay
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Hộp thoại Chia sẻ tài liệu */}
        <Dialog
          visible={Boolean(shareDoc)}
          onDismiss={() => setShareDoc(null)}
        >
          <Dialog.Title>Chia sẻ tài liệu</Dialog.Title>
          <Dialog.Content style={{ gap: 14 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              {shareDoc?.title}
            </Text>
            <Text style={{ opacity: 0.8, fontSize: 13, lineHeight: 18 }}>
              Bạn có thể chia sẻ bài học này lên Cộng đồng để các bạn khác cùng học và làm Quiz, hoặc gửi văn bản qua các ứng dụng khác.
            </Text>

            <TextInput
              mode="outlined"
              label="Tên tác giả hiển thị trên Cộng đồng"
              value={authorNameText}
              onChangeText={setAuthorNameText}
            />

            <Button
              mode="outlined"
              icon="share-variant-outline"
              onPress={() => shareDoc && handleNativeShare(shareDoc)}
            >
              Gửi nội dung qua Zalo / Tin nhắn...
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShareDoc(null)}>Đóng</Button>
            {shareDoc?.isPublic ? (
              <Button
                textColor={t.colors.error}
                loading={sharingBusy}
                disabled={sharingBusy}
                onPress={() => shareDoc && handleToggleCommunity(shareDoc, false)}
              >
                Hủy chia sẻ cộng đồng
              </Button>
            ) : (
              <Button
                mode="contained"
                icon="earth"
                loading={sharingBusy}
                disabled={sharingBusy}
                onPress={() => shareDoc && handleToggleCommunity(shareDoc, true)}
              >
                Đăng lên Cộng đồng
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>

        {/* Yêu cầu đăng nhập */}
        <Dialog visible={authDialog} onDismiss={() => setAuthDialog(false)}>
          <Dialog.Title>Cần đăng nhập tài khoản</Dialog.Title>
          <Dialog.Content>
            <Text>
              Tính năng chia sẻ bài học lên Cộng đồng yêu cầu đăng nhập tài khoản để quản lý bài đăng của bạn.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAuthDialog(false)}>Để sau</Button>
            <Button
              mode="contained"
              icon="login"
              onPress={() => {
                setAuthDialog(false);
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
