"use client";

import { Buffer } from "buffer";
import { useEffect } from "react";
import { App, type Page } from "./App";
import { AppWalletProvider } from "./WalletProvider";

type LegacyWindow = Window & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
};

const installBrowserGlobals = () => {
  if (typeof window === "undefined") return;
  const legacyWindow = window as unknown as LegacyWindow;
  legacyWindow.Buffer = legacyWindow.Buffer || Buffer;
  legacyWindow.global = legacyWindow.global || globalThis;
};

export function LegacyClientApp({ initialPage = "home" }: { initialPage?: Page }) {
  installBrowserGlobals();

  useEffect(() => {
    installBrowserGlobals();
  }, []);

  return (
      <AppWalletProvider>
      <App initialPage={initialPage} />
    </AppWalletProvider>
  );
}
