#!/usr/bin/env python3
"""Tests locales del pipeline (sin red)."""
from __future__ import annotations

import unittest

import actualizar_modelos as am
import collect_signals as cs


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

    def test_junk_hn_without_ai(self) -> None:
        self.assertTrue(cs.is_junk_title("Show HN: Hacker News, without AI"))
        self.assertFalse(cs.is_junk_title("OpenAI lanza GPT-6 Astra"))


class SourceKindTests(unittest.TestCase):
    def test_google_news_es_news(self) -> None:
        self.assertEqual(cs.source_kind(["claude"], "Google News — IA global"), "news")

    def test_hn_es_social(self) -> None:
        self.assertEqual(cs.source_kind([], "Hacker News"), "social")


if __name__ == "__main__":
    unittest.main()
