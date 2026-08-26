import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jarvis — AI Coding Tutor",
  description:
    "Learn to code with Jarvis, your AI coding tutor. Chat, voice-to-voice lessons, and an interactive playground. Auto-detects your language — Python, JavaScript, React, Go, Rust and more, taught the easy way.",
  keywords: [
    "learn coding",
    "AI coding tutor",
    "Jarvis",
    "programming",
    "Python",
    "JavaScript",
    "React",
    "voice coding tutor",
    "PWA",
  ],
  authors: [{ name: "Jarvis" }],
  manifest: "/manifest.json",
  applicationName: "Jarvis",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jarvis",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Jarvis — AI Coding Tutor",
    description:
      "Chat, voice-to-voice lessons, and an interactive playground to learn any programming language the easy way. Jarvis auto-detects your language.",
    type: "website",
    siteName: "Jarvis",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function (e) {
                    console.warn('SW registration failed:', e);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
