import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "有家｜把想煮的心意分享出去",
  description: "有家陪喜歡料理的人，把一頓飯分享給在乎的人。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
