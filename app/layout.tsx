import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WorkspaceShell } from "./components/workspace-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScopeLog | Security workspace",
  description:
    "A focused workspace for security assessments, evidence, and findings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider dynamic appearance={{ variables: { colorPrimary: "#3ecf8e", colorBackground: "#181818", colorForeground: "#ededed", colorMutedForeground: "#a1a1a1", colorInput: "#1c1c1c", colorInputForeground: "#ededed", borderRadius: "0.5rem" } }}>
          <a href="#page-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:text-black">Skip to content</a>
          <WorkspaceShell>{children}</WorkspaceShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
