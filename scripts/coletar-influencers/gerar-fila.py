"""Gera linhas de fila de envio para os novos leads coletados."""
import csv
import sys

# Template PT-BR (da A3-redator.md padrao v1)
TMPL_BR = (
    "E aí{nome_part}, tudo certo? Curto teu perfil de {nicho}, principalmente "
    "{gancho}. Tô ajudando a Zafe, um fantasy game esportivo que ainda tá em "
    "beta — sem custo nenhum, é só entrar e jogar. A ideia é criar uma liga com "
    "o nome de criadores como você, pra galera competir ali dentro e você ganhar "
    "um espaço que é literalmente seu. Ainda tá tudo sendo construído, então quem "
    "entra agora ajuda a moldar o produto. Da uma olhada: zafe.app.br — bora testar?"
)

# Template EN (equivalent for English-speaking accounts)
TMPL_EN = (
    "Hey{nome_part}, what's up? I really dig your {nicho} content, especially "
    "{gancho}. I'm helping build Zafe, a sports prediction game still in beta "
    "— totally free, just jump in and play. The idea is to create a league with "
    "your name on it, so your community can compete there and you get a space "
    "that's literally yours. Everything's still being built, so early creators "
    "help shape the product. Check it out: zafe.app.br — wanna give it a try?"
)

# Mapping handle → language (BR accounts)
BR_HANDLES = {
    "ufctipsepalpites", "mma.br4sil", "boxe_ilb", "brboxe", "boxing_brazil",
    "ingaming_esports", "rci_tactics",
    "nflbrfantasy",
    "casaocartola", "cartola10_fc", "cartoladicas", "cfdscartola", "fccartola",
    "cartolasfcoficial", "capitaocartolafc",
    "fantasy5brasil", "brffootball",
    "redditfutebol", "oicaroanalises",
    "nc_palpite", "sda.palpites", "palpitesx", "palpitesdehoje",
    "ppalpites_de_futebol", "palpites10oficial",
    "academiaapostasbrasil",
    "palpitesnba",
    "rodriigovale", "ctlimeira", "polly.rs_",
    "dicas93_",
}

# Nicho → gancho mapping (EN)
GANCHO_EN = {
    "UFC / MMA": "your fight breakdowns and predictions",
    "Gaming-esports": "your competitive gaming coverage",
    "NFL": "your picks and game analysis",
    "Fantasy": "your fantasy analysis and strategy",
    "Futebol": "your match analysis and predictions",
    "Basquete": "your basketball analysis and coverage",
    "Tennis": "your match coverage and insights",
    "Esporte": "your sports coverage and analysis",
}

# Nicho → gancho mapping (BR)
GANCHO_BR = {
    "UFC / MMA": "a cobertura dos cards de luta",
    "Gaming-esports": "a cobertura do competitivo",
    "NFL": "os papos de NFL fora da bolha",
    "Fantasy": "as dicas e analises toda rodada",
    "Futebol": "as analises de rodada",
    "Basquete": "a cobertura de NBA",
    "Tennis": "o acompanhamento dos torneios",
    "Esporte": "o conteudo esportivo",
}

# More specific gancho overrides by handle substring
def specific_gancho_en(handle, nicho):
    h = handle.lower()
    if "fpl" in h or "premier" in h:
        return "FPL", "your FPL picks and captain choices"
    if "cartola" in h:
        return "Cartola FC", "as dicas de escalacao toda rodada"
    if "soccer" in h or "football" in h and "american" not in h:
        return "soccer", "your match predictions and analysis"
    if "mma" in h or "ufc" in h or "fight" in h:
        return "MMA", "your fight breakdowns and predictions"
    if "bjj" in h:
        return "BJJ", "your BJJ techniques and content"
    if "box" in h:
        return "boxing", "your boxing coverage and analysis"
    if "cs2" in h or "csgo" in h or "counter" in h:
        return "CS2", "your CS2 coverage and content"
    if "valorant" in h:
        return "Valorant", "your Valorant tips and strategy"
    if "lol" in h or "league" in h:
        return "League of Legends", "your LoL content and analysis"
    if "fut" in h or "fifa" in h or "eafc" in h or "ea fc" in h:
        return "EA FC", "your EA FC trading tips and content"
    if "nba" in h or "hoop" in h or "basket" in h or "bball" in h or "courtside" in h:
        return "NBA", "your basketball analysis and picks"
    if "nfl" in h or "football_commander" in h or "fantasy" in h:
        return "fantasy sports", "your fantasy analysis and strategy"
    if "tennis" in h or "tenis" in h or "atp" in h:
        return "tennis", "your match predictions and insights"
    if "pick" in h or "parlay" in h or "prop" in h or "sharp" in h or "bettor" in h:
        return "sports predictions", "your picks and analysis"
    if "draft" in h or "dfs" in h:
        return "DFS", "your daily fantasy strategy"
    if "esport" in h:
        return "esports", "your esports coverage and predictions"
    if "stat" in h or "data" in h or "analyt" in h:
        return "sports analytics", "your data-driven sports analysis"
    return None, None

