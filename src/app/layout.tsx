import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import { Providers } from "@/app/providers";
import "@/app/globals.css";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-mono"
});

export const metadata: Metadata = {
  title: "Action Items · RaidGuild",
  description: "RaidGuild's shared, agent-ready action item list.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${robotoMono.variable}`}>
      <body className="noise-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
