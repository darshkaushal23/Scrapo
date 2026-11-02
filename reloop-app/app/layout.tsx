import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { PrototypeSessionProvider } from "@/lib/prototype/session";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Scrapo — Give electronics a second life",
    template: "%s · Scrapo",
  },
  description:
    "Scrapo collects, refurbishes, and donates electronics, and rewards people for keeping e-waste in use.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-ink">
        <PrototypeSessionProvider>{children}</PrototypeSessionProvider>
      </body>
    </html>
  );
}
