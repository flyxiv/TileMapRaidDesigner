import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RaidDesigner — Plan your next victory',
  description: 'A tile-based tactical raid planner. Build battlefields, position your party, and plan each encounter phase.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
