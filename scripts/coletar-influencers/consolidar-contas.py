"""Consolida todos os CSVs de coleta em uma lista única de contas, com o idioma
provável de cada uma inferido do @handle e do nome do perfil.

O idioma existe para a DM sair na língua certa. Não é nacionalidade: é a língua
em que a conta se apresenta. "Boxing Brazil" é PT-BR mesmo escrevendo em inglês,
porque o público é brasileiro.

Uso:  python3 consolidar-contas.py > contas.csv
"""

from __future__ import annotations

import csv
import glob
import re
import sys
import unicodedata

# Fontes. O exemplo fica de fora — é fixture, não coleta.
FONTES_IGNORADAS = {"candidatos.exemplo.csv", "contas.csv"}

# Marcadores por língua. Ordem de avaliação: PT_FORTE, ES, PT_NOME, EN — porque
# conta brasileira usa termo em inglês o tempo todo ("Beach Tennis Brasil",
# "FURIA"), mas conta gringa não usa "palpite" nem "torcida". O ES entra antes
# do PT por nome próprio para não ler "Ricardo Rodriguez" como brasileiro.
PT_FORTE = [
    r"\bbr\b", "brasil", "brazil", "brasileir", "palpite", "aposta", "futebol",
    "cartola", "torcid", "selecao", "volei", "basquete", "xadrez", "luta",
    "boleir", "tipster", "dicas", "esportiv", "campeonato", "futsal",
    "futevolei", "atletismo", "handebol", "conteudo", "memes do", "narrador",
    "portal", "guia", "escola", "academia", "mito", "cartoleiro", "punter",
    "banca", "jogo", "tenista", "professor", "analises", "tatica", "scout",
    "flamengo", "corinthians", "palmeiras", "palestr", "gremio", "cruzeiro",
    "galo", "spfc", "sao paulo", "santos", "vasco", "botafogo", "fluminense",
    "superliga", "cblol", "nbb", "cbf", "cbv", "cbb", "cbat", "cbjj", "onças",
    "oncas", "combate", "surfista", "skate", "praia", "zoeira", "zueiro",
    "diario", "blog do", "casao", "casa do", "clube", "liga brasileira",
    "confederacao", "conf.", "instituto", "centro", "shooto", "fight brasil",
    "bola", r"\brj\b", r"\bsite", "beach sports", "beach tennis",
]

ES = [
    "pronostico", "apuesta", "futbol", "predicciones", "deportes", "espana",
    "cancha", "quiniela", "jugada", "latam", "zancudo", "andres",
    # Sobrenomes em -ez são o marcador hispânico mais confiável em nome próprio.
    r"\w+(?:rodrigu|gonzal|martin|hernand|lop|per|sanch|ramir|gom|fernand)ez\b",
]

# Segunda passada: conta pessoal brasileira cujo @ é só o nome da pessoa, e
# palavras de função do português que não aparecem em inglês nem espanhol.
PT_NOME = [
    r"\b(de|do|da|na|no|dos|das|pelo|sobre|com)\b", "papo", "momento", "hoje",
    "oficial", "ofc\\b", "atleta", "pagina", "noticias", r"\btenis\b",
    r"inho\b", r"ao\b", r"eiro\b", "zinho",
    "felipe", "thiago", "tiago", "pedro", "paulo", "lucas", "rafael",
    "guilherme", "henrique", "vitor", "victor", "denis", "everaldo",
    "luis", "luiz", "marcos", "marcelo", "joao", "jose", "carlos", "bruno",
    "gabriel", "rodrigo", "fernando", "eduardo", "andre", "matheus", "mateus",
    "leonardo", "danilo", "adilson", "anderson", "alexandre", "renato",
    "murilo", "caio", "davi", "gustavo", "vinicius", "rogerio", "sergio",
    "hugo", "otavio", "elia", "duarte", "medeiros", "almeida", "barreto",
    "resende", "chaves", "souza", "loch", "guidi", "grigoletti", "patricio",
    "marques", "antunes", "luppo", "bonini", "francisco",
]

