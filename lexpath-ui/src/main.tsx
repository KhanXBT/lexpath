import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { ThemeProvider } from 'next-themes'
import { ConvexProvider, ConvexReactClient } from 'convex/react'

const convexUrl = import.meta.env.VITE_CONVEX_URL as string
if (!convexUrl) {
  console.error("VITE_CONVEX_URL is not defined. Please check your environment variables.")
}

const convex = new ConvexReactClient(convexUrl || 'https://placeholder-url.convex.cloud')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <App />
      </ThemeProvider>
    </ConvexProvider>
  </StrictMode>,
)

