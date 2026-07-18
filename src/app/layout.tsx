import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "بصيرة", template: "%s | بصيرة" },
  description: "منصة تعليمية خاصة وبسيطة للمدير والمعلم والطالب",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
