import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Доставка Трекер',
  description: 'Трекинг доставок на филиалы',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        {/* Telegram Mini App SDK — required for user identity + contact + theme */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
