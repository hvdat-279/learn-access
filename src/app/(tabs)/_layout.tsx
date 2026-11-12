import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { Icon, Text, useTheme } from "react-native-paper";
import { View, Pressable } from "react-native";

const TAB_META: Record<
  string,
  { label: string; icon: string; activeIcon: string }
> = {
  index: {
    label: "Trang chủ",
    icon: "home-variant-outline",
    activeIcon: "home-variant",
  },
  library: {
    label: "Thư viện",
    icon: "book-open-outline",
    activeIcon: "book-open-variant",
  },
  community: {
    label: "Cộng đồng",
    icon: "account-group-outline",
    activeIcon: "account-group",
  },
  profile: {
    label: "Cá nhân",
    icon: "account-circle-outline",
    activeIcon: "account-circle",
  },
};

function BottomMenu({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
  const bottomPad = Math.max(insets.bottom, 10);
  const visibleRoutes = state.routes.filter((r) => Boolean(TAB_META[r.name]));

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: t.colors.surface,
        borderTopWidth: 1,
        borderTopColor: t.colors.outlineVariant,
        paddingBottom: bottomPad,
        paddingHorizontal: 8,
      }}
    >
      {visibleRoutes.map((route) => {
        const meta = TAB_META[route.name];
        const routeIndex = state.routes.findIndex((r) => r.key === route.key);
        const focused = state.index === routeIndex;
        const color = focused ? t.colors.primary : t.colors.onSurfaceVariant;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const event = emitter.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 10,
              paddingBottom: 4,
              gap: 4,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                position: "absolute",
                top: 0,
                width: 28,
                height: 2.5,
                borderRadius: 2,
                backgroundColor: focused ? t.colors.primary : "transparent",
              }}
            />
            <Icon
              source={focused ? meta.activeIcon : meta.icon}
              size={23}
              color={color}
            />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                fontWeight: focused ? "700" : "500",
                color,
                letterSpacing: 0.1,
              }}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomMenu {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Trang chủ" }} />
      <Tabs.Screen name="library" options={{ title: "Thư viện" }} />
      <Tabs.Screen name="community" options={{ title: "Cộng đồng" }} />
      <Tabs.Screen name="profile" options={{ title: "Cá nhân" }} />
    </Tabs>
  );
}
