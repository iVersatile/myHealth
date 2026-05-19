import type { Metadata } from "next";
import "./globals.css";
import { IdleLockProvider } from "../components/providers/IdleLockProvider";
import { ThemeInitializer } from "../components/providers/ThemeInitializer";

export const metadata: Metadata = {
  title: "myHealth",
  description: "Your health records, private.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="calm" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ThemeInitializer />
        <IdleLockProvider>{children}</IdleLockProvider>
      </body>
    </html>
  );
}
