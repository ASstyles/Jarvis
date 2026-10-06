import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "J.A.R.V.I.S. 3.0 — Autonomous AI Operating System",
  description: "Next-generation Iron Man Cybernetic Operating System with Multi-Agent DAGs, 3D Holographic Reactor, Gesture Control, and Voice 2.0.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans bg-[#070913] text-white selection:bg-cyan-500/30">
        {children}
      </body>
    </html>
  );
}

