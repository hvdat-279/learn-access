import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Provider } from "../ui/provider";
import { useSettings } from "../ui/store";
function Routes() {
  const dark = useSettings((s) => s.dark);
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="import" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
export default function RootLayout() {
  return (
    <Provider>
      <Routes />
    </Provider>
  );
}
