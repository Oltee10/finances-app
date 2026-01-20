import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every page.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* 1. THEME COLOR (Status Bar) - Será actualizado dinámicamente desde _layout.tsx */}
        <meta name="theme-color" content="#ffffff" />

        {/* 2. ICON DEFINITIONS - PWA Standard */}
        <link rel="icon" href="/icon-vfinal.png" />
        <link rel="apple-touch-icon" href="/icon-vfinal.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* 3. BACKGROUND & VIEWPORT FIXES - Será actualizado dinámicamente desde _layout.tsx */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            height: 100dvh;
            width: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
            overscroll-behavior: none;
          }
          #root {
            height: 100dvh;
            width: 100%;
            overflow: hidden;
          }
          body {
            background-color: #ffffff;
          }
        `}} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
