import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Telemed Pre-Consult AI | Triaje por Voz, Pase del Paciente y Ficha SOAP/ISBAR',
  description:
    'PWA Mobile-First de pre-consulta médica por voz con arquitectura A/B (Gemini 3.8 Flash Directo vs. Cascada Gemma 4 + Gemini 3.8 Flash), seguimiento OPQRST y doble entregable clínico.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Telemed AI',
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
    <html lang="es-GT" className="light">
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-sky-100 selection:text-sky-900 antialiased">
        {children}
      </body>
    </html>
  );
}
