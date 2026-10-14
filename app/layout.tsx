import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { CrmProviders } from '@/components/crm/providers'
import { PrivacyFooter } from '@/components/crm/privacy-footer'
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

// Hides the server-rendered English markup only when a non-default language will be applied on hydration,
// so ?lang= / saved-language visitors never see a flash of English. A timeout guarantees it is never stuck hidden.
const PENDING_LANGUAGE_SCRIPT = `(function(){try{var d=document.documentElement,p=new URLSearchParams(location.search).get('lang'),s=null;try{s=localStorage.getItem('smart-clinic-crm-language')||localStorage.getItem('pana-crm-language')}catch(e){}var l=p!==null?p:s;if(l&&l!=='en'){d.setAttribute('data-i18n-pending','');setTimeout(function(){d.removeAttribute('data-i18n-pending')},3000)}}catch(e){}})()`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-theme={BRAND_CONFIG.theme} suppressHydrationWarning>
      <head>
        <style>{'html[data-i18n-pending] body{visibility:hidden}'}</style>
        <script
          dangerouslySetInnerHTML={{
            __html: PENDING_LANGUAGE_SCRIPT,
          }}
        />
      </head>
      <body className="antialiased">
        <CrmProviders>
          {children}
          <PrivacyFooter />
        </CrmProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
