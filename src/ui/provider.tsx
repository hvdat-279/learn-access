import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { AppState } from "react-native";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import * as Speech from "expo-speech";
import { supabase } from "../data/supabase";
import { repository, onLocalChange } from "../data/repository";
import { sync } from "../data/sync";
import { useSettings } from "./store";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0 },
    mutations: { retry: false },
  },
});

const AuthContext = createContext({
  ownerId: "local",
  email: "",
  ready: false,
});

export const useAuth = () => useContext(AuthContext);

export function useDocuments() {
  const { ownerId } = useAuth();
  return useQuery({
    queryKey: ["documents", ownerId],
    queryFn: async () => (await repository.list(ownerId)) ?? [],
  });
}

export function useDocument(id: string) {
  const { ownerId } = useAuth();
  return useQuery({
    queryKey: ["document", ownerId, id],
    queryFn: async () => (await repository.get(id, ownerId)) ?? null,
  });
}

export function usePublicDocuments() {
  return useQuery({
    queryKey: ["public_documents"],
    queryFn: async () => (await repository.listPublic()) ?? [],
  });
}

export async function refreshPublicDocuments() {
  await queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === "public_documents",
  });
}

export async function refreshDocuments() {
  await queryClient.invalidateQueries({
    predicate: (q) =>
      q.queryKey[0] === "documents" ||
      q.queryKey[0] === "document" ||
      q.queryKey[0] === "public_documents",
  });
}

export function Provider({ children }: { children: React.ReactNode }) {
  const dark = useSettings((s) => s.dark);
  const previousOwner = useRef<string | null>(null);
  const [auth, setAuth] = useState({
    ownerId: "local",
    email: "",
    ready: !supabase,
  });

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id ?? "local";
      if (previousOwner.current !== nextOwner) {
        void Speech.stop();
        void queryClient.cancelQueries();
        queryClient.clear();
        previousOwner.current = nextOwner;
      }
      setAuth({
        ownerId: session?.user.id ?? "local",
        email: session?.user.email ?? "",
        ready: true,
      });
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session)
        setAuth({ ownerId: "local", email: "", ready: true });
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (auth.ownerId === "local") return;
    let active = true;
    const run = () => {
      if (active)
        void sync
          .run(auth.ownerId)
          .then(refreshDocuments)
          .catch(() => {});
    };
    run();
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = onLocalChange(() => {
      clearTimeout(timer);
      timer = setTimeout(run, 1500);
    });
    const off = NetInfo.addEventListener((state) => {
      if (state.isConnected && AppState.currentState === "active") run();
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase?.auth.startAutoRefresh();
        run();
      } else {
        supabase?.auth.stopAutoRefresh();
        void Speech.stop();
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
      unsubscribe();
      off();
      sub.remove();
    };
  }, [auth.ownerId]);

  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const theme = {
    ...base,
    roundness: 4,
    colors: {
      ...base.colors,
      // Bảng màu tươi sáng: Ngọc lục bảo (Emerald Teal) + San hô (Coral) + Vàng mật (Amber)
      primary: dark ? "#34D399" : "#0B8775",
      primaryContainer: dark ? "#0F3D34" : "#CCFBF1",
      onPrimaryContainer: dark ? "#A7F3D0" : "#084C42",
      secondary: dark ? "#FB923C" : "#EA6332",
      secondaryContainer: dark ? "#4A2310" : "#FFEDD5",
      onSecondaryContainer: dark ? "#FED7AA" : "#7C2D12",
      tertiary: dark ? "#FBBF24" : "#D97706",
      tertiaryContainer: dark ? "#423009" : "#FEF3C7",
      onTertiaryContainer: dark ? "#FDE68A" : "#78350F",
      background: dark ? "#0E1517" : "#F5F8F7",
      surface: dark ? "#162023" : "#FFFFFF",
      surfaceVariant: dark ? "#1F2E32" : "#EAF2F0",
      onSurface: dark ? "#ECF4F2" : "#111D1B",
      onSurfaceVariant: dark ? "#9AB0AC" : "#4E635E",
      outline: dark ? "#32454A" : "#BDD0CC",
      outlineVariant: dark ? "#233337" : "#DDE8E5",
      elevation: {
        ...base.colors.elevation,
        level0: "transparent",
        level1: dark ? "#1A272B" : "#EFF5F3",
        level2: dark ? "#203035" : "#E5EFEC",
      },
    },
  };

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <PaperProvider theme={theme}>{children}</PaperProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
