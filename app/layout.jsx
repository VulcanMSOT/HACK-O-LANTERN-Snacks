import './globals.css';

export const metadata = {
  title: 'HACK-O-LANTERN 2026 - Snacks',
  description: 'Volunteer snack delivery tracker for HACK-O-LANTERN 2026',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080808] text-neutral-100 antialiased selection:bg-[#ff7a1a]/30">
        {children}
      </body>
    </html>
  );
}
