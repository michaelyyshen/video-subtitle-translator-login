import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { BackgroundFx } from '@/components/BackgroundFx';

export const metadata: Metadata = {
  title: {
    default: 'Video Subtitle Translator — Learn Languages from Netflix & YouTube',
    template: '%s — Video Subtitle Translator'
  },
  description:
    'AI-powered Chrome extension that captures and translates subtitles from Netflix and YouTube, turning every video into a language lesson.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://video-subtitle-translator.vercel.app')
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BackgroundFx />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
