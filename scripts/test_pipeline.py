#!/usr/bin/env python3
"""Tests locales del pipeline (sin red)."""
from __future__ import annotations

import gzip
import json
import io
import ssl
import tempfile
import unittest
import urllib.error
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import actualizar_modelos as am
import collect_signals as cs
import feed_health as fh
import fx_viral as fx
import generar_feed as gf
import generar_informe as gi
import reparar_agujeros as ra
import sources as S


class LicenciaTests(unittest.TestCase):
    def test_openai_no_es_open(self) -> None:
        self.assertEqual(am.infer_licencia("OpenAI · Proprietary"), "cerrado")

    def test_mit_es_open(self) -> None:
        self.assertEqual(am.infer_licencia("Z.ai · MIT"), "open")

    def test_apache_es_open(self) -> None:
        self.assertEqual(am.infer_licencia("Tencent · Apache 2.0"), "open")

    def test_spacexai_se_normaliza(self) -> None:
        self.assertIn("xAI", am.normalize_org("SpaceXAI · Proprietary"))


class ClassifyTests(unittest.TestCase):
    def test_qwen_por_alibaba(self) -> None:
        self.assertIn("qwen", cs.classify_models("Alibaba lanza un chip"))

    def test_gpt_no_por_mod(self) -> None:
        self.assertNotIn("gpt", cs.classify_models("EU exige a los proveedores que mantengan sus mods"))

    def test_google_news_no_usa_por_etiqueta(self) -> None:
        country = cs.classify_country(
            "Alibaba lanza chips y modelos",
            "",
            "global",
        )
        self.assertEqual(country, "china")

    def test_latam_no_cae_en_usa_por_google(self) -> None:
        country = cs.classify_country(
            "Diputados piden capacitación en IA",
            "Tele13 Radio",
            "global",
        )
        self.assertEqual(country, "global")

    def test_hint_no_pisa_evidencia_del_titulo(self) -> None:
        # Regression: el hint de la consulta pesaba +3 y ganaba siempre, asi que
        # un titular de otro pais caia en la region de la busqueda.
        self.assertEqual(
            cs.classify_country(
                "OpenAI releases a new model in the US",
                "Google News — IA China modelos",
                "china",
            ),
            "usa",
        )
        self.assertEqual(
            cs.classify_country(
                "Anthropic open-sources Claude in California",
                "Google News — IA China modelos",
                "china",
            ),
            "usa",
        )

    def test_hint_sigue_ganando_sin_evidencia(self) -> None:
        # Sin evidencia en el titulo, el hint de la consulta manda.
        self.assertEqual(
            cs.classify_country("Nuevo chip para数据中心", "Google News — IA China modelos", "china"),
            "china",
        )
        self.assertEqual(
            cs.classify_country("Nueva ley de IA", "Google News — IA global", "global"),
            "global",
        )

    def test_junk_hn_without_ai(self) -> None:
        self.assertTrue(cs.is_junk_title("Show HN: Hacker News, without AI"))
        self.assertFalse(cs.is_junk_title("OpenAI launches GPT-6 Astra"))


class ResearchSourceTests(unittest.TestCase):
    def test_arxiv_no_cae_en_economia(self) -> None:
        self.assertEqual(
            gi.classify(
                "X-pressing Intimacy: Mental Health Disclosure After Twitter Acquisition",
                "arXiv:2610.30413v1 Announce Type: cross Abstract: acquisition cost",
                "arXiv cs.CL",
            ),
            "novedades",
        )

    def test_arxiv_no_cae_en_usos(self) -> None:
        self.assertEqual(
            gi.classify(
                "Artificial intelligence is creating a new global linguistic hierarchy",
                "Abstract: education healthcare university enterprise deployment",
                "arXiv cs.CL",
            ),
            "novedades",
        )

    def test_arxiv_no_cae_en_futuro(self) -> None:
        self.assertEqual(
            gi.classify(
                "UniGuard: Safety Generalization for Language Models",
                "Abstract: safety policy future governance",
                "arXiv cs.CL",
            ),
            "novedades",
        )

    def test_arxiv_no_cae_en_seguridad(self) -> None:
        self.assertEqual(
            gi.classify(
                "Rubric Dropout: Reward Hacking in RLHF",
                "Abstract: attacks hacking compromise backdoor",
                "arXiv cs.CL",
            ),
            "novedades",
        )

    def test_noticia_de_economia_sigue_clasificando(self) -> None:
        self.assertEqual(
            gi.classify("xAI raises $150M for Grok infrastructure", "", "TechCrunch AI"),
            "economia",
        )

    def test_classify_sin_fuente_mantiene_compatibilidad(self) -> None:
        self.assertEqual(
            gi.classify("OpenAI launches GPT-6 with a new API", ""),
            "novedades",
        )

    def test_collect_items_pasa_la_fuente(self) -> None:
        rss = (
            b'<?xml version="1.0"?><rss version="2.0"><channel><item>'
            b"<title>OpenAI launches GPT-6 with a new API</title>"
            b"<link>https://example.test/paper</link>"
            b"<description>Abstract: a new model</description>"
            b"</item></channel></rss>"
        )
        with (
            patch.object(gi, "FEEDS", [("arXiv cs.CL", "https://example.test/rss")]),
            patch.object(gi, "fetch_url", return_value=rss),
            patch.object(gi, "classify", return_value="novedades") as clf,
        ):
            items = gi.collect_items(date.today())
        self.assertEqual(len(items), 1)
        self.assertEqual(clf.call_args.args[2], "arXiv cs.CL")


class CountryBoundaryTests(unittest.TestCase):
    """Regression: palabras cortas de usa_words (ap, yi, sec, amd) matcheaban
    como substring dentro de "capable", "happens", "graph" -> pais equivocado."""

    def test_ap_no_matchea_como_substring(self) -> None:
        self.assertEqual(gi.classify_country("Capable of running 100B params", ""), "global")
        self.assertEqual(gi.classify_country("Happens to be cheaper than rivals", ""), "global")
        self.assertEqual(gi.classify_country("Mapping the ocean floor with AI", ""), "global")

    def test_legitimos_siguen_clasificados(self) -> None:
        self.assertEqual(gi.classify_country("OpenAI launches GPT-6", ""), "usa")
        self.assertEqual(gi.classify_country("SEC demanda a Coinbase", ""), "usa")
        self.assertEqual(gi.classify_country("Alibaba lanza un chip de IA", ""), "china")
        self.assertEqual(gi.classify_country("Tencent presenta modelo", ""), "china")


class GzipFeedTests(unittest.TestCase):
    """Regression: DeepMind servia Content-Encoding: gzip y parse_feed() solo
    entendia XML plano -> 0 items perdidos en silencio cada dia."""

    def test_parse_feed_descomprime_gzip(self) -> None:
        import gzip as _gz

        xml = b"<?xml version='1.0'?><rss><channel><item><title>T</title></item></channel></rss>"
        crudo = _gz.compress(xml)
        self.assertEqual(len(crudo[:2]), 2)
        self.assertEqual(crudo[:2], b"\x1f\x8b")
        # El magic gzip es detectable y parse_feed solo ve XML plano.
        self.assertEqual(len(gi.parse_feed(crudo)), 0)  # sin descomprimir: 0 items
        self.assertEqual(len(gi.parse_feed(_gz.decompress(crudo))), 1)  # descomprimido: 1 item


class FetchTlsFallbackTests(unittest.TestCase):
    XML = b"<?xml version='1.0'?><rss><channel><title>x</title></channel></rss>"

    def _forbidden(self, url: str) -> urllib.error.HTTPError:
        return urllib.error.HTTPError(url, 403, "Forbidden", None, None)

    def test_403_reintenta_con_tls12(self) -> None:
        with patch.object(
            gi.urllib.request,
            "urlopen",
            side_effect=[self._forbidden("https://x"), io.BytesIO(self.XML)],
        ) as mock:
            self.assertEqual(gi.fetch_url("https://x", retries=0), self.XML)
        self.assertEqual(mock.call_count, 2)
        self.assertIs(mock.call_args_list[0].kwargs["context"], gi.SSL_CONTEXT)
        self.assertIs(mock.call_args_list[1].kwargs["context"], gi.SSL_CONTEXT_TLS12)
        self.assertEqual(
            gi.SSL_CONTEXT_TLS12.maximum_version, ssl.TLSVersion.TLSv1_2
        )

    def test_403_dos_veces_devuelve_none(self) -> None:
        with patch.object(
            gi.urllib.request,
            "urlopen",
            side_effect=[self._forbidden("https://x"), self._forbidden("https://x")],
        ) as mock:
            self.assertIsNone(gi.fetch_url("https://x", retries=0))
        self.assertEqual(mock.call_count, 2)

    def test_decode_body_gzip(self) -> None:
        self.assertEqual(gi._decode_body(gzip.compress(self.XML)), self.XML)


