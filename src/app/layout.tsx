import type { Metadata } from "next";
import "./globals.css";
import { IdleLockProvider } from "../components/providers/IdleLockProvider";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <IdleLockProvider>{children}</IdleLockProvider>
      </body>
    </html>
  );
}
