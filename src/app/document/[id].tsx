import { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, View, AppState } from "react-native";
import {
  Button,
  Text,
  TextInput,
  SegmentedButtons,
  IconButton,
  Chip,
  Dialog,
  Portal,
  useTheme,
} from "react-native-paper";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import { Screen, Heading, Panel, Notice, Loading } from "../../ui/components";
import { useAuth, useDocument, refreshDocuments } from "../../ui/provider";
import { useSettings } from "../../ui/store";
import { repository, preference } from "../../data/repository";
import { ai } from "../../data/ai";
import { recognizeDocument } from "../../data/ingestion";
import {
  applySummary,
  editBlock,
  speechSegments,
  type Document,
  type Block,
} from "../../domain/model";
function EditableBlock({
  block,
  onSave,
  size,
  lineHeight,
}: {
  block: Block;
  onSave: (text: string) => Promise<void>;
  size: number;
  lineHeight: number;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(block.text);
  const [error, setError] = useState("");
  return (
    <View style={{ gap: 10 }}>
      {editing ? (
        <>
          <TextInput
            mode="outlined"
            multiline
            value={text}
            onChangeText={setText}
            accessibilityLabel="Sửa văn bản nhận diện"
          />
          <View style={{ flexDirection: "row" }}>
            <Button
              onPress={async () => {
                try {
                  await onSave(text);
                  setEditing(false);
                  setError("");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Lưu sửa
            </Button>
            <Button
              onPress={() => {
                setEditing(false);
                setText(block.text);
              }}
            >
              Hủy
            </Button>
          </View>
          {!!error && <Notice error text={error} />}
        </>
      ) : (
        <>
          <Text
            selectable
            style={{ fontSize: size, lineHeight: size * lineHeight }}
          >
            {block.text}
          </Text>
          <Button
            icon="pencil-outline"
            style={{ alignSelf: "flex-start" }}
            onPress={() => {
              setText(block.text);
              setEditing(true);
            }}
          >
            Sửa chữ
          </Button>
        </>
      )}
    </View>
  );
}
export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ownerId } = useAuth();
  const { data: document, isLoading } = useDocument(id);
  if (isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!document || document.deleted)
    return (
      <Screen>
        <Heading back title="Không tìm thấy tài liệu" />
        <Notice text="Tài liệu không thuộc tài khoản hiện tại hoặc đã bị xóa." />
      </Screen>
    );
  return <Reader key={ownerId + id} document={document} />;
}
function Reader({ document }: { document: Document }) {
  const id = document.id;
  const { ownerId } = useAuth();
  const settings = useSettings();
  const t = useTheme();
  const [selectedPages, setSelectedPages] = useState<number[]>(() => [
    ...new Set(document.blocks.map((b) => b.page)),
  ]);
  const [tab, setTab] = useState("text");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<() => Promise<void>>();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(document.title);
  const [deleting, setDeleting] = useState(false);
  const [highlight, setHighlight] = useState("");
  const [showImages, setShowImages] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(document.progress.index);
  const [mode, setMode] = useState<"original" | "summary">(
    document.progress.mode,
  );
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const offsets = useRef<Record<string, number>>({});
  const playToken = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const stop = useCallback(() => {
    playToken.current++;
    void Speech.stop();
    setPlaying(false);
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        stop();
        controller.current?.abort();
      },
      [stop],
    ),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => listener.remove();
  }, [stop]);
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(""), 4500);
    return () => clearTimeout(timer);
  }, [highlight]);
  async function update(next: Document) {
    await repository.save({ ...next, updatedAt: new Date().toISOString() });
    await refreshDocuments();
  }
  async function safe(task: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không thực hiện được. Hãy thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }
  function withConsent(task: () => Promise<void>) {
    if (ownerId === "local") {
      setError(
        "Đăng nhập trong mục Cá nhân để dùng AI. Tài liệu hiện tại vẫn được lưu trên máy.",
      );
      return;
    }
    if (preference.get("ai-consent:" + ownerId) === "yes") {
      void safe(task);
    } else {
      setPending(() => task);
      setConsent(true);
    }
  }
  async function summarize() {
    if (!document) return;
    const version = document.version;
    const selected = {
      ...document,
      blocks: document.blocks.filter((b) => selectedPages.includes(b.page)),
    };
    const result = await ai.summarize(selected);
    const latest = await repository.get(id, ownerId);
    if (latest) await update(applySummary(latest, version, result));
  }
  async function explain(blockId: string) {
    if (!document) return;
    const version = document.version;
    const result = await ai.explain(
      { ...document, blocks: document.blocks.filter((b) => b.id === blockId) },
      blockId,
    );
    const latest = await repository.get(id, ownerId);
    if (!latest || latest.version !== version)
      throw new Error("Văn bản đã thay đổi. Hãy thử lại.");
    await update({
      ...latest,
      ai: {
        version,
        summary: latest.ai?.version === version ? latest.ai.summary : undefined,
        explanations: {
          ...(latest.ai?.version === version ? latest.ai.explanations : {}),
          [blockId]: result,
        },
      },
    });
  }
  function source(blockId: string) {
    setTab("text");
    setHighlight(blockId);
    setTimeout(
      () =>
        scroll.current?.scrollTo({
          y: offsets.current[blockId] ?? 0,
          animated: false,
        }),
      180,
    );
  }
  async function play(start: number) {
    stop();
    const current = document;
    if (!current) return;
    const segments = speechSegments(current, mode);
    if (!segments.length) {
      setError("Chưa có nội dung để nghe.");
      return;
    }
    const token = ++playToken.current;
    setPlaying(true);
    setError("");
    const next = async (position: number) => {
      if (token !== playToken.current) return;
      if (position >= segments.length) {
        setPlaying(false);
        return;
      }
      setIndex(position);
      const latest = await repository.get(id, ownerId);
      if (token !== playToken.current) return;
      if (latest)
        await repository.save(
          { ...latest, progress: { mode, index: position } },
          false,
        );
      if (token !== playToken.current) return;
      Speech.speak(segments[position], {
        language: "vi-VN",
        voice: settings.voice || undefined,
        rate: settings.rate,
        onDone: () => {
          void next(position + 1).catch((e) => {
            stop();
            setError(String(e));
          });
        },
        onError: () => {
          stop();
          setError(
            "Không phát được giọng đọc. Kiểm tra giọng tiếng Việt đã cài và chế độ im lặng của máy.",
          );
        },
      });
    };
    try {
      await next(Math.min(Math.max(start, 0), segments.length - 1));
    } catch (e) {
      stop();
      setError(String(e));
    }
  }
  const stale = document.ai && document.ai.version !== document.version;
  const segments = speechSegments(document, mode);
  return (
    <Screen scroll={false}>
      <Heading back title={document.title} />
      <Button
        icon="pencil-outline"
        style={{ alignSelf: "flex-start" }}
        onPress={() => {
          setTitle(document.title);
          setRenaming(true);
        }}
      >
        Đổi tên tài liệu
      </Button>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Chip icon="check-circle-outline">Đã lưu trên máy</Chip>
        <View style={{ flexDirection: "row" }}>
          <IconButton
            icon={document.favorite ? "star" : "star-outline"}
            accessibilityLabel="Bật hoặc tắt yêu thích"
            onPress={() =>
              safe(() => update({ ...document, favorite: !document.favorite }))
            }
          />
          <IconButton
            icon="delete-outline"
            accessibilityLabel="Xóa tài liệu"
            onPress={() => setDeleting(true)}
          />
        </View>
      </View>
      <SegmentedButtons
        value={tab}
        onValueChange={(value) => {
          stop();
          setTab(value);
        }}
        buttons={[
          { value: "text", label: "Văn bản" },
          { value: "summary", label: "Tóm tắt" },
          { value: "listen", label: "Nghe" },
        ]}
      />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ gap: 18, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && <Notice error text={error} />}
        {(document.status !== "ready" ||
          document.pages.some((p) => p.status !== "done")) && (
          <Panel>
            <Text variant="titleMedium">Kiểm tra văn bản trước khi học</Text>
            <Text>Đối chiếu ảnh gốc và sửa những chữ chưa đúng.</Text>
            {document.pages.some((p) => p.status !== "done") && (
              <>
                <Notice
                  text={document.pages
                    .filter((p) => p.status !== "done")
                    .map((p) => p.error || "Có trang chưa nhận diện xong.")
                    .join("\n")}
                />
                <Button
                  loading={busy}
                  disabled={busy}
                  onPress={() =>
                    safe(async () => {
                      controller.current = new AbortController();
                      await recognizeDocument(
                        document,
                        controller.current.signal,
                        () => {},
                      );
                      await refreshDocuments();
                    })
                  }
                >
                  Thử lại các trang chưa hoàn thành
                </Button>
              </>
            )}
            <Button
              disabled={!document.blocks.length || busy}
              mode="contained"
              onPress={() =>
                safe(() => update({ ...document, status: "ready" }))
              }
            >
              Xác nhận văn bản
            </Button>
          </Panel>
        )}
        {tab === "text" && (
          <>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Button
                icon="image-outline"
                onPress={() => setShowImages(!showImages)}
              >
                {showImages ? "Ẩn ảnh" : "Xem ảnh gốc"}
              </Button>
              <IconButton
                icon="format-font-size-decrease"
                accessibilityLabel="Giảm cỡ chữ"
                onPress={() =>
                  settings.change({
                    fontSize: Math.max(14, settings.fontSize - 2),
                  })
                }
              />
              <Text>{settings.fontSize}</Text>
              <IconButton
                icon="format-font-size-increase"
                accessibilityLabel="Tăng cỡ chữ"
                onPress={() =>
                  settings.change({
                    fontSize: Math.min(32, settings.fontSize + 2),
                  })
                }
              />
            </View>
            {showImages &&
              document.pages.map((p, i) => (
                <Panel key={p.id}>
                  <Text>Trang {i + 1}</Text>
                  {p.uri ? (
                    <Image
                      source={{ uri: p.uri }}
                      resizeMode="contain"
                      style={{ height: 320, width: "100%" }}
                      accessibilityLabel={"Bản gốc trang " + (i + 1)}
                    />
                  ) : (
                    <Notice text="Ảnh đang chờ tải từ bản đồng bộ." />
                  )}
                </Panel>
              ))}
            {document.blocks.map((block) => (
              <View
                key={block.id}
                onLayout={(e) => {
                  offsets.current[block.id] = e.nativeEvent.layout.y;
                }}
              >
                <Panel
                  color={
                    highlight === block.id ? t.colors.surfaceVariant : undefined
                  }
                >
                  <Text
                    variant="labelMedium"
                    style={{ color: t.colors.primary }}
                  >
                    TRANG {block.page}
                  </Text>
                  <EditableBlock
                    block={block}
                    size={settings.fontSize}
                    lineHeight={settings.lineHeight}
                    onSave={async (text) => {
                      stop();
                      const latest = await repository.get(id, ownerId);
                      if (latest)
                        await update(editBlock(latest, block.id, text));
                    }}
                  />
                  <Button
                    icon="creation"
                    disabled={busy}
                    onPress={() => withConsent(() => explain(block.id))}
                  >
                    Giải thích dễ hiểu
                  </Button>
                  {document.ai?.version === document.version &&
                    document.ai.explanations[block.id] && (
                      <Notice text={document.ai.explanations[block.id].text} />
                    )}
                </Panel>
              </View>
            ))}
            {!document.blocks.length && (
              <Notice text="Chưa có văn bản. Hãy thử nhận diện lại hoặc nhập tài liệu rõ hơn." />
            )}
          </>
        )}
        {tab === "summary" && (
          <>
            <Panel>
              <Text variant="titleLarge">Nắm ý chính, hiểu tận gốc</Text>
              <Text style={{ lineHeight: 24 }}>
                Tóm tắt được dẫn về nội dung của bạn. Luôn kiểm tra đoạn gốc khi
                cần độ chính xác cao.
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[...new Set(document.blocks.map((b) => b.page))].map(
                  (page) => (
                    <Chip
                      key={page}
                      selected={selectedPages.includes(page)}
                      onPress={() =>
                        setSelectedPages((pages) =>
                          pages.includes(page)
                            ? pages.filter((p) => p !== page)
                            : [...pages, page],
                        )
                      }
                    >
                      Trang {page}
                    </Chip>
                  ),
                )}
              </View>
              <Text variant="bodySmall">
                Chọn trang để tóm tắt · tối đa 30.000 ký tự
              </Text>
              <Button
                icon="creation"
                mode="contained"
                loading={busy}
                disabled={
                  busy || document.status !== "ready" || !selectedPages.length
                }
                onPress={() => withConsent(summarize)}
              >
                {document.ai?.summary ? "Tạo lại tóm tắt" : "Tạo bản tóm tắt"}
              </Button>
            </Panel>
            {stale && (
              <Notice text="Văn bản đã được sửa. Bản tóm tắt bên dưới thuộc phiên bản cũ; hãy tạo lại trước khi sử dụng." />
            )}
            {document.ai?.summary && (
              <>
                <Panel>
                  <Text variant="titleMedium">Tổng quan</Text>
                  <Text
                    style={{
                      fontSize: settings.fontSize,
                      lineHeight: settings.fontSize * settings.lineHeight,
                    }}
                  >
                    {document.ai.summary.overview}
                  </Text>
                </Panel>
                <Text variant="titleLarge">Những ý chính</Text>
                {document.ai.summary.points.map((point, i) => (
                  <Panel key={i}>
                    <Text
                      style={{ fontWeight: "700", color: t.colors.primary }}
                    >
                      Ý {i + 1}
                    </Text>
                    <Text
                      style={{
                        fontSize: settings.fontSize,
                        lineHeight: settings.fontSize * settings.lineHeight,
                      }}
                    >
                      {point.text}
                    </Text>
                    {point.sourceBlockIds.map((blockId, j) => (
                      <Button
                        key={blockId}
                        icon="text-box-search-outline"
                        onPress={() => source(blockId)}
                      >
                        Xem đoạn gốc
                        {point.sourceBlockIds.length > 1 ? " " + (j + 1) : ""}
                      </Button>
                    ))}
                  </Panel>
                ))}
                {document.ai.summary.terms.length > 0 && (
                  <Text variant="titleLarge">Thuật ngữ cần nhớ</Text>
                )}
                {document.ai.summary.terms.map((term, i) => (
                  <Panel key={i}>
                    <Text style={{ lineHeight: 25 }}>{term.text}</Text>
                    {term.sourceBlockIds.map((blockId) => (
                      <Button key={blockId} onPress={() => source(blockId)}>
                        Xem đoạn gốc
                      </Button>
                    ))}
                  </Panel>
                ))}
              </>
            )}
          </>
        )}
        {tab === "listen" && (
          <>
            <Panel>
              <Text variant="titleLarge">Để bài học cất tiếng</Text>
              <SegmentedButtons
                value={mode}
                onValueChange={(value) => {
                  stop();
                  setMode(value as typeof mode);
                  setIndex(0);
                }}
                buttons={[
                  { value: "original", label: "Bản gốc" },
                  { value: "summary", label: "Tóm tắt" },
                ]}
              />
              <Text style={{ textAlign: "center" }}>
                Đoạn{" "}
                {segments.length ? Math.min(index + 1, segments.length) : 0} /{" "}
                {segments.length}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <IconButton
                  size={30}
                  icon="skip-previous"
                  accessibilityLabel="Đoạn trước"
                  disabled={!segments.length}
                  onPress={() => play(Math.max(0, index - 1))}
                />
                <Button
                  mode="contained"
                  icon={playing ? "pause" : "play"}
                  onPress={() => (playing ? stop() : play(index))}
                >
                  {playing ? "Tạm dừng" : "Phát bài học"}
                </Button>
                <IconButton
                  size={30}
                  icon="skip-next"
                  accessibilityLabel="Đoạn tiếp"
                  disabled={!segments.length}
                  onPress={() => play(Math.min(segments.length - 1, index + 1))}
                />
              </View>
              <Text>Tốc độ đọc</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {[0.75, 1, 1.25, 1.5].map((rate) => (
                  <Chip
                    key={rate}
                    selected={settings.rate === rate}
                    onPress={() => {
                      stop();
                      settings.change({ rate });
                    }}
                  >
                    {rate}×
                  </Chip>
                ))}
              </View>
              <Text style={{ opacity: 0.65 }}>
                Tiếp tục sẽ đọc lại từ đầu đoạn hiện tại. Giữ ứng dụng mở khi
                nghe.
              </Text>
            </Panel>
            {segments.map((segment, i) => (
              <Panel
                key={i}
                color={i === index ? t.colors.surfaceVariant : undefined}
              >
                <Text
                  style={{
                    fontSize: settings.fontSize,
                    lineHeight: settings.fontSize * settings.lineHeight,
                  }}
                >
                  {segment}
                </Text>
                <Button icon="play" onPress={() => play(i)}>
                  Nghe đoạn này
                </Button>
              </Panel>
            ))}
          </>
        )}
      </ScrollView>
      <Portal>
        <Dialog visible={renaming} onDismiss={() => setRenaming(false)}>
          <Dialog.Title>Đổi tên tài liệu</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Tên tài liệu"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenaming(false)}>Hủy</Button>
            <Button
              disabled={!title.trim() || busy}
              onPress={() =>
                safe(async () => {
                  const latest = await repository.get(id, ownerId);
                  if (latest) await update({ ...latest, title: title.trim() });
                  setRenaming(false);
                })
              }
            >
              Lưu
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={consent} onDismiss={() => setConsent(false)}>
          <Dialog.Title>Cho phép xử lý bằng AI?</Dialog.Title>
          <Dialog.Content>
            <Text>
              Văn bản tài liệu sẽ được gửi tới Gemini để tạo nội dung học tập.
              Bản gốc vẫn lưu trên thiết bị.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConsent(false)}>Để sau</Button>
            <Button
              onPress={() => {
                preference.set("ai-consent:" + ownerId, "yes");
                setConsent(false);
                if (pending) void safe(pending);
              }}
            >
              Đồng ý
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={deleting} onDismiss={() => setDeleting(false)}>
          <Dialog.Title>Xóa tài liệu này?</Dialog.Title>
          <Dialog.Content>
            <Text>
              Tài liệu sẽ được xóa khỏi thư viện và thay đổi được đồng bộ khi có
              mạng.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleting(false)}>Giữ lại</Button>
            <Button
              onPress={() =>
                safe(async () => {
                  stop();
                  await update({ ...document, deleted: true });
                  router.replace("/library");
                })
              }
            >
              Xóa
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}
