import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Toast from '@/components/Toast';
import ExpenseModal from '@/components/ExpenseModal';
import SubsidyModal from '@/components/SubsidyModal';

export const metadata: Metadata = {
  title: 'Bendahara MMD - Web App Kas & Subsidi Pesantren',
  description:
    'Aplikasi pembukuan kas, subsidi anggaran, dan rincian belanja Majelis Musyawarah & Dirosah (MMD) terintegrasi Google Sheets.',
  icons: {
    icon: [
      { url: '/icon.png', sizes: 'any', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
        <AppProvider>
          <Header />
          <main className="flex-1 flex flex-col relative w-full max-w-[480px] mx-auto px-margin pt-16 pb-32 bg-surface">
            {children}
          </main>
          <BottomNav />
          <Toast />
          <ExpenseModal />
          <SubsidyModal />
        </AppProvider>
      </body>
    </html>
  );
}
