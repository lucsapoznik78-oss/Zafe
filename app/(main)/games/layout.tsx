// Tema da Zafe Games: base preta com glows de roxo (identidade de e-sports),
// esmaecendo para preto — mantém o texto branco legível. O -mx-4 anula o px-4
// do layout principal para o fundo ocupar a largura toda do container.
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 px-4 min-h-[calc(100vh-3.5rem)] bg-black bg-[radial-gradient(75%_55%_at_50%_0%,#3b0d5a_0%,transparent_62%),radial-gradient(55%_48%_at_92%_2%,#2a0c4a_0%,transparent_55%)]">
      {children}
    </div>
  );
}
