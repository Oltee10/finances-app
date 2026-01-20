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

        {/* 2. FORCE IOS ICON */}
        <link rel="apple-touch-icon" href="/icon-vfinal.png" />

        {/* 3. BACKGROUND (Overscroll Area) - Será actualizado dinámicamente desde _layout.tsx */}
        <style dangerouslySetInnerHTML={{ __html: `
          body { background-color: #ffffff; }
        `}} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
