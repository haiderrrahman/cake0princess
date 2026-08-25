import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import "react-datepicker/dist/react-datepicker.css";
import BottomNav from "@/components/layout/BottomNav";

const cairo = Cairo({ 
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  weight: ["300", "400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: "كيك الأميرة | Cake Princess",
  description: "اطلب أفضل أنواع الكيك وتعلم فنون التزيين بخطوة بخطوة",
  manifest: "/manifest.json",

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "كيك الأميرة",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FFF8F0" }, { media: "(prefers-color-scheme: dark)", color: "#0D0A1A" }],
};

import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import InstallPrompt from "@/components/InstallPrompt";
import ContentProtection from "@/components/ContentProtection";
import { ThemeProvider } from "@/components/ThemeProvider";
import GlobalActions from "@/components/GlobalActions";
import SplashScreen from "@/components/SplashScreen";
import NetworkStatus from "@/components/NetworkStatus";


import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body className="bg-[#FFF8F0] dark:bg-[#0D0A1A] pb-20 md:pb-0 font-sans antialiased text-gray-900 dark:text-gray-100 selection:bg-[#FF3366]/20 selection:text-[#FF3366]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <CartProvider>
              <FavoritesProvider>
                <ContentProtection />
                <Toaster 
                  position="top-center" 
                  toastOptions={{
                    duration: 2000,
                    style: {
                      background: '#18181b', // dark gray
                      color: '#fff',
                      borderRadius: '16px',
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                      border: 'none',
                    },
                    classNames: {
                      toast: 'group toast group-[.toaster]:bg-[#18181b] group-[.toaster]:text-white group-[.toaster]:border-none group-[.toaster]:shadow-lg',
                    }
                  }}
                />
                <InstallPrompt />
                <SplashScreen />
                <main className="max-w-md mx-auto min-h-screen bg-[#FFF8F0] dark:bg-[#0D0A1A] shadow-2xl relative overflow-hidden">
                  <NetworkStatus />
                  <GlobalActions />
                  {children}
                  <BottomNav />
                </main>
                <div id="root-portal"></div>
              </FavoritesProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
