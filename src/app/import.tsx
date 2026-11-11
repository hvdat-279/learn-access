import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import {
  Button,
  Text,
  TextInput,
  ProgressBar,
  IconButton,
} from "react-native-paper";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { File, Directory, Paths } from "expo-file-system";
import { Screen, Heading, Panel, Notice } from "../ui/components";
import { useAuth, refreshDocuments } from "../ui/provider";
import { prepare, recognizeDocument } from "../data/ingestion";
import { repository, createDocument } from "../data/repository";
import type { Document } from "../domain/model";

export default function Import() {
  const { ownerId } = useAuth();
  const [document, setDocument] = useState<Document>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function choose(kind: "camera" | "image" | "file") {
    setError("");
    setBusy(true);
    try {
      if (kind === "file") {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            "application/pdf",
            "text/plain",
            "text/markdown",
            "text/csv",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "*/*",
          ],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets.length > 0) {
          const doc = await prepare(ownerId, result.assets);
          if (doc.status === "ready") {
            await refreshDocuments();
            router.replace(`/document/${doc.id}`);
            return;
          }
          setDocument(doc);
        }
      } else {
        const permission =
          kind === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw new Error("Hãy cấp quyền trong Cài đặt để chụp hoặc chọn ảnh.");
        const result =
          kind === "camera"
            ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsMultipleSelection: true,
                selectionLimit: 5,
                quality: 0.9,
              });
        if (!result.canceled && result.assets.length > 0) {
          const doc = await prepare(
            ownerId,
            result.assets.map((a) => ({
              uri: a.uri,
              name: a.fileName ?? undefined,
              size: a.fileSize,
              mimeType: a.mimeType,
            })),
          );
          if (doc.status === "ready") {
            await refreshDocuments();
            router.replace(`/document/${doc.id}`);
            return;
          }
          setDocument(doc);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể mở tài liệu.");
    } finally {
      setBusy(false);
    }
  }

  async function addMorePages(kind: "camera" | "image") {
    if (!document) return;
    setError("");
    setBusy(true);
    try {
      const permission =
        kind === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Hãy cấp quyền để chụp hoặc chọn thêm ảnh.");

      const result =
        kind === "camera"
          ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsMultipleSelection: true,
              quality: 0.9,
            });

      if (!result.canceled && result.assets.length > 0) {
        const newPages = [];
        const dir = new Directory(Paths.document, ownerId, document.id);
        dir.create({ intermediates: true, idempotent: true });
        for (const asset of result.assets) {
          const pageId = Crypto.randomUUID();
          const target = new File(dir, pageId + ".jpg");
          await new File(asset.uri).copy(target);
          newPages.push({
            id: pageId,
            uri: target.uri,
            status: "pending" as const,
          });
        }
        setDocument({
          ...document,
          pages: [...document.pages, ...newPages],
        });
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không thể thêm trang ảnh mới.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function recognize() {
    if (!document) return;
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const done = await recognizeDocument(
        document,
        abort.current.signal,
        (d, p) => {
          setDocument(d);
          setProgress(p / document.pages.length);
        },
      );
      setDocument(done);

      if (!done.blocks.length) {
        const firstError = done.pages.find((p) => p.error)?.error;
        setError(
          firstError ||
            "Không nhận diện được văn bản trong ảnh. Hãy chụp góc rõ nét hơn hoặc dùng tính năng 'Dán văn bản thủ công'.",
        );
        return;
      }

      await refreshDocuments();
      router.replace(`/document/${done.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const d = createDocument(ownerId, "Ghi chú mới", "text");
      d.status = "ready";
      d.blocks = text
        .trim()
        .split(/\n\s*\n/)
        .map((t) => ({
          id: Crypto.randomUUID(),
          page: 1,
          text: t,
          original: t,
        }));
      await repository.save(d);
      await refreshDocuments();
      router.replace(`/document/${d.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading
        back
        title="Thêm một điều mới"
        subtitle="Một trang sách hôm nay, một ý tưởng cho ngày mai."
      />
      {!document && (
        <>
          <Panel>
            <Text variant="titleLarge">Bạn muốn bắt đầu từ đâu?</Text>
            <Button
              disabled={busy}
              icon="camera-outline"
              mode="contained"
              onPress={() => choose("camera")}
            >
              Chụp tài liệu bằng Camera
            </Button>
            <Button
              disabled={busy}
              icon="image-multiple-outline"
              mode="outlined"
              onPress={() => choose("image")}
            >
              Chọn ảnh từ thư viện (Tối đa 5 ảnh)
            </Button>
            <Button
              disabled={busy}
              icon="file-document-outline"
              mode="outlined"
              onPress={() => choose("file")}
            >
              Nhập tệp tài liệu (PDF, Word, TXT)
            </Button>
            <Text style={{ opacity: 0.65, lineHeight: 22 }}>
              PDF từ 1–5 trang, tối đa 20 MB; hoặc văn bản Word/TXT và tối đa 5
              ảnh một lượt.
            </Text>
          </Panel>
          <Button
            disabled={busy}
            icon="text"
            onPress={() => setManual(!manual)}
          >
            Hoặc dán văn bản của bạn
          </Button>
        </>
      )}
      {manual && !document && (
        <Panel>
          <TextInput
            multiline
            label="Nội dung học tập"
            value={text}
            onChangeText={setText}
            placeholder="Dán bài báo, đoạn văn hoặc bài giảng vào đây…"
            style={{ minHeight: 140 }}
          />
          <Button
            mode="contained"
            disabled={busy || !text.trim()}
            onPress={saveManual}
          >
            Lưu vào thư viện
          </Button>
        </Panel>
      )}
      {document && (
        <>
          <TextInput
            mode="outlined"
            label="Tên tài liệu"
            value={document.title}
            onChangeText={(title) => setDocument({ ...document, title })}
            disabled={busy}
          />
          {document.pages.map((page, index) => (
            <Panel key={page.id}>
              <Text variant="titleMedium">Trang {index + 1}</Text>
              <Image
                source={{ uri: page.uri }}
                style={{ width: "100%", height: 240, borderRadius: 12 }}
                resizeMode="contain"
                accessibilityLabel={"Ảnh trang " + (index + 1)}
              />
              <View style={{ flexDirection: "row" }}>
                <IconButton
                  accessibilityLabel="Đưa trang lên trước"
                  icon="arrow-up"
                  disabled={busy || index === 0}
                  onPress={() => {
                    const pages = [...document.pages];
                    [pages[index - 1], pages[index]] = [
                      pages[index],
                      pages[index - 1],
                    ];
                    setDocument({ ...document, pages });
                  }}
                />
                <IconButton
                  accessibilityLabel="Xoay trang"
                  icon="rotate-right"
                  disabled={busy}
                  onPress={async () => {
                    try {
                      const image = await manipulateAsync(
                        page.uri,
                        [{ rotate: 90 }],
                        { format: SaveFormat.JPEG },
                      );
                      const pageId = Crypto.randomUUID();
                      const dest = new File(
                        new Directory(Paths.document, ownerId, document.id),
                        pageId + ".jpg",
                      );
                      await new File(image.uri).move(dest);
                      setDocument({
                        ...document,
                        pages: document.pages.map((p) =>
                          p.id === page.id
                            ? { ...p, uri: dest.uri, id: pageId }
                            : p,
                        ),
                      });
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                />
                <IconButton
                  accessibilityLabel="Bỏ trang"
                  icon="delete-outline"
                  disabled={busy || document.pages.length === 1}
                  onPress={() =>
                    setDocument({
                      ...document,
                      pages: document.pages.filter((p) => p.id !== page.id),
                    })
                  }
                />
              </View>
            </Panel>
          ))}

          {/* Nút chụp thêm hoặc thêm ảnh từ máy */}
          <View style={{ flexDirection: "row", gap: 10, marginVertical: 6 }}>
            <Button
              mode="outlined"
              icon="camera-plus-outline"
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() => addMorePages("camera")}
            >
              Chụp thêm trang
            </Button>
            <Button
              mode="outlined"
              icon="image-plus"
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() => addMorePages("image")}
            >
              Thêm ảnh từ máy
            </Button>
          </View>

          <Button
            mode="contained"
            icon="text-recognition"
            disabled={busy || !document.title.trim()}
            onPress={recognize}
          >
            Nhận diện văn bản (OCR)
          </Button>
        </>
      )}
      {busy && (
        <Panel>
          <Text>
            {document
              ? "Đang nhận diện từng trang…"
              : "Đang chuẩn bị tài liệu…"}
          </Text>
          <ProgressBar progress={progress} indeterminate={!document} />
          {document && (
            <Button onPress={() => abort.current?.abort()}>
              Dừng sau trang hiện tại
            </Button>
          )}
        </Panel>
      )}
      {!!error && <Notice error text={error} />}
    </Screen>
  );
}
