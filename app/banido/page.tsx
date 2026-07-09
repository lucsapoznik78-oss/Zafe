import { Ban } from "lucide-react";

export const metadata = { title: "Conta suspensa — Zafe" };

export default function BanidoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <Ban size={28} className="text-destructive" />
        </div>
        <h1 className="text-xl font-black text-white">Conta suspensa</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sua conta foi suspensa por violação dos termos de uso da Zafe.
          Se você acredita que isso é um engano, entre em contato com o suporte.
        </p>
        <a
          href="mailto:suporte@zafe.app.br"
          className="inline-block px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary/90 transition-colors"
        >
          Falar com o suporte
        </a>
      </div>
    </div>
  );
}
