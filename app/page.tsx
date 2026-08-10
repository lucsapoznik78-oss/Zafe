// Homepage: raiz virou porta direta pra /liga.
//
// Antes essa rota renderizava a landing (Hero, HowItWorks, ConcursoAtivo…) e
// só logado ia pra HOME_PATH. Com o Concurso oculto, a landing perde metade
// do enredo e virou etapa a menos: quem chega já vê a Liga (também é
// HOME_PATH). Anon e logado tomam o mesmo redirect.
//
// Custo consciente: a copy da landing sai do índice do Google. Se quiser
// voltar a ter página institucional, o caminho é mover os componentes de
// landing pra `/sobre` e re-renderizar lá — não reviver esta rota.
import { redirect } from "next/navigation";
import { HOME_PATH } from "@/lib/flags";

export default function RootRedirect() {
  redirect(HOME_PATH);
}
