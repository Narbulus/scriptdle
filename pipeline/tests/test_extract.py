import io
import json
import subprocess
import tempfile
import unittest
import urllib.error
from pathlib import Path

from pipeline import extract
from pipeline.srt import Cue


class ExtractTests(unittest.TestCase):
    def test_scene_windows_split_at_largest_silence_gap(self):
        cues = [
            Cue(0, 0.0, 2.0, "Line zero."),
            Cue(1, 2.5, 4.5, "Line one."),
            Cue(2, 5.0, 7.0, "Line two."),
            # Big 25-second scene break between cue 2 and cue 3
            Cue(3, 32.0, 34.0, "New scene line three."),
            Cue(4, 34.5, 36.5, "Line four."),
            Cue(5, 37.0, 39.0, "Line five."),
            Cue(6, 39.5, 41.5, "Line six."),
        ]
        windows = extract.build_scene_windows(cues, target_seconds=40.0, max_cues=5, context_cues=2)
        self.assertEqual(len(windows), 2)
        self.assertEqual([c.index for c in windows[0].cues], [0, 1, 2])
        self.assertEqual([c.index for c in windows[1].cues], [3, 4, 5, 6])
        # Second window receives preceding cues as read-only context
        self.assertEqual([c.index for c in windows[1].context_cues], [1, 2])

    def test_prompt_strips_sdh_labels_when_requested(self):
        win = extract.SceneWindow(
            window_index=0,
            cues=[Cue(0, 10.0, 12.0, "I have a bad feeling about this.", speaker_label="LUKE")],
            context_cues=[Cue(99, 5.0, 7.0, "Watch out.", speaker_label="HAN")],
            start=8.0,
            end=14.0,
        )
        meta = {"title": "Star Wars", "year": 1977, "cast": [{"actor": "Mark Hamill", "canonical": "LUKE SKYWALKER"}]}
        stripped = extract.build_attribution_prompt(win, meta, mode="text", strip_sdh=True)
        kept = extract.build_attribution_prompt(win, meta, mode="text", strip_sdh=False)
        self.assertNotIn("[SDH=", stripped)
        self.assertIn("[SDH=LUKE]", kept)
        self.assertIn("[SDH=HAN]", kept)

    def test_extract_film_caches_and_verifies_with_mock_transport(self):
        cues = [
            Cue(0, 1.0, 3.0, "Did you hear that? They shut down the main reactor.", speaker_label="C-3PO"),
            Cue(1, 3.5, 5.5, "We'll be destroyed for sure. This is madness!", speaker_label="C-3PO"),
        ]
        meta = {"slug": "test-film", "title": "Star Wars", "year": 1977}
        calls = []

        def fake_transport(model, body):
            calls.append(model)
            if len(calls) == 1:
                payload = {
                    "attributions": [
                        {"id": 0, "speaker": "C-3PO", "conf": 0.96, "clean": True},
                        {"id": 1, "speaker": "C-3PO", "conf": 0.80, "clean": True},
                    ]
                }
            else:
                payload = {
                    "attributions": [
                        {"id": 1, "speaker": "C-3PO", "conf": 0.94, "clean": True},
                    ]
                }
            return {
                "candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}],
                "usageMetadata": {"promptTokenCount": 500, "candidatesTokenCount": 80},
            }

        client = extract.GeminiClient(api_key="test", transport=fake_transport)
        with tempfile.TemporaryDirectory() as tmp:
            cache_dir = Path(tmp) / "cache"
            res = extract.extract_film(
                cues=cues,
                meta=meta,
                client=client,
                model="gemini-3.8-flash",
                mode="text",
                cache_dir=cache_dir,
                strip_sdh=True,
                verify=True,
                verify_model="gemini-3.1-pro-preview",
                workers=1,
            )
            self.assertEqual(calls, ["gemini-3.8-flash", "gemini-3.1-pro-preview"])
            self.assertEqual(len(res["items"]), 2)
            # Independent agreement boosted cue 1 confidence
            self.assertGreaterEqual(res["items"][1]["conf"], 0.97)
            self.assertGreater(res["usage"]["estimatedCostUsd"], 0.0)

            # Second run should hit cache with zero additional API calls
            res2 = extract.extract_film(
                cues=cues,
                meta=meta,
                client=client,
                model="gemini-3.8-flash",
                mode="text",
                cache_dir=cache_dir,
                strip_sdh=True,
                workers=1,
            )
            self.assertEqual(len(calls), 2)
            self.assertEqual(res2["usage"]["cacheHits"], 1)

    def test_billing_402_raises_billing_error_immediately(self):
        def failing_transport(model, body):
            raise urllib.error.HTTPError(
                url="https://example.invalid",
                code=402,
                msg="Payment Required",
                hdrs={},
                fp=io.BytesIO(b'{"error":{"message":"prepayment credits are depleted"}}'),
            )

        client = extract.GeminiClient(api_key="test", transport=failing_transport)
        with self.assertRaises(extract.BillingError):
            client.generate_json("gemini-3.8-flash", [{"text": "hello"}])

    def test_slice_audio_mp3_with_real_ffmpeg(self):
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "tone.flac"
            mp3 = Path(tmp) / "slice.mp3"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-v", "error",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
                    "-ar", "16000", "-ac", "1", str(wav),
                ],
                check=True,
            )
            data = extract.slice_audio_mp3(wav, 0.5, 2.5, mp3)
            self.assertTrue(mp3.exists())
            self.assertGreater(len(data), 1000)

    def test_openrouter_client_converts_audio_and_reports_exact_cost(self):
        captured = {}

        def fake_transport(model, body):
            captured["model"] = model
            captured["body"] = body
            payload = {"attributions": [{"id": 0, "speaker": "HAN SOLO", "conf": 0.98, "clean": True}]}
            return {
                "choices": [{"message": {"content": json.dumps(payload)}}],
                "usage": {
                    "prompt_tokens": 1200,
                    "completion_tokens": 60,
                    "completion_tokens_details": {"reasoning_tokens": 10},
                    "cost": 0.0042,
                },
            }

        client = extract.OpenRouterClient(api_key="or-test", transport=fake_transport)
        text, usage = client.generate_json(
            "gemini-2.5-flash",
            [
                {"inlineData": {"mimeType": "audio/mpeg", "data": "QUJD"}},
                {"text": "Attribute this scene."},
            ],
        )
        self.assertEqual(captured["model"], "google/gemini-2.5-flash")
        content = captured["body"]["messages"][0]["content"]
        self.assertEqual(content[0]["type"], "input_audio")
        self.assertEqual(content[0]["input_audio"], {"data": "QUJD", "format": "mp3"})
        self.assertEqual(content[1], {"type": "text", "text": "Attribute this scene."})
        self.assertEqual(usage["promptTokenCount"], 1200)
        self.assertEqual(usage["candidatesTokenCount"], 60)
        self.assertEqual(usage["thoughtsTokenCount"], 10)
        self.assertAlmostEqual(usage["costUsd"], 0.0042)
        parsed = extract.parse_attributions_json(text)
        self.assertEqual(parsed[0]["speaker"], "HAN SOLO")

    def test_create_client_prefers_openrouter_in_auto_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            env_path = Path(tmp) / ".env"
            env_path.write_text("GEMINI_API_KEY=g-key\nOPENROUTER_API_KEY=or-key\n", encoding="utf-8")
            client = extract.create_client(provider="auto", env_path=env_path)
            self.assertIsInstance(client, extract.OpenRouterClient)
            gem_client = extract.create_client(provider="gemini", env_path=env_path)
            self.assertIsInstance(gem_client, extract.GeminiClient)

    def test_safe_model_slug_sanitizes_provider_slashes(self):
        self.assertEqual(extract.safe_model_slug("google/gemini-2.5-flash"), "google__gemini-2.5-flash")


if __name__ == "__main__":
    unittest.main()
