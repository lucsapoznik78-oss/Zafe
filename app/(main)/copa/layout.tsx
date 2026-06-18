// Tema da Zafe Copa: base preta com glows suaves de verde-esmeralda no
// topo, esmaecendo para preto — mantém o texto branco legível. O -mx-4
// anula o px-4 do layout principal para o fundo ocupar a largura toda do
// container.
export default function CopaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 px-4 min-h-[calc(100vh-3.5rem)] bg-black bg-[radial-gradient(75%_55%_at_50%_0%,#0d5a3a_0%,transparent_62%),radial-gradient(55%_48%_at_92%_2%,#0c4a30_0%,transparent_55%)]">
      {children}
    </div>
  );
}
