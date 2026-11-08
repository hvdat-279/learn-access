import { Tabs } from "expo-router";
import { Icon, useTheme } from "react-native-paper";

export default function TabLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopWidth: 0 },
        tabBarLabelStyle: { fontWeight: "600", fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color }) => (
            <Icon
              source="home-variant-outline"
              size={24}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Thư viện",
          tabBarIcon: ({ color }) => (
            <Icon
              source="bookshelf"
              size={24}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Cộng đồng",
          tabBarIcon: ({ color }) => (
            <Icon
              source="account-group-outline"
              size={24}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Cá nhân",
          tabBarIcon: ({ color }) => (
            <Icon
              source="account-circle-outline"
              size={24}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
    </Tabs>
  );
}