class SourceKindTests(unittest.TestCase):
    def test_google_news_es_news(self) -> None:
        self.assertEqual(cs.source_kind(["claude"], "Google News — IA global"), "news")

    def test_ai_revolution_feed_muerto_no_esta_registrado(self) -> None:
        self.assertNotIn(
            "AI Revolution",
            {name for name, _url in gi.FEEDS},
        )

    def test_ai_news_feed_muerto_no_esta_registrado(self) -> None:
        self.assertNotIn("AI News", {name for name, _url in gi.FEEDS})
        self.assertNotIn(
            "artificialintelligence-news.com",
            " ".join(url for _name, url in gi.FEEDS),
        )
        self.assertNotIn("AI News", gi.AI_NATIVE_SOURCES)

    def test_hn_es_social(self) -> None:
        self.assertEqual(cs.source_kind([], "Hacker News"), "social")


class PromoFilterTests(unittest.TestCase):
    """Regression 24-sep: 9 de los 20 titulares principales eran publicidad
    u ofertas de Wired/Verge ("$100 Off", "2 days left to save $200", "Promo
    Code"). El filtro va sobre el TITULAR, no sobre el resumen en espanol."""

    def test_promo_codes(self) -> None:
        self.assertTrue(gi.es_promo("Motley Fool Promo Code: $200 Off on Stock Advisor"))
        self.assertTrue(gi.es_promo("AirDoctor Coupon Codes: 40% Off | September 2026"))
        self.assertTrue(gi.es_promo("Bose Ultra Open Earbuds Are $100 Off Right Now"))

    def test_evento_con_venta_de_entradas(self) -> None:
        self.assertTrue(
            gi.es_promo("2 days left to save up to $200 on a TechCrunch Disrupt 2026 pass — reason 4 of 5 to attend")
        )

    def test_una_noticia_real_no_es_promo(self) -> None:
        self.assertFalse(gi.es_promo("OpenAI launches GPT-6 Astra with 1M context window"))
        self.assertFalse(gi.es_promo("Anthropic open-sources Claude with a new safety eval"))
        self.assertFalse(gi.es_promo("Island Raises $400 Million at $6.4 Billion Valuation"))


class AiSignalFilterTests(unittest.TestCase):
    """Regression 24-sep: los feeds generalistas (Wired completo, The Verge
    completo) metian ofertas, clima, salud general y vida adulta en el informe."""

    def test_titulares_sin_ia_se_descartan(self) -> None:
        for titulo in [
            "SeaWorld Wants to Make You Horny",
            "Why No One Wants to Date Tech Bros",
            "Why This Weekend's Nor'easter Is Like a Hurricane",
            "The Ovary Is Surprisingly Active After Menopause",
            "Venus May Have Devoured Its Moon",
            "Control Resonant gets tough, but gives you the tools to deal with it",
        ]:
            self.assertFalse(gi.tiene_senal_ia(titulo), titulo)

    def test_titulares_con_ia_pasan(self) -> None:
        for titulo in [
            "Google is sending an AI satellite into space next week",
            "Gemini 4 is almost ready, says new Google DeepMind chief",
            "Why can't we just keep rogue AIs off the internet?",
            "AI-Powered Campaign Targets Hundreds of Online Retailers",
            "Why Trump's China rivalry and AI race delusion may endanger US",
        ]:
            self.assertTrue(gi.tiene_senal_ia(titulo), titulo)

    def test_senal_ia_puede_venir_del_resumen(self) -> None:
        # "Everything is spying on you..." no dice IA en el titular, pero el
        # item real de The Verge AI trae la senal en el summary. Ademas la
        # fuente es IA-nativa, asi que el filtro ni le exige senal.
        titulo = "Everything is spying on you and there's no opting out"
        self.assertFalse(gi.tiene_senal_ia(titulo))
        self.assertTrue(gi.tiene_senal_ia(titulo, "Meta glasses feed AI data to the cloud"))
        limpio, _ = gi.filtrar_items(
            [{"title": titulo, "summary": "Meta glasses feed AI data to the cloud", "source": "The Verge AI"}]
        )
        self.assertEqual(len(limpio), 1)

    def test_ai_no_matchea_como_substring(self) -> None:
        # "ai" dentro de "said"/"rain"/"detail" no es senal de IA.
        self.assertFalse(gi.tiene_senal_ia("He said the rain would stay in detail"))
        self.assertFalse(gi.tiene_senal_ia("Bose earbuds are $100 off"))

    def test_fuente_ia_nativa_no_se_filtra(self) -> None:
        items = [{"title": "Quarterly platform update", "summary": "", "source": "OpenAI"},
                 {"title": "The vibes are bad for Flock in Washington", "summary": "", "source": "Wired"}]
        limpio, stats = gi.filtrar_items(items)
        # OpenAI pasa aunque el titular no tenga senal de IA explicita.
        self.assertEqual([i["source"] for i in limpio], ["OpenAI"])
        self.assertEqual(stats.get("Wired"), 1)

    def test_promo_se_descarta_aunque_tenga_ia(self) -> None:
        items = [{"title": "Best Early Prime Day Robot Vacuum Sales Are From Roborock (2026)",
                  "summary": "", "source": "Wired"}]
        limpio, stats = gi.filtrar_items(items)
        self.assertEqual(limpio, [])
        self.assertEqual(stats.get("Wired"), 1)

    def test_conferencias_y_eventos_se_descartan(self) -> None:
        # 24-sep: la publicidad de TechCrunch Disrupt y el "[Virtual Event]"
        # de Dark Reading se colaban en "Lo mas visible" porque ninguna regla
        # de PROMO_PATTERN cubria el nombre de un evento. estas 6 fuentes son
        # AI_NATIVE_SOURCES, asi que el filtro de senal IA no las frenaba.
        for titulo in [
            "TechCrunch Disrupt 2026: Cal AI's Zach Yadegari on how to create viral growth",
            "TechCrunch Founder Summit 2026: Everything you need to know",
            "Meet the next wave of VCs judging Startup Battlefield 200 at TechCrunch Disrupt 2026",
            "[Virtual Event] Cybersecurity Outlook 2027",
            "Join us live for a webinar on AI agents in the enterprise",
            "Register now for the AI Summit 2026",
        ]:
            self.assertTrue(gi.es_promo(titulo), titulo)
            # ni siquiera Coming Soon debe salvar a un evento
            limpio, _ = gi.filtrar_items([{"title": titulo, "summary": "",
                                            "source": "TechCrunch AI"}])
            self.assertEqual(limpio, [], titulo)

    def test_nota_real_con_keyword_de_evento_sobrevive(self) -> None:
        # Un titular de NOTICIA puede decir "summit" sin ser publicidad.
        for titulo in [
            "OpenAI and Anthropic leaders clash at the AI Safety Summit on model testing",
            "Nvidia earnings beat: AI data center demand soars despite summit of concerns",
        ]:
            limpio, _ = gi.filtrar_items([{"title": titulo, "summary": "",
                                            "source": "Wired"}])
            self.assertEqual(len(limpio), 1, titulo)

    def test_fuentes_de_nicho_no_se_filtran(self) -> None:
        # arXiv cs.AI/cs.CL son IA por categoria: sus titulares son academicos
        # ("Which Objectives Need a Dial?") y AI_SIGNAL no los reconoce.
        # The Hacker News es 100% seguridad: "CVE-2026-87902", "ClickFix",
        # "Unpatched OnePlus Flaws" no mencionan IA pero son alertas reales.
        for fuente, titulo in [
            ("arXiv cs.AI", "Which Objectives Need a Dial? Predicting Objective Conflict"),
            ("arXiv cs.CL", "Are Stated Reasoning Steps Causally Load-Bearing?"),
            ("The Hacker News", "Attackers Exploit WordPress CVE-2026-87902 Within Hours"),
            ("The Hacker News", "Unpatched OnePlus Flaws Let Installed Apps Gain Root"),
            # Las 5 de seguridad que agregamos 24-sep: el filtro de senal IA
            # tiraba sus alertas porque son nomenclatura de producto pura.
            ("CISA Advisories", "Eufy Omni C20, Omni X10 Pro"),
            ("CISA Advisories", "CISA Adds Two Known Exploited Vulnerabilities to Catalog"),
            ("BleepingComputer", "MacSync malware uses public iCloud calendars to deliver payloads"),
            ("BleepingComputer", "CISA: Ransomware gangs now exploiting critical TeamCity flaw"),
            ("SecurityWeek", "US Court Sentences Armenian Man to Prison for Ryuk Ransomware"),
            ("Dark Reading", "SectopRAT Returns, Hiding Inside a Legitimate Application"),
            ("Dark Reading", "Ghost Service Accounts Enable M365 Data Theft in Chile"),
        ]:
            limpio, _ = gi.filtrar_items([{"title": titulo, "summary": "", "source": fuente}])
            self.assertEqual(len(limpio), 1, f"{fuente}: {titulo}")

    def test_fuentes_financieras_se_purgan(self) -> None:
        # SCMP Business y Cointelegraph son generalistas de finanzas: el filtro
        # debe eliminar su contenido que no tiene nada de IA.
        for fuente, titulo in [
            ("SCMP Business", "High office vacancy rates spur bid to rezone Kowloon East site"),
            ("Cointelegraph", "Bitcoin price steadies, ONDO rallies as Treasury yields hit highs"),
            ("Cointelegraph", "Sequans exits Bitcoin treasury strategy after selling 314 BTC"),
        ]:
            limpio, _ = gi.filtrar_items([{"title": titulo, "summary": "", "source": fuente}])
            self.assertEqual(limpio, [], f"{fuente}: {titulo}")


