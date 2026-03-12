import type { ReactNode } from 'react';
import '../index.css';

export const metadata = {
  title: 'Championship',
  description: 'Championship Manager',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
