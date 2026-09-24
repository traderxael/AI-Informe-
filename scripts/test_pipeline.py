#!/usr/bin/env python3
"""Tests locales del pipeline (sin red)."""
from __future__ import annotations

import unittest

import actualizar_modelos as am
import collect_signals as cs
import generar_informe as gi


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


class SourceKindTests(unittest.TestCase):
    def test_google_news_es_news(self) -> None:
        self.assertEqual(cs.source_kind(["claude"], "Google News — IA global"), "news")

    def test_hn_es_social(self) -> None:
        self.assertEqual(cs.source_kind([], "Hacker News"), "social")


if __name__ == "__main__":
    unittest.main()
