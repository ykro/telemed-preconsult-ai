import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PreConsulta — Prepara tu consulta médica por voz',
  description:
    'Cuéntanos cómo te sientes por voz, responde breves preguntas de seguimiento y obtén tu pase para el paciente y ficha médica SOAP / ISBAR.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PreConsulta',
  },
};

export const viewport: Viewport = {
  themeColor: '#0284c7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light">
      <body className="min-h-screen bg-[#F8FAFC] text-slate-800 selection:bg-sky-100 selection:text-sky-900 antialiased">
        {children}
      </body>
    </html>
  );
}
