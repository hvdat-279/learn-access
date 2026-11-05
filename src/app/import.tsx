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
  async function choose(kind: "camera" | "image" | "pdf") {
    setError("");
    setBusy(true);
    try {
      if (kind === "pdf") {
        const result = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });
        if (!result.canceled)
          setDocument(await prepare(ownerId, result.assets));
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
        if (!result.canceled)
          setDocument(
            await prepare(
              ownerId,
              result.assets.map((a) => ({
                uri: a.uri,
                name: a.fileName ?? undefined,
                size: a.fileSize,
                mimeType: a.mimeType,
              })),
            ),
          );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể mở tài liệu.");
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
              Chụp tài liệu
            </Button>
            <Button
              disabled={busy}
              icon="image-multiple-outline"
              mode="outlined"
              onPress={() => choose("image")}
            >
              Chọn ảnh từ thư viện
            </Button>
            <Button
              disabled={busy}
              icon="file-pdf-box"
              mode="outlined"
              onPress={() => choose("pdf")}
            >
              Nhập PDF
            </Button>
            <Text style={{ opacity: 0.65, lineHeight: 22 }}>
              Tối đa 5 trang · 20 MB/file. Đặt trang giấy thẳng và đủ sáng để
              nhận diện tốt hơn.
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
            mode="outlined"
            style={{ minHeight: 180 }}
          />
          <Button
            mode="contained"
            disabled={busy || !text.trim()}
            onPress={saveManual}
          >
            Lưu văn bản
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
                      new File(image.uri).move(dest);
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
          <Button
            mode="contained"
            icon="text-recognition"
            disabled={busy || !document.title.trim()}
            onPress={recognize}
          >
            Nhận diện văn bản
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