def specific_gancho_br(handle, nicho):
    h = handle.lower()
    if "cartola" in h:
        return "Cartola FC", "as dicas de escalacao toda rodada"
    if "palpite" in h or "dicas" in h:
        return "palpites esportivos", "os palpites e analises dos jogos"
    if "mma" in h or "ufc" in h or "luta" in h:
        return "luta", "a cobertura dos cards de luta"
    if "boxe" in h or "box" in h:
        return "boxe", "a cobertura do boxe brasileiro"
    if "nba" in h or "basquete" in h:
        return "NBA", "a cobertura de NBA"
    if "nfl" in h or "football" in h:
        return "NFL", "os papos de NFL fora da bolha"
    if "tenis" in h or "tennis" in h:
        return "tenis", "o acompanhamento dos torneios"
    if "fantasy" in h:
        return "fantasy", "o conteudo de fantasy"
    if "futebol" in h or "fut" in h:
        return "futebol", "as analises de rodada"
    if "esport" in h or "gaming" in h:
        return "e-sports", "a cobertura do competitivo"
    if "academia" in h:
        return "analise esportiva", "as analises e cobertura esportiva"
    return None, None

def first_name(nome):
    """Extract first usable name word."""
    if not nome:
        return ""
    parts = nome.strip().split()
    for p in parts:
        clean = "".join(c for c in p if c.isalpha())
        if clean and len(clean) > 1:
            return clean.capitalize()
    return ""

def gen_message(handle, nome, nicho, is_br):
    fname = first_name(nome)
    nome_part = f" {fname}" if fname else ""

    if is_br:
        nicho_display, gancho = specific_gancho_br(handle, nicho)
        if not nicho_display:
            nicho_display = GANCHO_BR.get(nicho, nicho.lower())
            gancho = GANCHO_BR.get(nicho, "o conteudo esportivo")
        else:
            pass  # already set
        return TMPL_BR.format(nome_part=nome_part, nicho=nicho_display, gancho=gancho)
    else:
        nicho_display, gancho = specific_gancho_en(handle, nicho)
        if not nicho_display:
            nicho_display = nicho.lower()
            gancho = GANCHO_EN.get(nicho, "your sports content and coverage")
        return TMPL_EN.format(nome_part=nome_part, nicho=nicho_display, gancho=gancho)

def main():
    input_csv = "harvest-mega-20260727.csv"
    output_csv = sys.stdout

    with open(input_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Filter out handles that were skipped (duplicates) - we include all,
    # the dedup was done at sheet level. Here we generate DMs for all.

    n = 50  # continue from existing fila
    dia = 2  # continue from existing fila
    dia_count = 9  # dia 2 already has 9 entries (41-49)
    linha = 349  # estimated start row in sheet

    writer = csv.writer(output_csv)

    for row in rows:
        handle = row["handle"].strip()
        nome = row["nome"].strip()
        nicho = row["nicho"].strip()

        if dia_count >= 40:
            dia += 1
            dia_count = 0

        is_br = handle in BR_HANDLES
        msg = gen_message(handle, nome, nicho, is_br)

        writer.writerow([
            n,
            dia,
            linha,
            f"@{handle}",
            f"https://www.instagram.com/{handle}/",
            nome,
            nicho,
            "",  # revisar
            msg,
        ])

        n += 1
        dia_count += 1
        linha += 1

    print(f"\n# Total: {n - 50} entries generated", file=sys.stderr)

if __name__ == "__main__":
    main()
