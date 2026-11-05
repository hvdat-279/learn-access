import { useState } from "react";
import { View } from "react-native";
import { Button, Searchbar, Chip, Text } from "react-native-paper";
import { router } from "expo-router";
import {
  Screen,
  Heading,
  DocumentCard,
  Empty,
  Loading,
  Notice,
} from "../../ui/components";
import { useDocuments } from "../../ui/provider";
export default function Library() {
  const { data = [], isLoading, error } = useDocuments();
  const [search, setSearch] = useState("");
  const [favorite, setFavorite] = useState(false);
  const q = search.toLocaleLowerCase("vi");
  const list = data.filter(
    (d) =>
      (!favorite || d.favorite) &&
      (d.title + " " + d.blocks.map((b) => b.text).join(" "))
        .toLocaleLowerCase("vi")
        .includes(q),
  );
  return (
    <Screen>
      <Heading
        title="Thư viện của bạn"
        subtitle="Những điều đã học, luôn ở đây."
      />
      <Searchbar
        placeholder="Tìm tên hoặc nội dung…"
        value={search}
        onChangeText={setSearch}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip selected={!favorite} onPress={() => setFavorite(false)}>
          Tất cả · {data.length}
        </Chip>
        <Chip
          icon="star-outline"
          selected={favorite}
          onPress={() => setFavorite(!favorite)}
        >
          Yêu thích
        </Chip>
      </View>
      <Button
        mode="contained"
        icon="plus"
        onPress={() => router.push("/import")}
      >
        Thêm tài liệu
      </Button>
      <Text variant="labelLarge">{list.length} tài liệu</Text>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <Notice error text="Không đọc được thư viện." />
      ) : list.length ? (
        list.map((d) => <DocumentCard key={d.id} document={d} />)
      ) : (
        <Empty
          title={search ? "Chưa tìm thấy tài liệu" : "Chưa có tài liệu ở đây"}
          description={
            search
              ? "Thử một từ khóa khác nhé."
              : "Tài liệu bạn thêm sẽ xuất hiện tại đây."
          }
        />
      )}
    </Screen>
  );
}
