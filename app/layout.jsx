import "./globals.css";

export const metadata = {
  title: "OCBC FutureOS",
  description: "Mobile-first autonomous AI banking prototype for life outcome management.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
