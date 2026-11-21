
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import LogoutButton from "@/components/LogoutButton";
import SessionInitializer from "@/components/SessionInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Drug Candidate Portal",
    template: "%s | Drug Candidate Portal",
  },
  description:
    "Explore pharmaceutical drug candidates, development status, mechanisms of action and clinical information.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={geistSans.variable}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen flex flex-col antialiased">
        <SessionInitializer />
        <div className="fixed right-4 top-4 z-50">
          <LogoutButton />
        </div>
        {children}
      </body>
    </html>
  );
}
