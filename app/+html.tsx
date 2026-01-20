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

        {/* CRITICAL: Paths must start with /finances/ because of sub-directory hosting */}
        <link rel="icon" type="image/jpeg" href="/finances/icon.jpg?v=fixed" />
        <link rel="apple-touch-icon" href="/finances/icon.jpg?v=fixed" />
        <link rel="manifest" href="/finances/manifest.json" />

        {/* 3. BACKGROUND & VIEWPORT FIXES - 100dvh Flex Strategy for Mobile */}
        <style dangerouslySetInnerHTML={{ __html: `
            html {
              height: 100%;
              width: 100%;
              overflow: hidden; /* Prevent scroll on HTML/Body */
              -webkit-text-size-adjust: 100%;
            }
            body {
              height: 100%;
              width: 100%;
              overflow: hidden;
              margin: 0;
              padding: 0;
              /* background-color is REMOVED here so React logic controls it */
              overscroll-behavior: none;
              -webkit-font-smoothing: antialiased;
            }
            #root {
              display: flex;
              flex-direction: column;
              flex: 1;
              height: 100dvh; /* Critical: Use dynamic viewport height */
              width: 100vw;
              overflow: hidden;
              z-index: 0;
            }
          `}} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