class RegenGuardTests(unittest.TestCase):
    """Regression 24-sep: el guard "si el informe ya existe, salir" hacia que
    el cron NUNCA aplicara una mejora de clasificación o de filtro a un
    informe del mismo día. El runner hace checkout del repo — que ya trae el
    markdown commiteado por el run anterior — y salía sin regenerar. El fix del
    filtro antibacterial llegaba al código pero el informe publicado seguía
    con publicidad: verificado en GitHub, 844 items y cero sección de
    seguridad después de un run en verde.
    """

    def _con_informe_previo(self, force: bool) -> tuple[tempfile.TemporaryDirectory, dict]:
        tmp = tempfile.TemporaryDirectory()
        root = Path(tmp.name)
        (root / "informes").mkdir()
        (root / "informes" / "2026-09-24.md").write_text("VIEJO", encoding="utf-8")
        (root / "web").mkdir()
        (root / "public").mkdir()

        original = (gi.ROOT, gi.INFORMES_DIR, gi.collect_items, gi.export_web_json,
                    gi.regenerate_web)
        llamadas: dict = {}

        def fake_collect(day, *a, **k):
            llamadas["collect"] = True
            return [{"title": "item nuevo", "summary": "", "source": "OpenAI",
                     "published": datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc),
                     "url": "https://ejemplo/x", "pais": "global",
                     "section": "novedades"}]

        gi.ROOT = root
        gi.INFORMES_DIR = root / "informes"
        gi.collect_items = fake_collect
        gi.export_web_json = lambda day, items: None
        gi.regenerate_web = lambda: None
        try:
            gi.write_informe(date(2026, 9, 24), force=force)
        finally:
            (gi.ROOT, gi.INFORMES_DIR, gi.collect_items,
             gi.export_web_json, gi.regenerate_web) = original
        return tmp, llamadas

    def test_regenera_aunque_el_informe_exista(self) -> None:
        tmp, llamadas = self._con_informe_previo(force=False)
        try:
            self.assertTrue(llamadas.get("collect"),
                            "write_informe no regeneró: collect_items no se llamó")
            texto = (Path(tmp.name) / "informes" / "2026-09-24.md").read_text(encoding="utf-8")
            self.assertNotEqual(texto, "VIEJO", "el markdown viejo sobrevivió")
            self.assertIn("item nuevo", texto)
        finally:
            tmp.cleanup()

    def test_force_tambien_regenera(self) -> None:
        tmp, llamadas = self._con_informe_previo(force=True)
        try:
            self.assertTrue(llamadas.get("collect"))
            texto = (Path(tmp.name) / "informes" / "2026-09-24.md").read_text(encoding="utf-8")
            self.assertIn("item nuevo", texto)
        finally:
            tmp.cleanup()


class KeywordsInvariantsTests(unittest.TestCase):
    """Invariantes de la tabla KEYWORDS.

    24-sep: "hospital" estaba DUPLICADO en "usos" (ingles + espanol) y eso
    inflaba el puntaje a 2, haciendo que "Researchers find data breach in
    hospital AI triage system" fuera clasificado como "usos" en vez de
    "seguridad". Las keywords se puntuan de a una, asi que un duplicado no es
    inocuo: sesga cualquier desempate.
    """

    def test_no_hay_keywords_duplicadas(self) -> None:
        for seccion, words in gi.KEYWORDS.items():
            dups = {w for w in words if words.count(w) > 1}
            self.assertEqual(dups, set(), f"{seccion} tiene duplicadas: {dups}")

    def test_todas_las_secciones_estan_en_SECTIONS(self) -> None:
        self.assertEqual(set(gi.KEYWORDS), set(gi.SECTIONS))

    def test_section_desempate_cubre_todas(self) -> None:
        # Si una seccion faltara en SECTION_DESEMPATE, classify() devolveria
        # "novedades" en un empate aunque tuviera keywords.
        self.assertEqual(set(gi.SECTION_DESEMPATE), set(gi.SECTIONS))

    def test_acentos_duplicados_no_existen(self) -> None:
        # _norm() quita acentos, asi que "médico" y "medico" son la MISMA
        # keyword y una de las dos es basura.
        for seccion, words in gi.KEYWORDS.items():
            literales = [w for w in words if w[:1] not in r"\\^$.|?*+()["]
            normalizadas = [gi._norm(w) for w in literales]
            dups = {w for w in normalizadas if normalizadas.count(w) > 1}
            self.assertEqual(dups, set(), f"{seccion}: {dups} colapsan al normalizar")


class SecurityKeywordsEsTests(unittest.TestCase):
    """Regression 24-sep: el LLM traduce los titulares al espanol, asi que
    "hacked"/"ransomware" en ingles ya no matcheaban y los hackeos de OpenAI
    caian en "usos"/"economia" en vez de "seguridad"."""

    def test_titular_en_espanol_cae_en_seguridad(self) -> None:
        self.assertEqual(
            gi.classify("OpenAI agents hackearon un sitio web del gobierno", ""),
            "seguridad",
        )
        self.assertEqual(
            gi.classify("Desarrolladores encuentran una vulnerabilidad en el motor de IA", ""),
            "seguridad",
        )
        self.assertEqual(
            gi.classify("Un ransomware opera contra hospitales en Espana", ""),
            "seguridad",
        )

    def test_acentos_no_rompen_el_match(self) -> None:
        # Las keywords van sin acentos; el titular viene del LLM CON acentos.
        self.assertEqual(gi.classify("Filtración de datos en una empresa de IA", ""), "seguridad")
        self.assertEqual(gi.classify("Ciberataque a una empresa de IA", ""), "seguridad")

    def test_ingles_sigue_funcionando(self) -> None:
        self.assertEqual(gi.classify("Hackers exploit critical Roundcube flaw", ""), "seguridad")
        self.assertEqual(gi.classify("CISA: ransomware gangs exploit TeamCity", ""), "seguridad")
        # 24-sep: titulares reales que se fugaban a otras secciones porque
        # "hacks" (sustantivo) y "hacked" (verb) no matcheaban "hackers".
        self.assertEqual(
            gi.classify("Autonomous AI Hacks Raise Thorny Questions of Legal Accountability", ""),
            "seguridad")
        # "government" suma a "usos"; la palabra "hacked" tiene que ganar.
        self.assertEqual(
            gi.classify("Australia says OpenAI agent hacked government site before Altman warning", ""),
            "seguridad")

    def test_titular_real_no_se_roba_por_una_keyword(self) -> None:
        # "attack" en seguridad no debe arrastrar notas de seguridad fisica
        # que en realidad son economia; el desempate es por puntaje completo.
        self.assertEqual(
            gi.classify("Nvidia earnings beat on AI data center demand", ""), "economia")
        # Y una nota de usos legitima que menciona "breach" en contexto IA
        # sigue siendo de seguridad, no de usos.
        self.assertEqual(
            gi.classify("Researchers find data breach in hospital AI triage system", ""), "seguridad")

    def test_singular_y_plural_ambos_matchean(self) -> None:
        # Las keywords se matchean por \b, asi que "vulnerability" (singular)
        # no matcheaba "vulnerabilities" y la nota caia en "novedades".
        self.assertEqual(gi.classify("A critical vulnerability in the AI engine", ""), "seguridad")
        self.assertEqual(gi.classify("Multiple vulnerabilities in the AI engine", ""), "seguridad")


class MoneyAbbrevTests(unittest.TestCase):
    """Regression 24-sep: los titulares financieros usan "$150M" / "$6.4B";
    con \\b el "150m" no matcheaba "million" y la nota caia en "novedades"."""

    def test_formas_abreviadas_de_dinero(self) -> None:
        for titulo in [
            "xAI raises $150M for Grok infrastructure",
            "Island Raises $400 Million at $6.4 Billion Valuation",
            "Startup raises $75M to scale its LLM",
        ]:
            self.assertEqual(gi.classify(titulo, ""), "economia", titulo)


