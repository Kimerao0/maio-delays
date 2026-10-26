import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'
import './globals.css'

// One family, static weights: the width axis is not loaded, nothing on the screen needs it.
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'la statistica è un’opinione',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="it" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
