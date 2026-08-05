"""Fonte OPCIONAL: automação da busca gratuita da Modash (best-effort).

⚠️ IMPORTANTE — leia antes de usar (--source modash):
- Usa APENAS a busca gratuita, pública, sem cadastro e sem cartão:
  https://www.modash.io/free-influencer-search-tool
- NÃO usa nenhuma API paga, trial com cartão, ou plano. Custo: R$ 0,00.
- Respeita robots.txt e aplica um delay entre ações (educado, sem flood).
- É um scaffold *frágil por natureza*: a página é JS-pesada e o HTML pode
  mudar sem aviso. Por isso o modo CSV (`--source csv`) é o caminho PRIMÁRIO
  e recomendado. Se este módulo não conseguir extrair candidatos, ele levanta
  um erro claro pedindo para você usar o CSV — nunca inventa dados.
- Se algum dia a única forma de coletar for pagar algo, PARE e pergunte ao dono
  do projeto. Este módulo jamais deve seguir por um caminho pago.

Instalação (uma vez):
    pip install -r requirements.txt
    python -m playwright install chromium
"""

from __future__ import annotations

import time
import urllib.parse
import urllib.robotparser

from config import Config
from filters import Candidate


class ModashUnavailable(RuntimeError):
    """Levantado quando a coleta automática não é possível/permitida."""


def _robots_allows(url: str, user_agent: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)
    try:
        rp.read()
    except Exception:
        # Sem robots.txt legível -> seja conservador e permita, mas educado.
        return True
    return rp.can_fetch(user_agent, url)


def collect(config: Config, niches: list[str], limit: int) -> list[Candidate]:
    """Tenta coletar candidatos da busca gratuita da Modash.

    Retorna uma lista de Candidate (sem filtrar — o runner filtra depois).
    Levanta ModashUnavailable com instruções se não for possível.
    """
    if not _robots_allows(config.modash_free_url, config.scraper_user_agent):
        raise ModashUnavailable(
            "robots.txt da Modash não permite acesso automatizado a esta URL. "
            "Use o modo CSV: faça a busca gratuita no navegador e exporte para CSV "
            "(--source csv --input candidatos.csv)."
        )

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise ModashUnavailable(
            "Playwright não instalado. Rode:\n"
            "  pip install -r requirements.txt\n"
            "  python -m playwright install chromium\n"
            "Ou use o modo CSV (--source csv), que não precisa de navegador."
        ) from exc

    candidates: list[Candidate] = []
    delay = max(config.scraper_delay_seconds, 1.0)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(user_agent=config.scraper_user_agent)
        page = context.new_page()
        try:
            page.goto(config.modash_free_url, wait_until="networkidle", timeout=45_000)
            time.sleep(delay)

            for niche in niches:
                _run_search(page, niche, config, delay)
                time.sleep(delay)
                found = _parse_results(page, niche)
                candidates.extend(found)
                if len(candidates) >= limit:
                    break
        finally:
            context.close()
            browser.close()

    if not candidates:
        raise ModashUnavailable(
            "Não consegui extrair candidatos da busca gratuita (o HTML da página "
            "provavelmente mudou, ou exige interação humana / captcha). "
            "Caminho recomendado e estável: modo CSV.\n"
            "  1) Abra " + config.modash_free_url + " no navegador\n"
            "  2) Filtre Brasil + nicho + 500-10.000 seguidores\n"
            "  3) Copie os resultados para um CSV e rode:\n"
            "     python run.py --source csv --input candidatos.csv"
        )

    return candidates[:limit]


# ---------------------------------------------------------------------------
# Interação com a página. Os seletores abaixo são BEST-EFFORT e propositalmente
# tolerantes: se a estrutura mudar, _parse_results devolve [] e collect() cai
# na mensagem de fallback para CSV, em vez de inventar dados.
# ---------------------------------------------------------------------------
def _run_search(page, niche: str, config: Config, delay: float) -> None:
    """Preenche o campo de busca com o nicho e dispara. Tolerante a falha."""
    selectors = [
        "input[type='search']",
        "input[placeholder*='search' i]",
        "input[placeholder*='keyword' i]",
        "input[name*='keyword' i]",
    ]
    for sel in selectors:
        try:
            box = page.query_selector(sel)
            if box:
                box.click()
                box.fill("")
                box.type(niche, delay=60)
                time.sleep(delay)
                box.press("Enter")
                page.wait_for_load_state("networkidle", timeout=30_000)
                return
        except Exception:
            continue
    # Se não achou o campo, não faz nada: _parse_results decidirá pela URL atual.


def _parse_results(page, niche: str) -> list[Candidate]:
    """Extrai (handle, nome, seguidores) dos cards de resultado, se existirem.

    Retorna [] se nada plausível for encontrado — nunca fabrica valores.
    """
    results: list[Candidate] = []

    # Cada provedor renderiza de um jeito. Tentamos cards genéricos que
    # contenham um link para instagram.com. Se a página não expuser isso,
    # simplesmente não coletamos daqui.
    try:
        anchors = page.query_selector_all("a[href*='instagram.com/']")
    except Exception:
        return results

    seen: set[str] = set()
    for a in anchors:
        try:
            href = a.get_attribute("href") or ""
            handle = _handle_from_href(href)
            if not handle or handle in seen:
                continue
            seen.add(handle)

            card = _closest_card(a)
            name = _text_of(card, ["h2", "h3", "[class*='name']", "strong"]) or handle
            followers = _followers_from(card)

            results.append(
                Candidate(
                    handle=handle,
                    name=name,
                    followers=followers,
                    nicho_especifico=niche,
                    profile_url=f"https://www.instagram.com/{handle}/",
                    source="Modash free search",
                )
            )
        except Exception:
            continue

    return results


def _handle_from_href(href: str) -> str:
    import re

    m = re.search(r"instagram\.com/([A-Za-z0-9._]+)", href)
    if not m:
        return ""
    handle = m.group(1)
    # Ignora rotas que não são perfis.
    if handle.lower() in {"p", "reel", "explore", "accounts", "stories"}:
        return ""
    return handle


def _closest_card(anchor):
    try:
        return anchor.evaluate_handle(
            "el => el.closest('[class*=card],[class*=result],li,article,tr') || el.parentElement"
        ).as_element()
    except Exception:
        return anchor


def _text_of(node, selectors: list[str]) -> str:
    if node is None:
        return ""
    for sel in selectors:
        try:
            found = node.query_selector(sel)
            if found:
                text = (found.inner_text() or "").strip()
                if text:
                    return text
        except Exception:
            continue
    return ""


def _followers_from(node) -> int | None:
    """Procura um número de seguidores no texto do card. Só aceita valores reais."""
    if node is None:
        return None
    import re

    try:
        text = node.inner_text()
    except Exception:
        return None
    if not text:
        return None

    # Ex.: "3.2K followers", "1,204 seguidores", "8.5k"
    m = re.search(
        r"([\d.,]+)\s*([km])?\s*(followers|seguidores|seg)?",
        text,
        flags=re.IGNORECASE,
    )
    if not m:
        return None
    num_raw, suffix = m.group(1), (m.group(2) or "").lower()
    try:
        base = float(num_raw.replace(",", "").replace(".", "")) if not suffix else float(
            num_raw.replace(",", ".")
        )
    except ValueError:
        return None
    if suffix == "k":
        return int(base * 1_000)
    if suffix == "m":
        return int(base * 1_000_000)
    return int(base)
