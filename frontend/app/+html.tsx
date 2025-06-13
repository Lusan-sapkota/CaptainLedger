import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="color-scheme" content="light dark" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #ECF0F1;
  transition: background-color 0.3s ease;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #121212;
  }
}

/* Custom ultra-thin scrollbar styles for PWA */
::-webkit-scrollbar {
  width: 3px;
  height: 3px;
}

::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 0;
}

::-webkit-scrollbar-thumb {
  background: #27AE60;
  border-radius: 2px;
  opacity: 0.6;
  transition: all 0.2s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: #2E8B57;
  opacity: 0.9;
  width: 5px;
}

::-webkit-scrollbar-thumb:active {
  background: #1E8449;
  opacity: 1;
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* For Firefox - ultra thin */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(39, 174, 96, 0.6) transparent;
}

/* Dark mode scrollbar */
@media (prefers-color-scheme: dark) {
  ::-webkit-scrollbar-thumb {
    background: #27AE60;
    opacity: 0.7;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #2E8B57;
    opacity: 1;
  }
  
  ::-webkit-scrollbar-thumb:active {
    background: #34A85A;
  }
  
  * {
    scrollbar-color: rgba(39, 174, 96, 0.7) transparent;
  }
}

/* Mobile optimizations - even thinner */
@media (max-width: 768px) {
  ::-webkit-scrollbar {
    width: 2px;
    height: 2px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    width: 3px;
  }
}
`;