class ClassifyWordBoundaryTests(unittest.TestCase):
    """Regression 24-sep: classify() usaba `word in blob` (substring), igual que
    el bug ya corregido en classify_country. Con keywords cortas ("api", "hack")
    eso matchea dentro de palabras mas grandes."""

    def test_api_no_matchea_dentro_de_otras_palabras(self) -> None:
        # "api" dentro de "capital"/"rapido"/"capitalismo" no es la API de IA.
        self.assertEqual(gi.classify("Un modelo de capital rapidísimo de Silicon Valley", ""), "novedades")

    def test_hack_no_matchea_dentro_de_shack(self) -> None:
        self.assertNotEqual(gi.classify("The shak in the shack was big", ""), "seguridad")

    def test_noticias_reales_siguen_clasificando(self) -> None:
        self.assertEqual(gi.classify("OpenAI launches GPT-6 with a new API", ""), "novedades")
        self.assertEqual(gi.classify("xAI raises $150M for Grok infrastructure", ""), "economia")


class ModelosDatasetTests(unittest.TestCase):
    def _filas(self) -> list[dict]:
        return [
            {
                "model_name": "Claude Opus 5.5 (High)",
                "organization": "anthropic",
                "license": "Proprietary",
                "rating": 1516.4,
                "rank": 2,
                "vote_count": 100,
                "category": "overall",
                "leaderboard_publish_date": "2026-10-22",
            },
            {
                "model_name": "Kimi K3 (Max)",
                "organization": "moonshot",
                "license": "Modified MIT",
                "rating": 1490.2,
                "rank": 3,
                "vote_count": 50,
                "category": "overall",
                "leaderboard_publish_date": "2026-10-22",
            },
            {
                "model_name": "Open Weights",
                "organization": "zai",
                "license": "Apache 2.0",
                "rating": 1400.0,
                "rank": 4,
                "vote_count": 10,
                "category": "overall",
                "leaderboard_publish_date": "2026-10-22",
            },
            {
                "model_name": "Ignorado",
                "organization": "x",
                "license": "MIT",
                "rating": 1.0,
                "rank": 1,
                "vote_count": 1,
                "category": "coding",
                "leaderboard_publish_date": "2026-10-22",
            },
        ]

    def _fila(self, i: int) -> dict:
        return {
            "model_name": f"Modelo {i}",
            "organization": "org",
            "license": "MIT",
            "rating": 1000 + i,
            "rank": i,
            "vote_count": 10,
            "category": "overall",
            "leaderboard_publish_date": "2026-10-22",
        }

    def _ordr(self) -> dict[str, dict]:
        return {
            "claude-opus-5.5": {
                "precio_in": 3.0,
                "precio_out": 15.0,
                "context": 200000,
                "org": "anthropic",
                "id_openrouter": "anthropic/claude-opus-5.5",
            },
            "kimi-k3": {
                "precio_in": 1.0,
                "precio_out": 4.0,
                "context": 128000,
                "org": "moonshotai",
                "id_openrouter": "moonshotai/kimi-k3",
            },
            "open-weights": {
                "precio_in": 0.1,
                "precio_out": 0.2,
                "context": 32000,
                "org": "z-ai",
                "id_openrouter": "z-ai/open-weights",
            },
        }

    def test_arena_mapea_y_filtra_overall(self) -> None:
        arena = am.arena_desde_filas(self._filas())
        self.assertEqual(len(arena), 3)
        self.assertNotIn("Ignorado", arena)
        self.assertEqual(arena["Claude Opus 5.5 (High)"]["elo"], 1516)
        self.assertEqual(arena["Claude Opus 5.5 (High)"]["licencia"], "cerrado")
        self.assertEqual(arena["Open Weights"]["licencia"], "open")
        self.assertEqual(arena["Kimi K3 (Max)"]["org"], "moonshot")

    def test_match_precio_por_alias(self) -> None:
        rows = am.match(am.arena_desde_filas(self._filas()), self._ordr())
        by = {r["modelo"]: r for r in rows}
        self.assertEqual(by["Claude Opus 5.5 (High)"]["precio_out"], 15.0)
        self.assertEqual(by["Kimi K3 (Max)"]["precio_out"], 4.0)
        self.assertEqual(by["Open Weights"]["precio_out"], 0.2)

    def test_payload_ordena_por_rank_y_respeta_max(self) -> None:
        payload = am.construir_payload(
            am.arena_desde_filas(self._filas()),
            self._ordr(),
            2,
            ahora=datetime(2026, 10, 25, 12, 0, 0),
        )
        self.assertEqual(payload["total"], 2)
        self.assertEqual(payload["modelos"][0]["modelo"], "Claude Opus 5.5 (High)")
        self.assertEqual(payload["modelos"][1]["modelo"], "Kimi K3 (Max)")
        self.assertEqual(payload["actualizado"], "2026-10-25T12:00:00")
        self.assertEqual(payload["con_precio"], 2)

    def test_payload_vacio_falla(self) -> None:
        with self.assertRaises(ValueError):
            am.construir_payload({}, {}, 60)

    def test_fetch_pagina_hasta_limite(self) -> None:
        primera = {"rows": [{"row": self._fila(i)} for i in range(100)]}
        segunda = {"rows": [{"row": self._fila(100 + i)} for i in range(5)]}
        with patch.object(am, "http_json", side_effect=[primera, segunda]) as mock:
            arena = am.fetch_lmarena("text", limit=105)
        self.assertEqual(len(arena), 105)
        self.assertEqual(mock.call_count, 2)

    def test_main_no_escribe_con_arena_vacia(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "modelos.json"
            with (
                patch.object(am, "OUT_PATHS", [out]),
                patch.object(am, "fetch_lmarena", return_value={}),
                patch.object(am, "fetch_openrouter", return_value={}),
                patch.object(am.sys, "argv", ["actualizar_modelos.py"]),
            ):
                with self.assertRaises(SystemExit):
                    am.main()
            self.assertFalse(out.exists())


class FeedHealthTests(unittest.TestCase):
    def test_construir_health_cuenta_estados(self) -> None:
        resultados = [
            {"nombre": "a", "url": "u", "items": 3, "estado": "ok", "detalle": ""},
            {"nombre": "b", "url": "u", "items": 0, "estado": "vacio", "detalle": "0 items"},
            {"nombre": "c", "url": "u", "items": 0, "estado": "error", "detalle": "x"},
        ]
        health = fh.construir_health(
            resultados, {"estado": "ok"}, ahora=datetime(2026, 10, 25, 12, 0, 0)
        )
        self.assertEqual(health["total_feeds"], 3)
        self.assertEqual(health["ok"], 1)
        self.assertEqual(health["vacios"], 1)
        self.assertEqual(health["rotos"], 1)
        self.assertEqual(health["generado"], "2026-10-25T12:00:00")

    def test_todos_los_feeds_representados(self) -> None:
        resultados = [
            {"nombre": nombre, "url": url, "items": 1, "estado": "ok", "detalle": ""}
            for nombre, url in S.FEEDS
        ]
        health = fh.construir_health(resultados, fh.estado_ranking({}))
        self.assertEqual(health["total_feeds"], len(S.FEEDS))
        self.assertEqual(len(health["feeds"]), len(S.FEEDS))

    def test_ranking_sin_datos(self) -> None:
        self.assertEqual(fh.estado_ranking({})["estado"], "sin_datos")
        self.assertEqual(fh.estado_ranking(None)["estado"], "sin_datos")

    def test_ranking_stale_y_ok(self) -> None:
        ahora = datetime(2026, 10, 25, 12, 0, 0)
        viejo = {"modelos": [{"elo": 1}], "actualizado": "2026-10-20T12:00:00"}
        fresco = {"modelos": [{"elo": 1}], "actualizado": "2026-10-25T10:00:00"}
        self.assertEqual(fh.estado_ranking(viejo, ahora)["estado"], "stale")
        self.assertEqual(fh.estado_ranking(fresco, ahora)["estado"], "ok")

    def test_probar_feed_vacio_no_explota(self) -> None:
        with (
            patch.object(fh.gi, "fetch_url", return_value=b"<rss></rss>"),
            patch.object(fh.gi, "parse_feed", return_value=[]),
        ):
            resultado = fh.probar_feed("x", "https://example.test/feed")
        self.assertEqual(resultado["estado"], "vacio")
        self.assertEqual(resultado["items"], 0)
        self.assertIn("0 items", resultado["detalle"])
        self.assertIn("B)", resultado["detalle"])

    def test_probar_feed_sin_respuesta_es_error(self) -> None:
        with patch.object(fh.gi, "fetch_url", return_value=None):
            resultado = fh.probar_feed("x", "https://example.test/feed")
        self.assertEqual(resultado["estado"], "error")


class RepararAgujerosTests(unittest.TestCase):
    """El detector de agujeros: solo lo recuperable por RSS, lo demás listado."""

    def test_agujeros_recientes_dentro_de_ventana(self) -> None:
        hoy = date(2026, 10, 28)
        existentes = {date(2026, 10, 28), date(2026, 10, 26), date(2026, 10, 24)}
        faltan = ra.agujeros_recientes(hoy, existentes)
        self.assertEqual(
            faltan,
            [
                date(2026, 10, 27),
                date(2026, 10, 25),
                date(2026, 10, 23),
                date(2026, 10, 22),
            ],
        )

    def test_sin_agujeros_recientes(self) -> None:
        hoy = date(2026, 10, 28)
        existentes = {hoy - timedelta(days=d) for d in range(0, 7)}
        self.assertEqual(ra.agujeros_recientes(hoy, existentes), [])

    def test_agujeros_antiguos_solo_fuera_de_ventana(self) -> None:
        hoy = date(2026, 10, 28)
        # Ventana: 10-27 .. 10-22. 10-21 y más viejo: no recuperable por RSS.
        existentes = {hoy, date(2026, 10, 20)}
        self.assertEqual(ra.agujeros_antiguos(hoy, existentes), [date(2026, 10, 21)])

    def test_fechas_existentes_ignora_plantilla_y_chatarra(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "2026-10-27.md").write_text("x", encoding="utf-8")
            (d / "_plantilla.md").write_text("x", encoding="utf-8")
            (d / "chatarra.md").write_text("x", encoding="utf-8")
            (d / "2026-10-25.md").write_text("x", encoding="utf-8")
            self.assertEqual(
                ra.fechas_existentes(d), {date(2026, 10, 27), date(2026, 10, 25)}
            )


class FeedTests(unittest.TestCase):
    """Tests del feed RSS/Atom (scripts/generar_feed.py), sin red."""

    def _items(self) -> list[dict]:
        return [
            {
                "titulo": "Titulo uno",
                "url": "https://example.com/a",
                "resumen": "Resumen uno",
                "fecha": "2026-11-04",
            },
            {
                "titulo": "Titulo dos",
                "url": "https://example.com/b",
                "resumen": "Resumen dos",
                "fecha": "2026-11-03",
            },
        ]

    def test_parse_fecha_acepta_formatos(self) -> None:
        for valor in ("2026-11-04", "2026-11-04T10:30:00", "2026-11-04T10:30:00.123"):
            self.assertIsNotNone(gf._parse_fecha(valor), valor)

    def test_parse_fecha_devuelve_none_si_no_parsable(self) -> None:
        self.assertIsNone(gf._parse_fecha("no es fecha"))
        self.assertIsNone(gf._parse_fecha(None))

    def test_rss_es_xml_valido_con_items(self) -> None:
        import xml.etree.ElementTree as ET

        ahora = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)
        root = ET.fromstring(gf.rss(self._items(), ahora))
        self.assertEqual(root.tag, "rss")
        canal = root.find("channel")
        self.assertIsNotNone(canal)
        self.assertEqual(canal.findtext("language"), "es-CL")
        nodes = canal.findall("item")
        self.assertEqual(len(nodes), 2)
        self.assertEqual(nodes[0].findtext("title"), "Titulo uno")
        self.assertEqual(nodes[0].findtext("link"), "https://example.com/a")

    def test_rss_escapa_html(self) -> None:
        items = [{"titulo": "IA & <script>", "url": "https://e.com", "resumen": "a < b", "fecha": "2026-11-04"}]
        xml = gf.rss(items, datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc))
        self.assertNotIn("<" + "script>", xml)
        self.assertIn("&" + "lt;script" + "&" + "gt;", xml)

    def test_atom_es_xml_valido_con_entradas(self) -> None:
        import xml.etree.ElementTree as ET

        ahora = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)
        root = ET.fromstring(gf.atom(self._items(), ahora))
        ns = "{http://www.w3.org/2005/Atom}"
        self.assertEqual(root.tag, ns + "feed")
        entradas = root.findall(ns + "entry")
        self.assertEqual(len(entradas), 2)
        self.assertEqual(entradas[0].findtext(ns + "title"), "Titulo uno")

    def test_load_items_ordena_por_fecha_descendente(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "informes.json"
            src.write_text(
                json.dumps(
                    [
                        {"fecha": "2026-11-03", "items": [{"titulo": "viejo", "fecha": "2026-11-03"}]},
                        {"fecha": "2026-11-04", "items": [{"titulo": "nuevo", "fecha": "2026-11-04"}]},
                    ]
                ),
                encoding="utf-8",
            )
            with patch.object(gf, "SRC", src):
                items = gf.load_items()
            self.assertEqual([i["titulo"] for i in items], ["nuevo", "viejo"])

    def test_load_items_respeta_max_items(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "informes.json"
            src.write_text(
                json.dumps(
                    [{"fecha": "2026-11-04", "items": [{"titulo": f"i{i}", "fecha": "2026-11-04"} for i in range(10)]}]
                ),
                encoding="utf-8",
            )
            with patch.object(gf, "SRC", src), patch.object(gf, "MAX_ITEMS", 3):
                self.assertEqual(len(gf.load_items()), 3)


class FeedXTests(unittest.TestCase):
    """Las señales de X tienen que llegar al RSS/Atom, no solo a la web."""

    def test_los_items_de_x_llegan_al_feed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "informes.json"
            items = [{"titulo": f"nov{i}", "url": "u", "seccion": "novedades",
                      "fecha": "2026-11-04"} for i in range(25)]
            items.append({"titulo": "senal de X", "url": "https://x.com/a/status/1",
                          "seccion": "x", "fecha": "2026-11-04"})
            src.write_text(json.dumps([{"fecha": "2026-11-04", "items": items}]),
                           encoding="utf-8")
            with patch.object(gf, "SRC", src):
                out = gf.load_items()
            self.assertIn("senal de X", [i["titulo"] for i in out])

    def test_el_feed_cabe_un_dia_completo_de_novedades_y_x(self) -> None:
        """25 novedades + 12 señales de X = 37 items: el feed no debe cortarlos."""
        self.assertGreaterEqual(gf.MAX_ITEMS, 37)

    def test_la_descripcion_del_feed_no_muestra_la_seccion_en_minusculas(self) -> None:
        """La sección "x" se muestra como "X": "· x" parece un typo en el feed."""
        items = [{"titulo": "senal", "url": "https://x.com/a/status/1",
                  "resumen": "1 visualizacion", "fuente": "X @OpenAI",
                  "seccion": "x", "fecha": "2026-11-04"}]
        xml = gf.rss(items, datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc))
        desc = xml.split("<description>")[2].split("</description>")[0]
        self.assertIn("· X", desc)
        self.assertNotIn("· x", desc)


class XImagenesTests(unittest.TestCase):
    """Extraccion de imagenes de tweets (scripts/fx_viral.py)."""

    def test_mini_agrega_parametros_al_cdn(self) -> None:
        url = "https://pbs.twimg.com/media/ABC123.jpg"
        self.assertEqual(fx.mini(url), url + "?format=jpg&name=small")

    def test_mini_reemplaza_name_orig(self) -> None:
        url = "https://pbs.twimg.com/media/ABC123.jpg?name=orig"
        self.assertEqual(
            fx.mini(url), "https://pbs.twimg.com/media/ABC123.jpg?format=jpg&name=small"
        )

    def test_mini_no_rompe_urls_con_query(self) -> None:
        url = "https://pbs.twimg.com/media/ABC123.jpg?format=png&name=large"
        self.assertEqual(
            fx.mini(url), "https://pbs.twimg.com/media/ABC123.jpg?format=jpg&name=small"
        )

    def test_mini_deja_intactas_urls_no_cdn(self) -> None:
        url = "https://example.com/foto.jpg?x=1"
        self.assertEqual(fx.mini(url), url)

    def test_mini_ignora_urls_vacias(self) -> None:
        self.assertEqual(fx.mini(""), "")

    def test_imagenes_toma_fotos(self) -> None:
        tweet = {
            "media": {
                "all": [
                    {"type": "photo", "url": "https://pbs.twimg.com/media/AAA.jpg"},
                    {"type": "photo", "url": "https://pbs.twimg.com/media/BBB.jpg"},
                ],
                "videos": [],
            }
        }
        imgs = fx.imagenes(tweet)
        self.assertEqual(len(imgs), 2)
        self.assertEqual(imgs[0]["tipo"], "foto")
        self.assertIn("name=small", imgs[0]["url"])

    def test_imagenes_usa_poster_en_videos(self) -> None:
        tweet = {
            "media": {
                "all": [
                    {
                        "type": "video",
                        "url": "https://video.twimg.com/x.mp4",
                        "thumbnail_url": "https://pbs.twimg.com/thumb/C.jpg",
                    }
                ],
                "videos": [{"url": "https://video.twimg.com/x.mp4"}],
            }
        }
        imgs = fx.imagenes(tweet)
        self.assertEqual(len(imgs), 1)
        self.assertEqual(imgs[0]["tipo"], "poster")
        self.assertIn("thumb/C.jpg", imgs[0]["url"])

    def test_imagenes_sin_media_devuelve_lista_vacia(self) -> None:
        self.assertEqual(fx.imagenes({}), [])
        self.assertEqual(fx.imagenes({"media": None}), [])
        self.assertEqual(fx.imagenes({"media": "texto"}), [])

    def test_norm_tweet_conserva_imagenes_y_avatar(self) -> None:
        tweet = {
            "id": "123",
            "text": "hola",
            "views": 10,
            "author": {"screen_name": "sama", "avatar_url": "https://pbs.twimg.com/avatar.jpg"},
            "media": {"all": [{"type": "photo", "url": "https://pbs.twimg.com/media/A.jpg"}], "videos": []},
        }
        t = fx._norm_tweet(tweet)
        self.assertEqual(t["autor"], "sama")
        self.assertEqual(t["avatar"], "https://pbs.twimg.com/avatar.jpg")
        self.assertEqual(len(t["imagenes"]), 1)

    def test_payload_web_solo_incluye_quienes_tienen_imagen(self) -> None:
        viral = [
            {
                "id": "1", "autor": "a", "avatar": "", "texto": "con foto", "url": "https://x.com/a/1",
                "views": 100, "likes": 1, "tema": "ia", "etiqueta": "ia", "tiene_video": False,
                "fecha": "2026-11-04", "imagenes": [{"url": "https://pbs.twimg.com/media/1.jpg", "thumb": "https://pbs.twimg.com/media/1s.jpg", "tipo": "foto"}],
            },
            {
                "id": "2", "autor": "b", "avatar": "", "texto": "sin foto", "url": "https://x.com/b/2",
                "views": 90, "likes": 0, "tema": "ia", "etiqueta": "ia", "tiene_video": False,
                "fecha": "2026-11-04", "imagenes": [],
            },
        ]
        web = fx.payload_web(viral, "2026-11-04", "2026-11-04T00:00:00Z")
        self.assertEqual(web["total"], 1)
        self.assertEqual(web["items"][0]["id"], "1")
        self.assertEqual(web["items"][0]["imagen"], "https://pbs.twimg.com/media/1s.jpg")
        self.assertEqual(web["fecha"], "2026-11-04")

    def test_payload_web_respeta_el_limite(self) -> None:
        # Cuentas distintas: el tope por cuenta se prueba en
        # XSeccionSitioTests (una sola cuenta no puede tomar la rejilla).
        viral = [
            {
                "id": str(i), "autor": f"a{i}", "avatar": "", "texto": "t", "url": "u", "views": i,
                "likes": 0, "tema": "ia", "etiqueta": "ia", "tiene_video": False, "fecha": "2026-11-04",
                "imagenes": [{"url": "https://pbs.twimg.com/media/x.jpg", "thumb": "https://pbs.twimg.com/media/xs.jpg", "tipo": "foto"}],
            }
            for i in range(30)
        ]
        web = fx.payload_web(viral, "2026-11-04", "2026-11-04T00:00:00Z", limite=5)
        self.assertEqual(web["total"], 5)


class XAutoriaTests(unittest.TestCase):
    """Filtro de autoria: la API de FxTwitter devuelve tambien retweets."""

    def test_propio_cuando_el_autor_es_la_cuenta(self) -> None:
        tweet = {"author": {"screen_name": "OpenAI"}, "reposted_by": None}
        self.assertTrue(fx.es_propio(tweet, "OpenAI"))

    def test_propio_ignora_mayusculas(self) -> None:
        tweet = {"author": {"screen_name": "zai_org"}, "reposted_by": None}
        self.assertTrue(fx.es_propio(tweet, "Zai_Org"))

    def test_no_propio_si_el_autor_es_otro(self) -> None:
        tweet = {"author": {"screen_name": "guhe120"}, "reposted_by": None}
        self.assertFalse(fx.es_propio(tweet, "zai_org"))

    def test_no_propio_si_viene_de_repost(self) -> None:
        tweet = {"author": {"screen_name": "zai_org"},
                 "reposted_by": {"screen_name": "zai_org"}}
        self.assertFalse(fx.es_propio(tweet, "zai_org"))

    def test_no_propio_si_no_hay_autor(self) -> None:
        self.assertFalse(fx.es_propio({}, "openai"))

    def test_filtrar_perfiles_descarta_autores_ajenos(self) -> None:
        tweets = [
            {"id": "1", "author": {"screen_name": "zai_org"}, "text": "mio"},
            {"id": "2", "author": {"screen_name": "guhe120"}, "text": "ajeno"},
            {"id": "3", "author": {"screen_name": "Zai_Org"}, "text": "mio2"},
        ]
        out = fx.filtrar_por_autoria(tweets, "zai_org")
        self.assertEqual([t["id"] for t in out], ["1", "3"])

    def test_filtrar_perfiles_con_retweets_incluidos_marca_el_original(self) -> None:
        tweets = [
            {"id": "1", "author": {"screen_name": "guhe120"},
             "reposted_by": {"screen_name": "zai_org"}, "text": "ajeno"},
        ]
        out = fx.filtrar_por_autoria(tweets, "zai_org", incluir_retweets=True)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["repost_de"], "zai_org")


