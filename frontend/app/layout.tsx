import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phone Case Print Studio",
  description: "Remove backgrounds and print A4 phone-case cutout templates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
