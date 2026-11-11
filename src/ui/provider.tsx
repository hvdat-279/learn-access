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
      // Bảng màu hài hòa: Xanh học thuật dịu (Calm Blue) + Xám đá trung tính (Cool Slate)
      primary: dark ? "#60A5FA" : "#2463EB",
      primaryContainer: dark ? "#1E3A5F" : "#E8F0FE",
      onPrimaryContainer: dark ? "#DBEAFE" : "#173B8A",
      secondary: dark ? "#94A3B8" : "#475569",
      secondaryContainer: dark ? "#243044" : "#E8EEF5",
      onSecondaryContainer: dark ? "#E2E8F0" : "#1E293B",
      tertiary: dark ? "#2DD4BF" : "#0D9488",
      tertiaryContainer: dark ? "#133A38" : "#E6F7F5",
      onTertiaryContainer: dark ? "#CCFBF1" : "#0F524C",
      background: dark ? "#0F141E" : "#F6F8FB",
      surface: dark ? "#171E2C" : "#FFFFFF",
      surfaceVariant: dark ? "#20293A" : "#EDF2F7",
      onSurface: dark ? "#F1F5F9" : "#0F172A",
      onSurfaceVariant: dark ? "#94A3B8" : "#64748B",
      outline: dark ? "#334155" : "#CBD5E1",
      outlineVariant: dark ? "#253042" : "#E2E8F0",
      elevation: {
        ...base.colors.elevation,
        level0: "transparent",
        level1: dark ? "#1B2333" : "#F1F5F9",
        level2: dark ? "#212B3E" : "#E8EEF5",
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