class XCacheImagenesTests(unittest.TestCase):
    """Cache local de imagenes de X en public/data/x-img/."""

    def test_nombre_de_archivo_usa_el_id_del_tweet(self) -> None:
        self.assertEqual(fx.nombre_imagen("2118124891572748288", "foto"),
                         "2118124891572748288.jpg")

    def test_nombre_de_archivo_sanitiza(self) -> None:
        self.assertEqual(fx.nombre_imagen("../etc/passwd", "foto"), "etcpasswd.jpg")

    def test_debe_cachear_solo_hasta_el_limite(self) -> None:
        self.assertTrue(fx.debe_cachear("https://pbs.twimg.com/media/a.jpg", 50_000))
        self.assertFalse(fx.debe_cachear("https://pbs.twimg.com/media/a.jpg", 200_000))

    def test_debe_cachear_el_poster_de_video_de_104_kb(self) -> None:
        """Los posters de video pesan ~104 KB y con el tope de 80 KB quedaban
        fuera: la portada depended del hotlink para esas tarjetas."""
        self.assertTrue(fx.debe_cachear("https://pbs.twimg.com/amplify_video_thumb/a.jpg",
                                        104_000))
        self.assertGreaterEqual(fx.IMG_MAX_BYTES, 104_000)

    def test_debe_cachear_solo_https(self) -> None:
        self.assertFalse(fx.debe_cachear("http://pbs.twimg.com/media/a.jpg", 1000))
        self.assertFalse(fx.debe_cachear("data:image/png;base64,AAA", 1000))

    def test_cachear_imagen_ignora_fallos_de_red(self) -> None:
        """Un 404 nunca puede tumbar el pipeline."""
        with patch.object(fx.time, "sleep", lambda _s: None):
            destino = fx.cachear_imagen("https://pbs.twimg.com/media/noexiste.jpg",
                                        "123", Path(tempfile.gettempdir()))
        self.assertIsNone(destino)

    def test_la_descarga_reintenta_tras_un_fallo_temporal(self) -> None:
        """pbs.twimg.com corta la conexión a ratos: con un reintento, la imagen
        no se pierde para siempre en la corrida del día."""
        intentos = {"n": 0}

        class _Resp:
            def read(self) -> bytes:
                return b"x" * 100

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def fake_urlopen(req, timeout=None):
            intentos["n"] += 1
            if intentos["n"] == 1:
                raise urllib.error.URLError("conexion cortada")
            return _Resp()

        with tempfile.TemporaryDirectory() as tmp:
            destino_dir = Path(tmp)
            with patch.object(fx.urllib.request, "urlopen", fake_urlopen), \
                    patch.object(fx.time, "sleep", lambda _s: None):
                destino = fx.cachear_imagen("https://pbs.twimg.com/media/a.jpg",
                                            "123", destino_dir)
            self.assertIsNotNone(destino)
            self.assertEqual(intentos["n"], 2)
            self.assertTrue(destino.exists())

    def test_nombre_de_avatar_usa_el_handle(self) -> None:
        self.assertEqual(fx.nombre_avatar("OpenAI", "png"), "avatar-OpenAI.png")

    def test_nombre_de_avatar_sanitiza(self) -> None:
        self.assertEqual(fx.nombre_avatar("../etc", "jpg"), "avatar-etc.jpg")

    def test_cachear_avatar_ignora_fallos_de_red(self) -> None:
        destino = fx.cachear_avatar("https://pbs.twimg.com/profile_images/noexiste.jpg",
                                    "OpenAI", Path(tempfile.gettempdir()))
        self.assertIsNone(destino)

    def test_payload_web_cachea_el_avatar(self) -> None:
        """Los avatares vienen por hotlink y pbs.twimg.com a veces no responde:
        si fallan, las tarjetas se ven sin foto de la cuenta."""
        viral = [{
            "id": "1", "autor": "OpenAI",
            "avatar": "https://pbs.twimg.com/profile_images/a.jpg",
            "texto": "t", "url": "u", "views": 10, "likes": 0, "tema": "ia",
            "etiqueta": "ia", "tiene_video": False, "fecha": "2026-11-04",
            "imagenes": [{"url": "https://pbs.twimg.com/media/x.jpg",
                          "thumb": "https://pbs.twimg.com/media/xs.jpg", "tipo": "foto"}],
        }]
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp)
            with patch.object(fx, "cachear_imagen", return_value=cache / "1.jpg"), \
                    patch.object(fx, "cachear_avatar",
                                 return_value=cache / "avatar-OpenAI.jpg"):
                web = fx.payload_web(viral, "2026-11-04", "2026-11-04T00:00:00Z",
                                     cache_dir=cache)
        self.assertEqual(web["items"][0]["avatar"], "/data/x-img/avatar-OpenAI.jpg")

    def test_payload_web_conserva_el_avatar_si_no_se_puede_cachear(self) -> None:
        viral = [{
            "id": "1", "autor": "OpenAI",
            "avatar": "https://pbs.twimg.com/profile_images/a.jpg",
            "texto": "t", "url": "u", "views": 10, "likes": 0, "tema": "ia",
            "etiqueta": "ia", "tiene_video": False, "fecha": "2026-11-04",
            "imagenes": [{"url": "https://pbs.twimg.com/media/x.jpg",
                          "thumb": "https://pbs.twimg.com/media/xs.jpg", "tipo": "foto"}],
        }]
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp)
            with patch.object(fx, "cachear_imagen", return_value=cache / "1.jpg"), \
                    patch.object(fx, "cachear_avatar", return_value=None):
                web = fx.payload_web(viral, "2026-11-04", "2026-11-04T00:00:00Z",
                                     cache_dir=cache)
        self.assertEqual(web["items"][0]["avatar"],
                         "https://pbs.twimg.com/profile_images/a.jpg")

    def test_payload_web_descarga_el_avatar_una_vez_por_cuenta(self) -> None:
        viral = [{
            "id": str(i), "autor": "OpenAI",
            "avatar": "https://pbs.twimg.com/profile_images/a.jpg",
            "texto": "t", "url": "u", "views": 10, "likes": 0, "tema": "ia",
            "etiqueta": "ia", "tiene_video": False, "fecha": "2026-11-04",
            "imagenes": [{"url": "https://pbs.twimg.com/media/x.jpg",
                          "thumb": "https://pbs.twimg.com/media/xs.jpg", "tipo": "foto"}],
        } for i in range(3)]
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp)
            with patch.object(fx, "cachear_imagen", return_value=cache / "x.jpg"), \
                    patch.object(fx, "cachear_avatar",
                                 return_value=cache / "avatar-OpenAI.jpg") as mock_avatar:
                fx.payload_web(viral, "2026-11-04", "2026-11-04T00:00:00Z",
                               cache_dir=cache)
        self.assertEqual(mock_avatar.call_count, 1)


