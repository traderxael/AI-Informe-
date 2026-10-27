#!/usr/bin/env python3
"""Tests locales del pipeline (sin red)."""
from __future__ import annotations

import gzip
import io
import ssl
import tempfile
import unittest
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

import actualizar_modelos as am
import collect_signals as cs
import feed_health as fh
import generar_informe as gi
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


if __name__ == "__main__":
    unittest.main()
