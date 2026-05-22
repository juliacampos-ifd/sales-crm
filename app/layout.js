export const metadata = {
  title: 'SalesCRM - Hunting Salão',
  description: 'CRM de vendas multi-produto: 3S Checkout, Saipos, Comer Fora, GetIn, Emilia Vision',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
