import '../styles/globals.css'

export const metadata = {
  title: 'DoktorABC Video Booth',
  description: 'Football championship capture flow — powered by DoktorABC',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
