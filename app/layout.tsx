import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAIRA MENDIVIL · IA Applied Lab",
  description: "LAB V0.1 · Experiencias de aprendizaje aplicado.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
