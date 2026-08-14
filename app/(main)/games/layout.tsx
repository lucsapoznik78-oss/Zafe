// Tema da Zafe Games. Era preto puro com dois glows radiais de roxo — a
// assinatura visual de cassino que esta migração existe para remover. Agora é
// o mesmo fundo do resto do app, chapado. O -mx-4 anula o px-4 do layout
// principal para o fundo ocupar a largura toda do container.
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 px-4 min-h-[calc(100vh-3.5rem)] bg-background">
      {children}
    </div>
  );
}
