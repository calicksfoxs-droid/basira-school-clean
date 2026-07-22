import type { Metadata } from "next";
import { Noto_Sans_Arabic, Alexandria } from 'next/font/google';
import "./globals.css";

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-sans-arabic',
  display: 'swap',
});

const alexandria = Alexandria({
  subsets: ['arabic'],
  variable: '--font-alexandria',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: "بصيرة", template: "%s | بصيرة" },
  description: "منصة تعليمية خاصة وبسيطة للمدير والمعلم والطالب",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" className={`${notoSansArabic.variable} ${alexandria.variable}`}><body>{children}</body></html>;
}