class XInformeTests(unittest.TestCase):
    """Las señales de X se convierten en items del informe diario."""

    def test_x_items_desde_json_de_fx_viral(self) -> None:
        datos = {
            "fecha": "2026-11-05",
            "viral": [
                {
                    "id": "1",
                    "autor": "OpenAI",
                    "texto": "Presentamos GPT-6 con razonamiento nativo",
                    "url": "https://x.com/OpenAI/status/1",
                    "views": 500000,
                    "likes": 1200,
                    "tema": "lanzamiento",
                    "etiqueta": "ia",
                    "fecha": "2026-11-05T10:00:00Z",
                    "imagenes": [{"url": "https://pbs.twimg.com/media/a.jpg",
                                  "thumb": "https://pbs.twimg.com/media/a.jpg",
                                  "tipo": "foto"}],
                },
                {
                    "id": "2",
                    "autor": "zai_org",
                    "texto": "post sin imagen",
                    "url": "https://x.com/zai_org/status/2",
                    "views": 90000,
                    "tema": "producto",
                    "etiqueta": "china-ai",
                    "fecha": "2026-11-05T11:00:00Z",
                    "imagenes": [],
                },
            ],
        }
        items = gi.x_items(datos, limite=10)
        # Los posts SIN imagen tambien entran: el informe es texto y 45% de
        # los virales del dia no traen foto (filtrarlos pierde la señal).
        self.assertEqual(len(items), 2)
        por_fuente = {it["source"]: it for it in items}
        it = por_fuente["X @OpenAI"]
        self.assertEqual(it["section"], "x")
        self.assertEqual(it["title"], "Presentamos GPT-6 con razonamiento nativo")
        self.assertEqual(it["link"], "https://x.com/OpenAI/status/1")
        self.assertEqual(it["source"], "X @OpenAI")
        self.assertEqual(it["country"], "global")
        self.assertEqual(it["published"].isoformat(), "2026-11-05T10:00:00+00:00")
        sin_imagen = por_fuente["X @zai_org"]
        self.assertEqual(sin_imagen["country"], "china")

    def test_x_items_ignora_json_vacio_o_invalido(self) -> None:
        self.assertEqual(gi.x_items({}), [])
        self.assertEqual(gi.x_items({"viral": []}), [])
        self.assertEqual(gi.x_items(None), [])

    def test_x_items_limpia_el_texto(self) -> None:
        datos = {"viral": [
            {"id": "1", "autor": "a",
             "texto": "Hola   mundo\n\nsegunda línea https://t.co/abc123",
             "url": "u", "views": 10, "tema": "ia", "etiqueta": "ia",
             "fecha": "2026-11-05", "imagenes": []},
        ]}
        titulo = gi.x_items(datos)[0]["title"]
        self.assertNotIn("\n", titulo)
        self.assertNotIn("https://", titulo)
        self.assertEqual(titulo, "Hola mundo segunda línea")

    def test_x_items_ordena_por_fecha_y_luego_vistas(self) -> None:
        datos = {"viral": [
            {"id": "viejo", "autor": "a", "texto": "viejo", "url": "u",
             "views": 900000, "etiqueta": "ia", "fecha": "2026-11-01",
             "imagenes": []},
            {"id": "nuevo", "autor": "a", "texto": "nuevo", "url": "u",
             "views": 10, "etiqueta": "ia", "fecha": "2026-11-05",
             "imagenes": []},
        ]}
        items = gi.x_items(datos)
        self.assertEqual([i["title"] for i in items], ["nuevo", "viejo"])

    def test_x_items_acepta_fecha_en_formato_rfc(self) -> None:
        """La API devuelve la fecha como texto RFC, no como ISO."""
        datos = {"viral": [
            {"id": "1", "autor": "a", "texto": "hola", "url": "u", "views": 10,
             "etiqueta": "ia", "fecha": "Fri Oct 30 19:38:20 +0000 2026",
             "imagenes": []},
        ]}
        pub = gi.x_items(datos)[0]["published"]
        self.assertEqual(pub.year, 2026)
        self.assertEqual(pub.month, 10)
        self.assertEqual(pub.day, 30)

    def test_x_items_marca_el_repost(self) -> None:
        datos = {"viral": [
            {"id": "1", "autor": "guhe120", "texto": "hola", "url": "u",
             "views": 10, "etiqueta": "ia", "fecha": "2026-11-05",
             "repost_de": "zai_org", "imagenes": []},
        ]}
        item = gi.x_items(datos)[0]
        self.assertEqual(item["source"], "X @guhe120")
        self.assertIn("zai_org", item["summary"])

    def test_x_items_respeta_el_limite(self) -> None:
        datos = {"viral": [
            {"id": str(i), "autor": "a", "texto": f"t{i}", "url": "u",
             "views": 1000, "tema": "ia", "etiqueta": "ia", "fecha": "2026-11-05",
             "imagenes": [{"url": "https://x/y.jpg", "thumb": "https://x/y.jpg",
                           "tipo": "foto"}]}
            for i in range(10)
        ]}
        self.assertEqual(len(gi.x_items(datos, limite=3)), 3)

    def test_x_items_no_duplican_titulos_vacios(self) -> None:
        datos = {"viral": [
            {"id": "1", "autor": "a", "texto": "   ", "url": "u", "views": 1,
             "tema": "ia", "etiqueta": "ia", "fecha": "2026-11-05",
             "imagenes": [{"url": "https://x/y.jpg", "thumb": "https://x/y.jpg",
                           "tipo": "foto"}]}
        ]}
        self.assertEqual(gi.x_items(datos), [])


