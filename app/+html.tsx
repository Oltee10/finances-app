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

        {/* 1. DYNAMIC THEME COLOR (Status Bar) */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />

        {/* 2. FORCE IOS ICON */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* 3. DYNAMIC BACKGROUND (Overscroll Area) */}
        <style dangerouslySetInnerHTML={{ __html: `
          body { background-color: #ffffff; }
          @media (prefers-color-scheme: dark) {
            body { background-color: #000000; }
          }
        `}} />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
