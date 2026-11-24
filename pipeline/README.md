# Scriptle Extraction Pipeline

Zero-dependency Python 3 + `ffmpeg` pipeline that turns any movie on Jellyfin
into a validated, high-precision Scriptle script JSON — without needing a fan
screenplay, local Whisper/pyannote GPU models, or a manual human-review UI.

## Architecture

| Module | Responsibility |
|---|---|
| `pipeline/jellyfin.py` | Jellyfin library audit, movie metadata + cast/role roster, SDH SRT download (+ SubDL fallback), fast center-channel mono audio pull (`center.flac`). |
| `pipeline/srt.py` | SRT & MicroDVD parsing, UTF-16/CP1252 decoding, SDH speaker-label extraction, dash multi-speaker splitting, continuation merging. |
| `pipeline/extract.py` | Multimodal scene-window attribution (`text` / `audio` / `video`) via Gemini REST API (`gemini-3.8-flash` default, optional `--verify` with `gemini-3.1-pro-preview`), silence-bounded ~7-minute scene windows with 15-cue read-only context, calibrated confidence scores, per-chunk disk cache & cost accounting. |
| `pipeline/export.py` | Contiguous high-confidence dialogue run filter (guarantees genuine `[target, context1, context2]` windows with zero skipped lines), `topSpeakingCast` computation, and `generate-daily-puzzles.py` compatibility validator. |
| `pipeline/benchmark.py` | Zero-leakage benchmark harness measuring held-out SDH anchor accuracy, precision@confidence tiers (`>=0.80`..`>=0.95`), 3-line puzzle-window accuracy, latency, and $/movie economics. |
| `pipeline/align.py` | Monotonic banded-DP sequence aligner used for SDH label transfer, pack auditing, and reference-script scoring. |
| `pipeline/subtitle_merge.py` | Transfers SDH speaker labels from an alternate release onto a media-timed SRT. |
| `pipeline/audit_pack.py` | Audits shipped scripts against real subtitles to flag deleted/unfilmed lines. |
| `pipeline/cli.py` | Single-command CLI (`inventory`, `pull`, `extract`, `export`, `run`, `benchmark`, `validate`). |

## Quick Start

Requires Python 3 (stdlib only — no `.venv` needed), `ffmpeg`/`ffprobe`, and `.env` keys (`JELLYFIN_URL`, `JELLYFIN_TOKEN`, `JELLYFIN_USER_ID`, `GEMINI_API_KEY`, optional `SUBDL_API_KEY`).

```sh
# 1. Inspect Jellyfin library
python3 -m pipeline.cli inventory --search "Star Wars"

# 2. End-to-end: Jellyfin movie -> center-channel audio + SRT -> multimodal attribution -> validated Scriptle JSON
python3 -m pipeline.cli run --search "The Empire Strikes Back" --out-dir data/exports

# 3. Run on an already-pulled local media directory
python3 -m pipeline.cli run \
  --media-dir data/media/star-wars-1977 \
  --srt data/subs/anh/anh-sdh.srt \
  --script-id star-wars-episode-iv-a-new-hope \
  --out-dir data/exports

# 4. Run zero-leakage multimodal benchmark (SDH labels strictly stripped)
python3 -m pipeline.cli benchmark \
  --srt data/subs/anh/anh-sdh.srt \
  --meta data/media/star-wars-1977/meta.json \
  --audio data/media/star-wars-1977/center.flac \
  --reference data/scripts/anh-screenplay-canon.json \
  --models gemini-3.8-flash,gemini-3.1-pro-preview \
  --arms text,audio \
  --out data/evidence/benchmark-star-wars-1977.json

# 5. Validate any candidate Scriptle script JSON
python3 -m pipeline.cli validate data/exports/star-wars-episode-iv-a-new-hope.json
```

## Tests

```sh
python3 -m unittest discover -s pipeline/tests -v
python3 -m unittest discover -s scripts/tests -v
```