class XCuentasTests(unittest.TestCase):
    """Invariantes de la lista de cuentas monitoreadas."""

    def test_no_hay_cuentas_repetidas(self) -> None:
        handles = [h for h, _e, _t in fx.CUENTAS]
        self.assertEqual(len(handles), len(set(handles)))
        self.assertEqual(len(handles), len(set(h.lower() for h in handles)))

    def test_todas_las_cuentas_tienen_tres_campos(self) -> None:
        for cuenta in fx.CUENTAS:
            self.assertEqual(len(cuenta), 3, cuenta)
            self.assertTrue(cuenta[0].strip(), cuenta)
            self.assertTrue(cuenta[1].strip(), cuenta)


class XSeccionSitioTests(unittest.TestCase):
    """La sección de X del sitio (portada + informe) es de IA, no de mercado.

    Con las cuentas nuevas, @WatcherGuru (cripto) se llevaba 12 de las 24
    tarjetas de la portada y 8 de las 12 del informe: la sección se titula
    "Lo que la IA está haciendo" y mostraba cotizaciones del Nasdaq.
    """

    def _post(self, autor: str, etiqueta: str, post_id: str, views: int) -> dict:
        return {
            "id": post_id, "autor": autor, "texto": f"post {post_id}",
            "url": f"https://x.com/{autor}/status/{post_id}", "views": views,
            "likes": 10, "tema": "producto", "etiqueta": etiqueta,
            "fecha": "2026-11-05T10:00:00Z",
            "imagenes": [{"url": f"https://pbs.twimg.com/media/{post_id}.jpg",
                          "thumb": f"https://pbs.twimg.com/media/{post_id}.jpg",
                          "tipo": "foto"}],
        }

    def test_el_payload_web_excluye_el_nicho_trading(self) -> None:
        viral = [self._post("WatcherGuru", "trading", "1", 900_000),
                 self._post("OpenAI", "ia", "2", 100)]
        web = fx.payload_web(viral, "2026-11-05", "2026-11-05T00:00:00Z")
        self.assertEqual([i["autor"] for i in web["items"]], ["OpenAI"])

    def test_el_payload_web_no_deja_una_cuenta_tomar_la_rejilla(self) -> None:
        viral = [self._post("OpenAI", "ia", str(i), 900_000 - i) for i in range(6)]
        viral.append(self._post("claudeai", "ia", "z", 10))
        web = fx.payload_web(viral, "2026-11-05", "2026-11-05T00:00:00Z")
        autores = [i["autor"] for i in web["items"]]
        self.assertEqual(autores.count("OpenAI"), 3)
        self.assertIn("claudeai", autores)

    def test_x_items_excluye_el_nicho_trading(self) -> None:
        datos = {"viral": [self._post("WatcherGuru", "trading", "1", 900_000)]}
        self.assertEqual(gi.x_items(datos), [])

    def test_x_items_no_deja_una_cuenta_tomar_la_seccion(self) -> None:
        viral = [self._post("OpenAI", "ia", str(i), 900_000 - i) for i in range(6)]
        viral.append(self._post("claudeai", "ia", "z", 10))
        items = gi.x_items({"viral": viral}, limite=10)
        autores = [i["source"] for i in items]
        self.assertEqual(autores.count("X @OpenAI"), 3)
        self.assertIn("X @claudeai", autores)


