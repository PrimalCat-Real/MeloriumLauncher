import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Image from "next/image";
import bg from '@/assets/images/background.png'
import PersistProvider from "@/components/provider/persist-provider";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/header/Header";
import QueryProvider from "@/components/provider/query-provider";
import Footer from "@/components/header/Footer";
import AuthGuardProvider from "@/components/provider/AuthGuardProvider";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Melorium Launcher",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(geistSans.variable, geistMono.variable, "antialiased w-full h-screen selection:bg-muted/20 selection:text-input bg-gradient-to-br from-background to-background-secondary text-foreground overflow-hidden")}
      >
        <PersistProvider>
          <QueryProvider>
            <AuthGuardProvider>
              <Header></Header>
              <Image className="fixed top-0 left-0 w-full h-full" src={bg} alt="bg" width={988} height={629} />
              {children}
              <Footer></Footer>
            </AuthGuardProvider>
          </QueryProvider>
        </PersistProvider>
        <Toaster richColors></Toaster>
      </body>
    </html>
  );
}