EN = [
    "prediction", "tips", "tip ", "picks", "pick", "betting", "bet ", "fantasy",
    "football", "soccer", "hoops", "analysis", "analytics", "stats", "fpl",
    "nfl", "dfs", "parlay", "insider", "advice", "forecast", "commander",
    "master", "expert", "guide", "trading", "sharp", "premier league",
]

# Contas onde o nome não entrega a origem. São criadores/orgs brasileiros
# conhecidos (streamers e times de e-sports) cujo handle é só um apelido.
BR_CONHECIDAS = {
    "gaules", "nobru", "alanzoka", "cerol", "babi", "brunoplayhard",
    "furiagg", "mibrgg", "dez.organizada", "biigoes", "flabandoni",
    "viclopes2", "helenluz5", "alanaambrosio", "giovannoni12", "nasciparamitar",
    "xarolao", "matheusxarola", "f0rsakenwow", "itsvermelha", "gruntartv",
    "athenaxiss", "valterwalkermma", "mauricioruffy", "caioborralho",
    "combate", "ufc_brasil", "polly.rs_", "rodriigovale", "ctlimeira",
}

# Contas globais sem língua própria de público (marca internacional).
GLOBAL = {"ufc", "polymarket", "cartolafc", "brasileirao", "flamengo", "corinthians"}


def normalizar(texto: str) -> str:
    """Minúsculas, sem acento — os marcadores são escritos sem acento."""
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return sem_acento.lower()


def idioma_de(handle: str, nome: str) -> tuple[str, str]:
    """Devolve (idioma, confiança). `baixa` = nenhum marcador bateu; o inglês é
    só o default seguro para DM, não uma conclusão."""
    if handle in BR_CONHECIDAS:
        return "pt-BR", "alta"
    alvo = normalizar(f"{handle} {nome}").replace("_", " ").replace(".", " ")
    for marcadores, idioma in (
        (PT_FORTE, "pt-BR"), (ES, "es"), (PT_NOME, "pt-BR"), (EN, "en")
    ):
        if any(re.search(m, alvo) for m in marcadores):
            return idioma, "alta"
    return "en", "baixa"


def main() -> None:
    contas: dict[str, dict[str, str]] = {}

    for caminho in sorted(glob.glob("*.csv")):
        if caminho in FONTES_IGNORADAS:
            continue
        with open(caminho, encoding="utf-8") as f:
            for linha in csv.DictReader(f):
                handle = (linha.get("handle") or "").strip().lstrip("@").lower()
                if not handle:
                    continue
                # Primeira ocorrência vence; as coletas mais antigas têm os
                # dados mais completos (seguidores preenchido).
                if handle in contas and contas[handle]["seguidores"]:
                    continue
                nome = (linha.get("nome") or "").strip()
                idioma, confianca = idioma_de(handle, nome)
                if handle in GLOBAL:
                    idioma, confianca = "global", "alta"
                contas[handle] = {
                    "handle": handle,
                    "nome": nome,
                    "seguidores": (linha.get("seguidores") or "").strip(),
                    "nicho": (linha.get("nicho") or "").strip(),
                    "idioma": idioma,
                    "confianca": confianca,
                    "link": f"https://instagram.com/{handle}",
                    "origem": caminho,
                }

    saida = csv.DictWriter(
        sys.stdout,
        fieldnames=[
            "handle", "nome", "seguidores", "nicho", "idioma", "confianca",
            "link", "origem",
        ],
    )
    saida.writeheader()
    for conta in sorted(contas.values(), key=lambda c: (c["idioma"], c["handle"])):
        saida.writerow(conta)

    resumo: dict[str, int] = {}
    for conta in contas.values():
        resumo[conta["idioma"]] = resumo.get(conta["idioma"], 0) + 1
    print(f"total={len(contas)} {resumo}", file=sys.stderr)


if __name__ == "__main__":
    main()
