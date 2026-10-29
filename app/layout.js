import "./globals.css";

export const metadata = {
  title: "내 할 일",
  description: "내 컴퓨터에 저장되는 할 일 관리",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
