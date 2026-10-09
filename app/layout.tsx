import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { CrmProviders } from '@/components/crm/providers'
import { BRAND_CONFIG } from '@/lib/crm/brand-config'
import './globals.css'

export const metadata: Metadata = {
  title: BRAND_CONFIG.appName,
  description: BRAND_CONFIG.appDescription,
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl" data-theme={BRAND_CONFIG.theme}>
      <body className="antialiased">
        <CrmProviders>{children}</CrmProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
