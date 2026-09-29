import type { Metadata, Viewport } from "next";

export const PWA_THEME_COLOR = "#4f46e5";

export const pwaViewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  viewportFit: "cover",
};

export const pwaMetadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Koçluk Takip",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};