class XReintentosTests(unittest.TestCase):
    """El 404 de FxTwitter es transitorio (rate limit): hay que reintentar.

    Medido: en rafaga, 12 de 25 requests contestaron 404; con hasta 3
    intentos, las 10 cuentas probadas respondieron.
    """

    class _Resp:
        def __init__(self, datos: bytes) -> None:
            self._datos = datos

        def read(self) -> bytes:
            return self._datos

        def __enter__(self) -> "XReintentosTests._Resp":
            return self

        def __exit__(self, *a) -> bool:
            return False

    def test_api_get_reintenta_tras_un_404(self) -> None:
        llamadas: list[int] = []

        def fake_urlopen(req, timeout=None):
            llamadas.append(1)
            if len(llamadas) == 1:
                raise urllib.error.HTTPError("u", 404, "Not Found", None, None)
            return XReintentosTests._Resp(b'{"results": []}')

        with patch.object(fx.urllib.request, "urlopen", fake_urlopen), \
                patch.object(fx.time, "sleep", lambda _s: None):
            data = fx.api_get("https://api.fxtwitter.com", "/2/profile/OpenAI/statuses",
                              {"count": 20})
        self.assertEqual(data, {"results": []})
        self.assertEqual(len(llamadas), 2)

    def test_api_get_agota_los_reintentos_y_devuelve_none(self) -> None:
        llamadas: list[int] = []

        def fake_urlopen(req, timeout=None):
            llamadas.append(1)
            raise urllib.error.HTTPError("u", 404, "Not Found", None, None)

        with patch.object(fx.urllib.request, "urlopen", fake_urlopen), \
                patch.object(fx.time, "sleep", lambda _s: None):
            data = fx.api_get("https://api.fxtwitter.com", "/2/profile/OpenAI/statuses",
                              {"count": 20})
        self.assertIsNone(data)
        self.assertEqual(len(llamadas), 3)

    def test_api_get_no_reintenta_otros_errores(self) -> None:
        llamadas: list[int] = []

        def fake_urlopen(req, timeout=None):
            llamadas.append(1)
            raise urllib.error.URLError("sin dns")

        with patch.object(fx.urllib.request, "urlopen", fake_urlopen), \
                patch.object(fx.time, "sleep", lambda _s: None):
            data = fx.api_get("https://api.fxtwitter.com", "/2/search", {"q": "x"})
        self.assertIsNone(data)
        self.assertEqual(len(llamadas), 1)


class XVentanaTests(unittest.TestCase):
    """Ventana de recencia: un post viejo no puede ser "lo que pasó hoy"."""

    def _ahora(self) -> datetime:
        return datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)

    def test_es_reciente_acepta_hoy(self) -> None:
        self.assertTrue(fx.es_reciente("2026-11-05T09:00:00Z", ahora=self._ahora()))

    def test_es_reciente_rechaza_hace_8_dias(self) -> None:
        self.assertFalse(fx.es_reciente("2026-10-28T09:00:00Z", ahora=self._ahora()))

    def test_es_reciente_acepta_hace_6_dias(self) -> None:
        self.assertTrue(fx.es_reciente("2026-10-30T09:00:00Z", ahora=self._ahora()))

    def test_es_reciente_rechaza_futuro_lejano(self) -> None:
        self.assertFalse(fx.es_reciente("2026-11-20T09:00:00Z", ahora=self._ahora()))

    def test_es_reciente_acepta_formato_rfc(self) -> None:
        self.assertTrue(fx.es_reciente("Tue Nov 03 19:38:20 +0000 2026", ahora=self._ahora()))

    def test_es_reciente_sin_fecha_no_descarta(self) -> None:
        """Si no se puede leer la fecha, no se pierde la señal."""
        self.assertTrue(fx.es_reciente(None, ahora=self._ahora()))
        self.assertTrue(fx.es_reciente("fecha rara", ahora=self._ahora()))


class XEnInformeTests(unittest.TestCase):
    """La sección "x" existe en el informe y sus items llegan al feed."""

    def _datos(self) -> dict:
        return {"viral": [
            {"id": "1", "autor": "OpenAI", "texto": "GPT-6 con razonamiento nativo",
             "url": "https://x.com/OpenAI/status/1", "views": 500000, "likes": 1200,
             "tema": "lanzamiento", "etiqueta": "ia", "fecha": "2026-11-05T10:00:00Z",
             "imagenes": [{"url": "https://pbs.twimg.com/media/a.jpg",
                           "thumb": "https://pbs.twimg.com/media/a.jpg",
                           "tipo": "foto"}]},
        ]}

    def test_la_seccion_x_esta_declarada(self) -> None:
        self.assertIn("x", gi.SECTIONS)
        self.assertIn("x", gi.SECTION_TITLES)

    def test_el_markdown_incluye_la_seccion_x(self) -> None:
        items = gi.x_items(self._datos(), limite=5)
        md = gi.render_markdown(date(2026, 11, 5), items)
        self.assertIn(gi.SECTION_TITLES["x"], md)
        self.assertIn("X @OpenAI", md)
        self.assertIn("https://x.com/OpenAI/status/1", md)

    def test_la_lista_simple_incluye_los_items_de_x(self) -> None:
        data = {"por_seccion": {"novedades": [{"titulo": "novedad"}],
                                 "x": [{"titulo": "senal de X"}]}}
        out = gi.items_feed(data)
        self.assertEqual([i["titulo"] for i in out], ["novedad", "senal de X"])

    def test_la_lista_simple_no_incluye_las_otras_secciones(self) -> None:
        data = {"por_seccion": {"novedades": [{"titulo": "n"}],
                                 "usos": [{"titulo": "u"}],
                                 "x": [{"titulo": "x"}]}}
        out = gi.items_feed(data)
        self.assertEqual([i["titulo"] for i in out], ["n", "x"])

    def test_la_lista_simple_sigue_funcionando_sin_x(self) -> None:
        data = {"por_seccion": {"novedades": [{"titulo": "n"}]}}
        self.assertEqual([i["titulo"] for i in gi.items_feed(data)], ["n"])


if __name__ == "__main__":
    unittest.main()
