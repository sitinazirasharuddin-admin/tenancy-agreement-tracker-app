import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenancy | Agreement Tracker",
  description: "Track tenancy agreements from preparation to signing, stamping and completion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

