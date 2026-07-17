import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Action Items · RaidGuild",
  description: "RaidGuild's shared, agent-ready action item list."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="noise-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
