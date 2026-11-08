import { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, View, AppState, Platform, Pressable } from "react-native";
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
  RadioButton,
  Icon,
} from "react-native-paper";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import * as Speech from "expo-speech";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Screen, Heading, Panel, Notice, Loading } from "../../ui/components";
import { useAuth, useDocument, refreshDocuments, refreshPublicDocuments } from "../../ui/provider";
import { useSettings } from "../../ui/store";
import { repository, preference } from "../../data/repository";
import { ai } from "../../data/ai";
import { recognizeDocument } from "../../data/ingestion";
import {
  applySummary,
  applyQuiz,
  applyFlashcards,
  editBlock,
  setBlockHighlight,
  setBlockNote,
  setDocumentFolder,
  setDocumentPublic,
  speechSegments,
  type Document,
  type Block,
  type Flashcard,
  type QuizQuestion,
} from "../../domain/model";

function EditableBlock({
  block,
  isOwner,
  onSave,
  onHighlight,
  onNote,
  size,
  lineHeight,
}: {
  block: Block;
  isOwner: boolean;
  onSave: (text: string) => Promise<void>;
  onHighlight: (color: "yellow" | "green" | "blue" | "none") => Promise<void>;
  onNote: (note: string) => Promise<void>;
  size: number;
  lineHeight: number;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(block.text);
  const [error, setError] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(block.note || "");

  const t = useTheme();
  const isHighlighted = block.highlight && block.highlight !== "none";

  return (
    <View style={{ gap: 8 }}>
      {editing ? (
        <>
          <TextInput
            mode="outlined"
            multiline
            value={text}
            onChangeText={setText}
            accessibilityLabel="Sửa văn bản nhận diện"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              mode="contained"
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
          <View
            style={{
              borderLeftWidth: isHighlighted ? 3 : 0,
              borderLeftColor: t.colors.primary,
              paddingLeft: isHighlighted ? 10 : 0,
            }}
          >
            <Text
              selectable
              style={{
                fontSize: size,
                lineHeight: size * lineHeight,
                color: t.colors.onSurface,
              }}
            >
              {block.text}
            </Text>
          </View>

          {/* Ghi chú cá nhân nếu có */}
          {!!block.note && (
            <View
              style={{
                backgroundColor: t.colors.surfaceVariant,
                padding: 10,
                borderRadius: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontStyle: "italic",
                  color: t.colors.onSurfaceVariant,
                }}
              >
                Ghi chú: {block.note}
              </Text>
              {isOwner && (
                <IconButton
                  icon="close"
                  size={16}
                  onPress={() => onNote("")}
                  accessibilityLabel="Xóa ghi chú"
                />
              )}
            </View>
          )}

          {/* Thanh công cụ tối giản: Sửa chữ & Ghi chú */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            {isOwner && (
              <Button
                icon="pencil-outline"
                compact
                onPress={() => {
                  setText(block.text);
                  setEditing(true);
                }}
              >
                Sửa chữ
              </Button>
            )}

            <Button
              icon="note-plus-outline"
              compact
              onPress={() => {
                setNoteText(block.note || "");
                setEditingNote(true);
              }}
            >
              {block.note ? "Sửa ghi chú" : "Ghi chú"}
            </Button>
          </View>
        </>
      )}

      {/* Dialog nhập ghi chú */}
      <Portal>
        <Dialog visible={editingNote} onDismiss={() => setEditingNote(false)}>
          <Dialog.Title>Ghi chú cho đoạn văn</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Nội dung ghi chú cá nhân"
              multiline
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Ví dụ: Nhớ ôn kỹ công thức này thi cuối kỳ…"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditingNote(false)}>Hủy</Button>
            <Button
              onPress={async () => {
                await onNote(noteText);
                setEditingNote(false);
              }}
            >
              Lưu ghi chú
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  const { ownerId, email } = useAuth();
  const isGuest = ownerId === "local";
  const isOwner = document.ownerId === ownerId;

  const settings = useSettings();
  const t = useTheme();

  const [selectedPages, setSelectedPages] = useState<number[]>(() => [
    ...new Set(document.blocks.map((b) => b.page)),
  ]);

  const [tab, setTab] = useState("text");
  const [studyMode, setStudyMode] = useState<"flashcards" | "quiz">("flashcards");
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
  const [mode, setMode] = useState<"original" | "summary">(document.progress.mode);

  // Thư mục & Xuất file & Chia sẻ
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderText, setFolderText] = useState(document.folder || "");
  const [communityDialog, setCommunityDialog] = useState(false);
  const [authorNameText, setAuthorNameText] = useState(document.authorName || email?.split("@")[0] || "Sinh viên");
  const [exporting, setExporting] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Auth Dialog khi khách bấm tính năng yêu cầu đăng nhập
  const [authDialog, setAuthDialog] = useState(false);
  const [authReason, setAuthReason] = useState("");

  // Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Thêm văn bản thủ công khi ảnh chưa có OCR
  const [addTextModal, setAddTextModal] = useState(false);
  const [manualText, setManualText] = useState("");

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

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

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(timer);
  }, [error]);

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
    if (isGuest) {
      setAuthReason("sử dụng tính năng AI Gemini tóm tắt và giải thích bài học (mỗi tài khoản nhận 20 lượt AI miễn phí mỗi ngày)");
      setAuthDialog(true);
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
        flashcards: latest.ai?.version === version ? latest.ai.flashcards : undefined,
        quiz: latest.ai?.version === version ? latest.ai.quiz : undefined,
        explanations: {
          ...(latest.ai?.version === version ? latest.ai.explanations : {}),
          [blockId]: result,
        },
      },
    });
  }

  // Helper xáo trộn ngẫu nhiên đáp án trắc nghiệm
  function shuffleQuestion(
    qid: string,
    questionText: string,
    correctText: string,
    distractors: string[],
    explanationText: string,
  ): QuizQuestion {
    const rawOptions = [
      { text: correctText, isCorrect: true },
      ...distractors.slice(0, 3).map((d) => ({ text: d, isCorrect: false })),
    ];
    // Xáo trộn ngẫu nhiên thứ tự các phương án
    const shuffled = [...rawOptions].sort(() => Math.random() - 0.5);
    const correctIndex = shuffled.findIndex((o) => o.isCorrect);
    const prefixes = ["A. ", "B. ", "C. ", "D. "];

    return {
      id: qid,
      question: questionText,
      options: shuffled.map((o, i) => `${prefixes[i]}${o.text}`),
      correctIndex: Math.max(0, correctIndex),
      explanation: explanationText,
    };
  }

  // Tự động tạo Quiz trắc nghiệm thông minh có xáo trộn ngẫu nhiên
  async function generateAiQuiz() {
    if (!document) return;
    const questions: QuizQuestion[] = [];
    const summary = document.ai?.summary;

    if (summary && summary.terms.length > 0) {
      summary.terms.slice(0, 3).forEach((term, idx) => {
        const parts = term.text.split(/:\s*|\s*-\s*|\s*—\s*/);
        const concept = parts[0]?.trim() || `Thuật ngữ ${idx + 1}`;
        const definition = parts.slice(1).join(": ").trim() || term.text;
        questions.push(
          shuffleQuestion(
            `quiz-term-${idx}-${Date.now()}`,
            `Theo bài học, khái niệm "${concept}" được định nghĩa như thế nào?`,
            definition,
            [
              "Là một khái niệm trừu tượng không có tính ứng dụng thực tiễn",
              "Đối lập hoàn toàn với các nguyên lý cơ bản của lĩnh vực này",
              "Là giả thuyết đang trong quá trình thử nghiệm ban đầu",
            ],
            `Căn cứ theo tài liệu: "${term.text}"`,
          ),
        );
      });
    }

    if (summary && summary.points.length > 0) {
      summary.points.slice(0, 2).forEach((point, idx) => {
        questions.push(
          shuffleQuestion(
            `quiz-point-${idx}-${Date.now()}`,
            `Nhận định nào sau đây là ĐÚNG về nội dung trọng tâm của bài?`,
            point.text,
            [
              "Nội dung bài học không đề cập hay xác nhận yếu tố này",
              "Kết luận trên chỉ đúng trong môi trường lý thuyết hoàn hảo",
              "Không thể xác định được nguyên nhân chính trong hoàn cảnh thực tế",
            ],
            `Căn cứ theo ý chính bài học: "${point.text}"`,
          ),
        );
      });
    }

    if (questions.length === 0) {
      document.blocks.slice(0, 4).forEach((b, idx) => {
        questions.push(
          shuffleQuestion(
            `quiz-block-${idx}-${Date.now()}`,
            `Nội dung nào sau đây xuất hiện trong đoạn văn số ${idx + 1}?`,
            b.text.slice(0, 80) + "…",
            [
              "Đoạn văn bàn về một chủ đề công nghệ hoàn toàn khác",
              "Nội dung đã bị bác bỏ bởi các nghiên cứu khoa học mới",
              "Không có dữ liệu thực tế nào để đối chiếu",
            ],
            `Trích từ đoạn văn: "${b.text.slice(0, 100)}…"`,
          ),
        );
      });
    }

    await update(applyQuiz(document, questions));
    setQuizSubmitted(false);
    setQuizAnswers({});
  }

  // Xuất tài liệu học tập PDF / In
  async function handleExport() {
    setExporting(true);
    try {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${document.title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 36px; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 0 auto; }
              h1 { color: #43338E; border-bottom: 2px solid #6650D8; padding-bottom: 8px; margin-bottom: 4px; }
              .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
              h2 { color: #5945C6; margin-top: 26px; border-left: 4px solid #BE7F13; padding-left: 10px; font-size: 18px; }
              .summary-box { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 18px; margin: 16px 0; }
              .point { margin: 8px 0; }
              .term { background: #fef3c7; padding: 4px 8px; border-radius: 6px; font-weight: bold; display: inline-block; margin: 4px 0; }
              .block { margin-bottom: 14px; padding: 10px 14px; border-radius: 8px; background: #fafafa; border: 1px solid #f1f5f9; }
              .highlight-yellow { background-color: #fef08a !important; }
              .highlight-green { background-color: #bbf7d0 !important; }
              .highlight-blue { background-color: #bae6fd !important; }
              .note { background: #fef9c3; border-left: 3px solid #eab308; padding: 8px 12px; margin-top: 8px; font-style: italic; font-size: 14px; border-radius: 4px; }
              .quiz-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 8px; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h1>${document.title}</h1>
            <div class="meta">
              Ứng dụng học tập LearnAccess • Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}
              ${document.folder ? ` • Môn học: <strong>${document.folder}</strong>` : ""}
              ${document.authorName ? ` • Tác giả: <strong>${document.authorName}</strong>` : ""}
            </div>

            ${
              document.ai?.summary
                ? `
              <h2>📌 TÓM TẮT TRỌNG TÂM TỪ AI</h2>
              <div class="summary-box">
                <p><strong>Tổng quan:</strong> ${document.ai.summary.overview}</p>
                <div style="margin-top: 10px;">
                  ${document.ai.summary.points.map((p, i) => `<div class="point">• <strong>Ý ${i + 1}:</strong> ${p.text}</div>`).join("")}
                </div>
                ${
                  document.ai.summary.terms.length
                    ? `
                  <h3 style="margin-top: 14px; font-size: 15px;">Thuật ngữ quan trọng:</h3>
                  <div>
                    ${document.ai.summary.terms.map((t) => `<div class="term">${t.text}</div>`).join(" ")}
                  </div>
                `
                    : ""
                }
              </div>
            `
                : ""
            }

            ${
              document.ai?.quiz?.length
                ? `
              <h2>🎯 CÂU HỎI ÔN TẬP (AI QUIZ)</h2>
              ${document.ai.quiz
                .map(
                  (q, i) => `
                <div class="quiz-box">
                  <p><strong>Câu ${i + 1}:</strong> ${q.question}</p>
                  <ul style="list-style-type: none; padding-left: 0;">
                    ${q.options.map((opt) => `<li style="padding: 2px 0;">${opt}</li>`).join("")}
                  </ul>
                  <p style="font-size: 13px; color: #15803d;"><strong>Đáp án & Giải thích:</strong> ${q.explanation}</p>
                </div>
              `,
                )
                .join("")}
            `
                : ""
            }

            <h2>📖 NỘI DUNG VĂN BẢN CHI TIẾT</h2>
            ${document.blocks
              .map(
                (b) => `
              <div class="block ${b.highlight ? `highlight-${b.highlight}` : ""}">
                <p style="margin: 0;">${b.text}</p>
                ${b.note ? `<div class="note">📝 <strong>Ghi chú cá nhân:</strong> ${b.note}</div>` : ""}
              </div>
            `,
              )
              .join("")}
          </body>
        </html>
      `;

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        try {
          // Thử tạo file PDF và đưa vào thư mục cache chuẩn của app để chia sẻ
          const { uri } = await Print.printToFileAsync({ html });
          let shareUri = uri;
          try {
            const cleanTitle =
              document.title
                .replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, "_")
                .substring(0, 40) || "TaiLieu";
            const target = new File(Paths.cache, `${cleanTitle}.pdf`);
            const source = new File(uri);
            await source.copy(target);
            shareUri = target.uri;
          } catch {}

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(shareUri, {
              UTI: ".pdf",
              mimeType: "application/pdf",
              dialogTitle: `Xuất bài học PDF: ${document.title}`,
            });
          } else {
            await Print.printAsync({ html });
          }
        } catch {
          // Nếu thiết bị / Expo Go giới hạn chia sẻ file, mở ngay trình Lưu PDF & In ấn hệ thống
          await Print.printAsync({ html });
        }
      }
    } catch (e) {
      setError("Không thể xuất file: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
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
      if (latest && isOwner)
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

  // Flashcards chuẩn bị
  const flashcards = document.ai?.flashcards ?? [];
  const currentCard = flashcards[cardIndex];
  const knownCount = flashcards.filter((f) => f.known).length;

  // Quiz chuẩn bị
  const quiz = document.ai?.quiz ?? [];
  const quizScore = quiz.reduce(
    (score, q) => (quizAnswers[q.id] === q.correctIndex ? score + 1 : score),
    0,
  );

  return (
    <Screen scroll={false}>
      {/* Thanh điều hướng trên cùng */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <IconButton
          icon="arrow-left"
          size={24}
          style={{ margin: 0 }}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {isOwner && (
            <IconButton
              icon="folder-outline"
              size={20}
              accessibilityLabel="Gán thư mục"
              onPress={() => {
                setFolderText(document.folder || "");
                setFolderDialog(true);
              }}
            />
          )}

          <IconButton
            icon="file-pdf-box"
            size={20}
            accessibilityLabel="Xuất PDF"
            loading={exporting}
            disabled={exporting}
            onPress={handleExport}
          />

          {isOwner && (
            <IconButton
              icon={document.isPublic ? "earth" : "share-variant-outline"}
              size={20}
              iconColor={document.isPublic ? t.colors.primary : undefined}
              accessibilityLabel="Chia sẻ cộng đồng"
              onPress={() => {
                if (isGuest) {
                  setAuthReason("chia sẻ bài học của bạn lên Cộng đồng học tập");
                  setAuthDialog(true);
                  return;
                }
                setAuthorNameText(document.authorName || email?.split("@")[0] || "Sinh viên");
                setCommunityDialog(true);
              }}
            />
          )}

          {isOwner && (
            <IconButton
              icon={document.favorite ? "star" : "star-outline"}
              iconColor={document.favorite ? "#EAB308" : undefined}
              size={20}
              accessibilityLabel="Yêu thích"
              onPress={() => {
                void update({ ...document, favorite: !document.favorite });
              }}
            />
          )}

          {isOwner && (
            <IconButton
              icon="delete-outline"
              size={20}
              accessibilityLabel="Xóa"
              onPress={() => setDeleting(true)}
            />
          )}
        </View>
      </View>

      {/* Tiêu đề tài liệu to rõ ràng, không bị co ép */}
      <Pressable
        style={{
          paddingVertical: 6,
          paddingHorizontal: 4,
          marginBottom: 10,
        }}
        onPress={() => {
          if (isOwner) {
            setTitle(document.title);
            setRenaming(true);
          }
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Text
            variant="headlineSmall"
            style={{ fontWeight: "800", flex: 1, lineHeight: 30 }}
            numberOfLines={3}
          >
            {document.title.length === 36 && document.title.includes("-")
              ? "Bài học mới (Chạm để đổi tên)"
              : document.title}
          </Text>
          {isOwner && (
            <IconButton
              icon="pencil-outline"
              size={18}
              style={{ margin: 0, marginTop: 4 }}
              accessibilityLabel="Đổi tên"
              onPress={() => {
                setTitle(document.title);
                setRenaming(true);
              }}
            />
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            marginTop: 6,
            flexWrap: "wrap",
          }}
        >
          {document.folder ? (
            <Chip compact icon="folder-outline">
              {document.folder}
            </Chip>
          ) : (
            <Chip
              compact
              icon="folder-plus-outline"
              onPress={() => isOwner && setFolderDialog(true)}
            >
              Chưa gắn thư mục
            </Chip>
          )}
          <Chip compact icon="text-box-outline">
            {document.blocks.length} đoạn văn
          </Chip>
          <Chip compact icon="calendar-outline">
            {new Date(document.updatedAt).toLocaleDateString("vi-VN")}
          </Chip>
        </View>
      </Pressable>

      {/* Banner nếu là bài của cộng đồng */}
      {!isOwner && (
        <View
          style={{
            backgroundColor: "#F5F3FF",
            padding: 10,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
            borderWidth: 1,
            borderColor: "#DDD6FE",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", color: "#5945C6", fontSize: 13 }}>
              Tài liệu Cộng đồng • {document.authorName || "Sinh viên"}
            </Text>
          </View>
          <Button
            mode="contained"
            compact
            icon="download"
            loading={cloning}
            disabled={cloning}
            onPress={() => {
              if (isGuest) {
                setAuthReason("lưu tài liệu này về Thư viện cá nhân để học và làm Quiz offline");
                setAuthDialog(true);
                return;
              }
              safe(async () => {
                setCloning(true);
                const clone = await repository.cloneToMyLibrary(document, ownerId);
                await refreshDocuments();
                setCloning(false);
                router.replace(`/document/${clone.id}`);
              });
            }}
          >
            Lưu về máy
          </Button>
        </View>
      )}

      {/* 4 Tabs học tập */}
      <SegmentedButtons
        value={tab}
        onValueChange={(value) => {
          stop();
          setTab(value);
        }}
        buttons={[
          { value: "text", label: "Văn bản" },
          { value: "summary", label: "Tóm tắt" },
          { value: "study", label: "Ôn tập" },
          { value: "listen", label: "Nghe" },
        ]}
        style={{ marginBottom: 6 }}
      />

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ gap: 14, paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && <Notice error text={error} />}

        {/* Tab 1: VĂN BẢN (Text) - Không bị chia ô vụn vặt, tràn to toàn màn hình */}
        {tab === "text" && (
          <View style={{ gap: 12 }}>
            {/* Thanh công cụ xem ảnh và cỡ chữ */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 2,
              }}
            >
              {document.pages.length > 0 && (
                <Button
                  compact
                  icon="image-outline"
                  onPress={() => setShowImages(!showImages)}
                >
                  {showImages ? "Ẩn ảnh gốc" : "Xem ảnh gốc"}
                </Button>
              )}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <IconButton
                  icon="format-font-size-decrease"
                  size={20}
                  accessibilityLabel="Giảm cỡ chữ"
                  onPress={() =>
                    settings.change({
                      fontSize: Math.max(14, settings.fontSize - 2),
                    })
                  }
                />
                <Text style={{ fontSize: 13, opacity: 0.6 }}>
                  {settings.fontSize}px
                </Text>
                <IconButton
                  icon="format-font-size-increase"
                  size={20}
                  accessibilityLabel="Tăng cỡ chữ"
                  onPress={() =>
                    settings.change({
                      fontSize: Math.min(32, settings.fontSize + 2),
                    })
                  }
                />
              </View>
            </View>

            {/* Ảnh gốc nếu có */}
            {showImages &&
              document.pages.map((p, i) => (
                <View
                  key={p.id}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: t.colors.outlineVariant,
                    backgroundColor: t.colors.surface,
                    marginBottom: 8,
                  }}
                >
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
                </View>
              ))}

            {/* Khung đọc văn bản toàn màn hình - thiết kế phẳng như sách, không chia ô vụn */}
            {document.blocks.length > 0 && (
              <View
                style={{
                  backgroundColor: t.colors.surface,
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: t.colors.surfaceVariant,
                  gap: 18,
                }}
              >
                {document.blocks.map((block, idx) => (
                  <View
                    key={block.id}
                    style={{
                      borderBottomWidth: idx < document.blocks.length - 1 ? 1 : 0,
                      borderBottomColor: t.colors.surfaceVariant,
                      paddingBottom: idx < document.blocks.length - 1 ? 16 : 0,
                    }}
                    onLayout={(e) => {
                      offsets.current[block.id] = e.nativeEvent.layout.y;
                    }}
                  >
                    <EditableBlock
                      block={block}
                      isOwner={isOwner}
                      size={settings.fontSize}
                      lineHeight={settings.lineHeight}
                      onSave={async (text) => {
                        stop();
                        const latest = await repository.get(id, ownerId);
                        if (latest && isOwner)
                          await update(editBlock(latest, block.id, text));
                      }}
                      onHighlight={async (color) => {
                        const latest = await repository.get(id, ownerId);
                        if (latest && isOwner)
                          await update(setBlockHighlight(latest, block.id, color));
                      }}
                      onNote={async (note) => {
                        const latest = await repository.get(id, ownerId);
                        if (latest && isOwner)
                          await update(setBlockNote(latest, block.id, note));
                      }}
                    />
                    {isOwner && (
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "flex-end",
                          marginTop: 4,
                        }}
                      >
                        <Button
                          compact
                          icon="creation"
                          disabled={busy}
                          onPress={() => withConsent(() => explain(block.id))}
                        >
                          Giải thích đoạn này
                        </Button>
                      </View>
                    )}
                    {document.ai?.version === document.version &&
                      document.ai.explanations[block.id] && (
                        <Notice text={document.ai.explanations[block.id].text} />
                      )}
                  </View>
                ))}
              </View>
            )}

            {!document.blocks.length && (
              <Panel>
                <View style={{ gap: 12, alignItems: "center", paddingVertical: 12 }}>
                  <Icon source="text-box-plus-outline" size={44} color={t.colors.primary} />
                  <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                    Tài liệu chưa có nội dung văn bản
                  </Text>
                  <Text style={{ textAlign: "center", opacity: 0.8, lineHeight: 20 }}>
                    Bạn có thể bấm nút bên dưới để dán hoặc nhập nội dung bài học vào đây để ôn tập và tạo Quiz nhé!
                  </Text>
                  {isOwner && (
                    <Button
                      mode="contained"
                      icon="pencil-plus"
                      onPress={() => setAddTextModal(true)}
                      style={{ marginTop: 6 }}
                    >
                      Dán / Nhập nội dung bài học
                    </Button>
                  )}
                </View>
              </Panel>
            )}
          </View>
        )}

        {/* Tab 2: TÓM TẮT (Summary) */}
        {tab === "summary" && (
          <>
            <Panel>
              <Text variant="titleLarge">Nắm ý chính, hiểu tận gốc</Text>
              <Text style={{ lineHeight: 24 }}>
                Tóm tắt được dẫn về nội dung của bạn. Luôn kiểm tra đoạn gốc khi
                cần độ chính xác cao.
              </Text>
              {document.pages.length > 0 && (
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
              )}
              {isOwner && (
                <Button
                  icon="creation"
                  mode="contained"
                  loading={busy}
                  disabled={busy}
                  onPress={() => withConsent(summarize)}
                >
                  {document.ai?.summary ? "Tạo lại tóm tắt" : "Tạo bản tóm tắt"}
                </Button>
              )}
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

        {/* Tab 3: ÔN TẬP THÔNG MINH (Study: Flashcards & Quiz) */}
        {tab === "study" && (
          <>
            <SegmentedButtons
              value={studyMode}
              onValueChange={(val) => setStudyMode(val as typeof studyMode)}
              buttons={[
                { value: "flashcards", label: "Thẻ nhớ (Flashcards)" },
                { value: "quiz", label: "Trắc nghiệm (Quiz)" },
              ]}
            />

            {/* Phân hệ 1: Lật thẻ ghi nhớ Flashcards */}
            {studyMode === "flashcards" && (
              <>
                {flashcards.length > 0 ? (
                  <Panel>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text variant="labelLarge" style={{ color: t.colors.primary }}>
                        THẺ {cardIndex + 1} / {flashcards.length}
                      </Text>
                      <Chip compact icon={currentCard?.known ? "check" : "help"}>
                        {currentCard?.known ? "Đã thuộc" : "Đang học"}
                      </Chip>
                    </View>

                    {/* Khối thẻ lật tương tác */}
                    <View
                      style={{
                        minHeight: 180,
                        backgroundColor: cardFlipped
                          ? t.colors.primaryContainer ?? "#EDE9FE"
                          : t.colors.surfaceVariant,
                        borderRadius: 18,
                        padding: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        borderWidth: 1.5,
                        borderColor: cardFlipped ? t.colors.primary : "transparent",
                      }}
                    >
                      <Text
                        variant="labelSmall"
                        style={{
                          letterSpacing: 1.5,
                          color: cardFlipped ? t.colors.primary : t.colors.onSurfaceVariant,
                          fontWeight: "700",
                        }}
                      >
                        {cardFlipped ? "MẶT SAU (ĐỊNH NGHĨA / GIẢI THÍCH)" : "MẶT TRƯỚC (CÂU HỎI / KHÁI NIỆM)"}
                      </Text>
                      <Text
                        variant="titleMedium"
                        style={{
                          textAlign: "center",
                          lineHeight: 26,
                          fontWeight: cardFlipped ? "500" : "700",
                        }}
                      >
                        {cardFlipped ? currentCard?.back : currentCard?.front}
                      </Text>
                      <Button
                        mode="contained-tonal"
                        icon="sync"
                        onPress={() => setCardFlipped(!cardFlipped)}
                      >
                        {cardFlipped ? "Xem lại câu hỏi" : "Lật xem đáp án"}
                      </Button>
                    </View>

                    {/* Điều hướng thẻ */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <IconButton
                        icon="arrow-left"
                        disabled={cardIndex === 0}
                        onPress={() => {
                          setCardFlipped(false);
                          setCardIndex((i) => Math.max(0, i - 1));
                        }}
                      />
                      <Button
                        mode={currentCard?.known ? "outlined" : "contained"}
                        textColor={currentCard?.known ? "#15803D" : undefined}
                        icon={currentCard?.known ? "check" : "check-outline"}
                        onPress={async () => {
                          const updated = [...flashcards];
                          updated[cardIndex] = {
                            ...updated[cardIndex],
                            known: !updated[cardIndex].known,
                          };
                          await update(applyFlashcards(document, updated));
                        }}
                      >
                        {currentCard?.known ? "Đánh dấu chưa thuộc" : "Đã thuộc thẻ này"}
                      </Button>
                      <IconButton
                        icon="arrow-right"
                        disabled={cardIndex === flashcards.length - 1}
                        onPress={() => {
                          setCardFlipped(false);
                          setCardIndex((i) => Math.min(flashcards.length - 1, i + 1));
                        }}
                      />
                    </View>
                    <Text style={{ textAlign: "center", opacity: 0.7 }}>
                      Tiến độ: Đã thuộc {knownCount}/{flashcards.length} thẻ ({Math.round((knownCount / flashcards.length) * 100)}%)
                    </Text>
                  </Panel>
                ) : (
                  <Panel>
                    <Text variant="titleMedium">Chưa có thẻ ghi nhớ Flashcard</Text>
                    <Text style={{ opacity: 0.7, lineHeight: 22 }}>
                      Hãy tạo bản tóm tắt AI ở tab "Tóm tắt" để hệ thống tự động trích xuất các thuật ngữ thành bộ Flashcards, hoặc tạo câu hỏi trắc nghiệm ngay bên dưới!
                    </Text>
                    <Button
                      mode="contained"
                      icon="creation"
                      onPress={() => setTab("summary")}
                    >
                      Sang tạo tóm tắt
                    </Button>
                  </Panel>
                )}
              </>
            )}

            {/* Phân hệ 2: Đề trắc nghiệm AI Quiz */}
            {studyMode === "quiz" && (
              <>
                {quiz.length > 0 ? (
                  <>
                    <Panel>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text variant="titleMedium" style={{ fontWeight: "700" }}>
                          Đề kiểm tra kiến thức ({quiz.length} câu)
                        </Text>
                        <Button
                          icon="refresh"
                          compact
                          onPress={generateAiQuiz}
                        >
                          Đổi đề mới
                        </Button>
                      </View>
                      <Text style={{ opacity: 0.7 }}>
                        Chọn câu trả lời đúng nhất và nhấn "Nộp bài & Chấm điểm".
                      </Text>
                    </Panel>

                    {quizSubmitted && (
                      <View
                        style={{
                          backgroundColor: t.colors.surfaceVariant,
                          padding: 16,
                          borderRadius: 16,
                          alignItems: "center",
                          gap: 6,
                          borderLeftWidth: 4,
                          borderLeftColor:
                            quizScore / quiz.length >= 0.7 ? "#22C55E" : "#EAB308",
                        }}
                      >
                        <Text variant="titleMedium" style={{ fontWeight: "700", color: t.colors.onSurface }}>
                          {quizScore / quiz.length >= 0.7 ? "🎉 Hoàn thành xuất sắc!" : "📖 Cần ôn tập thêm!"}
                        </Text>
                        <Text variant="headlineSmall" style={{ fontWeight: "800", color: t.colors.onSurface }}>
                          {quizScore} / {quiz.length} câu đúng ({Math.round((quizScore / quiz.length) * 100)}%)
                        </Text>
                      </View>
                    )}

                    {quiz.map((q, qIndex) => {
                      const selected = quizAnswers[q.id];
                      const isCorrect = selected === q.correctIndex;

                      return (
                        <Panel key={q.id}>
                          <Text
                            variant="labelLarge"
                            style={{ color: t.colors.primary, fontWeight: "700" }}
                          >
                            CÂU {qIndex + 1}:
                          </Text>
                          <Text variant="titleMedium" style={{ fontWeight: "700", lineHeight: 24, color: t.colors.onSurface }}>
                            {q.question}
                          </Text>

                          {/* 4 phương án lựa chọn đã được xáo trộn ngẫu nhiên */}
                          <View style={{ gap: 8, marginTop: 4 }}>
                            {q.options.map((opt, optIndex) => {
                              const isSelected = selected === optIndex;
                              const isRightOption = optIndex === q.correctIndex;

                              let bg = isSelected ? t.colors.surfaceVariant : undefined;
                              let borderColor = isSelected
                                ? t.colors.primary
                                : (t.colors.outlineVariant ?? "rgba(150, 150, 150, 0.2)");

                              if (quizSubmitted) {
                                if (isRightOption) {
                                  bg = "rgba(34, 197, 94, 0.12)";
                                  borderColor = "#22C55E";
                                } else if (isSelected && !isCorrect) {
                                  bg = "rgba(239, 68, 68, 0.12)";
                                  borderColor = "#EF4444";
                                }
                              }

                              return (
                                <View
                                  key={optIndex}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    padding: 8,
                                    borderRadius: 12,
                                    backgroundColor: bg,
                                    borderWidth: 1,
                                    borderColor,
                                  }}
                                >
                                  <RadioButton
                                    value={String(optIndex)}
                                    status={isSelected ? "checked" : "unchecked"}
                                    disabled={quizSubmitted}
                                    color={quizSubmitted && isRightOption ? "#22C55E" : undefined}
                                    onPress={() => {
                                      setQuizAnswers({
                                        ...quizAnswers,
                                        [q.id]: optIndex,
                                      });
                                    }}
                                  />
                                  <Text style={{ flex: 1, lineHeight: 20, color: t.colors.onSurface }}>{opt}</Text>
                                </View>
                              );
                            })}
                          </View>

                          {/* Giải thích sau khi nộp */}
                          {quizSubmitted && (
                            <View
                              style={{
                                backgroundColor: t.colors.surfaceVariant,
                                padding: 12,
                                borderRadius: 10,
                                marginTop: 6,
                                borderLeftWidth: 3,
                                borderLeftColor: isCorrect ? "#22C55E" : "#EF4444",
                              }}
                            >
                              <Text
                                style={{
                                  fontWeight: "700",
                                  color: isCorrect ? "#22C55E" : "#EF4444",
                                }}
                              >
                                {isCorrect ? "✔ Đáp án chính xác" : "❌ Chưa chính xác"}
                              </Text>
                              <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: t.colors.onSurfaceVariant }}>
                                {q.explanation}
                              </Text>
                            </View>
                          )}
                        </Panel>
                      );
                    })}

                    <View style={{ gap: 10 }}>
                      {!quizSubmitted ? (
                        <Button
                          mode="contained"
                          icon="check"
                          onPress={() => setQuizSubmitted(true)}
                        >
                          Nộp bài & Chấm điểm
                        </Button>
                      ) : (
                        <Button
                          mode="contained-tonal"
                          icon="refresh"
                          onPress={() => {
                            setQuizSubmitted(false);
                            setQuizAnswers({});
                          }}
                        >
                          Làm lại bài kiểm tra
                        </Button>
                      )}
                    </View>
                  </>
                ) : (
                  <Panel>
                    <Text variant="titleMedium">Chưa có bộ câu hỏi trắc nghiệm</Text>
                    <Text style={{ opacity: 0.7, lineHeight: 22 }}>
                      Hệ thống có thể đọc nội dung bài học và tự động tạo ra một đề trắc nghiệm khách quan 5 câu để bạn kiểm tra độ hiểu bài ngay lập tức!
                    </Text>
                    <Button
                      mode="contained"
                      icon="help-circle"
                      onPress={generateAiQuiz}
                    >
                      🎯 Tạo đề trắc nghiệm AI ngay
                    </Button>
                  </Panel>
                )}
              </>
            )}
          </>
        )}

        {/* Tab 4: NGHE (Listen / TTS) */}
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

      {/* Portal Dialogs */}
      <Portal>
        {/* Dialog Yêu cầu Đăng nhập (cho khách) */}
        <Dialog visible={authDialog} onDismiss={() => setAuthDialog(false)}>
          <Dialog.Title>Yêu cầu đăng nhập</Dialog.Title>
          <Dialog.Content>
            <Text style={{ lineHeight: 22 }}>
              Bạn cần đăng nhập tài khoản để có thể {authReason}.
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

        {/* Dialog Gán thư mục */}
        <Dialog visible={folderDialog} onDismiss={() => setFolderDialog(false)}>
          <Dialog.Title>Gán thư mục môn học</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <TextInput
              mode="outlined"
              label="Tên môn học / Thư mục"
              value={folderText}
              onChangeText={setFolderText}
              placeholder="Ví dụ: Triết học, Toán, Lập trình…"
            />
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {["Triết học", "Lập trình", "Toán", "Tiếng Anh", "Kinh tế"].map((f) => (
                <Chip key={f} compact onPress={() => setFolderText(f)}>
                  {f}
                </Chip>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFolderDialog(false)}>Hủy</Button>
            <Button
              onPress={async () => {
                await update(setDocumentFolder(document, folderText));
                setFolderDialog(false);
              }}
            >
              Lưu thư mục
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog Chia sẻ lên Cộng đồng */}
        <Dialog visible={communityDialog} onDismiss={() => setCommunityDialog(false)}>
          <Dialog.Title>Chia sẻ lên Cộng đồng</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <Text>
              Khi chia sẻ công khai, các sinh viên khác có thể tìm thấy, đọc tóm tắt và làm bài Quiz của bạn trên tab Cộng đồng.
            </Text>
            <TextInput
              mode="outlined"
              label="Tên hiển thị của bạn (Tác giả)"
              value={authorNameText}
              onChangeText={setAuthorNameText}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCommunityDialog(false)}>Đóng</Button>
            {document.isPublic ? (
              <Button
                textColor="#DC2626"
                onPress={async () => {
                  await update(setDocumentPublic(document, false));
                  await refreshPublicDocuments();
                  setCommunityDialog(false);
                }}
              >
                Hủy chia sẻ
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={async () => {
                  await update(setDocumentPublic(document, true, authorNameText.trim()));
                  await refreshPublicDocuments();
                  setCommunityDialog(false);
                }}
              >
                Công khai ngay
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>

        {/* Dialog Đổi tên */}
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
                  if (latest && isOwner) await update({ ...latest, title: title.trim() });
                  setRenaming(false);
                })
              }
            >
              Lưu
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog Xác nhận gửi AI */}
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

        {/* Dialog Dán / Nhập văn bản bài học */}
        <Dialog visible={addTextModal} onDismiss={() => setAddTextModal(false)}>
          <Dialog.Title>Nhập nội dung bài học</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8, opacity: 0.75 }}>
              Dán nội dung giáo trình, tài liệu hoặc ghi chú của bạn vào đây:
            </Text>
            <TextInput
              mode="outlined"
              label="Nội dung bài học"
              placeholder="Dán hoặc gõ văn bản tại đây…"
              value={manualText}
              onChangeText={setManualText}
              multiline
              numberOfLines={8}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddTextModal(false)}>Hủy</Button>
            <Button
              mode="contained"
              disabled={!manualText.trim()}
              onPress={async () => {
                const paragraphs = manualText
                  .trim()
                  .split(/\n\s*\n/)
                  .map((t) => t.trim())
                  .filter(Boolean);
                const newBlocks: Block[] = paragraphs.map((t) => ({
                  id: Crypto.randomUUID(),
                  page: 1,
                  text: t,
                  original: t,
                }));
                await update({
                  ...document,
                  status: "ready",
                  blocks: newBlocks,
                });
                setAddTextModal(false);
                setManualText("");
                setError("");
              }}
            >
              Lưu bài học
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Dialog Xóa */}
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
                  if (isOwner) {
                    await update({ ...document, deleted: true });
                    router.replace("/library");
                  }
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
