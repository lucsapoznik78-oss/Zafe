// Tema da Zafe Copa: fundo verde-escuro com acentos amarelos
// (verde-amarelinha). O -mx-4 anula o px-4 do layout principal para o
// fundo ocupar a largura toda do container.
export default function CopaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 px-4 min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-[#04331f] via-[#052e16] to-black">
      {children}
    </div>
  );
}
