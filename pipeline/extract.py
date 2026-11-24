"""
Multimodal high-precision speaker attribution for Scriptle.

Replaces the old 25-module pyannote/Whisper/manual-review pipeline with a clean,
zero-dependency scene-window extractor powered by modern Gemini multimodal models
(gemini-3.8-flash / gemini-3.1-pro-preview / gemini-2.5-pro / gemini-2.5-flash).

Key design principles:
1. Scene-aligned windows (~6-7 min, split on natural silence gaps) with read-only
   preceding context so the model always tracks who is in the room.
2. Native multimodal scene audio (`center.flac` sliced to lightweight 24kbps MP3)
   or optional low-res video (`240p 1fps MP4`), so off-screen, masked, droid, and
   radio voices are heard directly rather than guessed from isolated text.
3. Calibrated per-line confidence (`0.00-1.00`) + explicit `"OTHER"` bucket for
   unnamed background extras, enabling high-precision filtering (95-99%+ tier)
   for Scriptle's 3-line dialogue windows.
4. Per-chunk disk caching & resumability + full token/latency/cost accounting.
"""

import base64
import concurrent.futures
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from pipeline import srt
from pipeline.jellyfin import load_env

DEFAULT_MODEL = "google/gemini-2.5-flash"
DEFAULT_VERIFY_MODEL = "google/gemini-2.5-pro"
DEFAULT_WINDOW_SECONDS = 420.0  # ~7 minutes per scene window
DEFAULT_MAX_CUES = 110
DEFAULT_CONTEXT_CUES = 15
SLICE_PAD_SECONDS = 2.0

# Approximate USD per 1M tokens (input_text_or_video, input_audio, output).
# Used when the API does not return exact USD cost (OpenRouter reports exact cost).
MODEL_PRICING_PER_M: Dict[str, Tuple[float, float, float]] = {
    "gemini-3.8-flash": (0.30, 1.00, 2.50),
    "gemini-3.7-flash": (0.30, 1.00, 2.50),
    "gemini-3.6-flash": (0.30, 1.00, 2.50),
    "gemini-2.5-flash": (0.30, 1.00, 2.50),
    "gemini-2.5-flash-lite": (0.10, 0.30, 0.40),
    "gemini-3.1-pro-preview": (1.25, 2.50, 10.00),
    "gemini-2.5-pro": (1.25, 2.50, 10.00),
}


def safe_model_slug(model: str) -> str:
    """Turn a model ID (including OpenRouter provider/model slugs) into a safe filename token."""
    return re.sub(r"[^a-zA-Z0-9._-]+", "__", model.strip()).strip("_") or "model"


class GeminiError(RuntimeError):
    """Base error for Gemini API calls."""


class BillingError(GeminiError):
    """HTTP 402: API prepayment credits depleted or billing disabled."""


class RateLimitError(GeminiError):
    """HTTP 429/503 retries exhausted."""


@dataclass
class SceneWindow:
    window_index: int
    cues: List[srt.Cue]
    context_cues: List[srt.Cue]
    start: float
    end: float


@dataclass
class UsageStats:
    prompt_tokens: int = 0
    output_tokens: int = 0
    thought_tokens: int = 0
    audio_seconds: float = 0.0
    video_seconds: float = 0.0
    api_calls: int = 0
    cache_hits: int = 0
    elapsed_seconds: float = 0.0
    reported_cost_usd: float = 0.0

    def add(self, other: "UsageStats") -> None:
        self.prompt_tokens += other.prompt_tokens
        self.output_tokens += other.output_tokens
        self.thought_tokens += other.thought_tokens
        self.audio_seconds += other.audio_seconds
        self.video_seconds += other.video_seconds
        self.api_calls += other.api_calls
        self.cache_hits += other.cache_hits
        self.reported_cost_usd += other.reported_cost_usd

    def to_dict(self, model: str) -> dict:
        cost = self.reported_cost_usd if self.reported_cost_usd > 0 else estimate_cost_usd(model, self)
        return {
            "model": model,
            "promptTokens": self.prompt_tokens,
            "outputTokens": self.output_tokens,
            "thoughtTokens": self.thought_tokens,
            "audioSeconds": round(self.audio_seconds, 1),
            "videoSeconds": round(self.video_seconds, 1),
            "apiCalls": self.api_calls,
            "cacheHits": self.cache_hits,
            "elapsedSeconds": round(self.elapsed_seconds, 2),
            "estimatedCostUsd": round(cost, 4),
        }


def estimate_cost_usd(model: str, usage: UsageStats) -> float:
    """Estimate USD cost for a run using token counts + audio modality share."""
    base_model = model.split("/", 1)[-1]
    text_in, audio_in, out_rate = MODEL_PRICING_PER_M.get(base_model, (0.30, 1.00, 2.50))
    # Gemini encodes audio at ~32 tokens/sec; charge audio tokens at audio rate.
    est_audio_tokens = min(usage.prompt_tokens, int(usage.audio_seconds * 32))
    est_other_tokens = max(0, usage.prompt_tokens - est_audio_tokens)
    total_out = usage.output_tokens + usage.thought_tokens
    return (
        (est_other_tokens / 1_000_000) * text_in
        + (est_audio_tokens / 1_000_000) * audio_in
        + (total_out / 1_000_000) * out_rate
    )


def build_scene_windows(
    cues: Sequence[srt.Cue],
    target_seconds: float = DEFAULT_WINDOW_SECONDS,
    max_cues: int = DEFAULT_MAX_CUES,
    context_cues: int = DEFAULT_CONTEXT_CUES,
) -> List[SceneWindow]:
    """Partition dialogue cues into scene-aligned windows split at silence gaps.

    Rather than cutting rigidly at fixed cue counts or 5-second micro-blocks,
    each window searches for the largest natural inter-cue pause between 65%
    and 100% of the target window budget so conversations stay intact.
    """
    if not cues:
        return []

    windows: List[SceneWindow] = []
    n = len(cues)
    start_idx = 0

    while start_idx < n:
        win_start_time = cues[start_idx].start
        # Find the furthest cue still within target_seconds and max_cues.
        limit_idx = start_idx + 1
        while (
            limit_idx < n
            and (limit_idx - start_idx) < max_cues
            and (cues[limit_idx].end - win_start_time) <= target_seconds
        ):
            limit_idx += 1

        if limit_idx >= n:
            end_idx = n
        else:
            # Look back across the last 35% of the window for the largest silence gap.
            search_from = start_idx + max(1, int((limit_idx - start_idx) * 0.65))
            best_split = limit_idx
            best_gap = -1.0
            for i in range(search_from, limit_idx):
                gap = cues[i].start - cues[i - 1].end
                if gap > best_gap:
                    best_gap = gap
                    best_split = i
            end_idx = best_split

        win_cues = list(cues[start_idx:end_idx])
        ctx_start = max(0, start_idx - context_cues)
        ctx_cues = list(cues[ctx_start:start_idx])
        windows.append(SceneWindow(
            window_index=len(windows),
            cues=win_cues,
            context_cues=ctx_cues,
            start=max(0.0, win_cues[0].start - SLICE_PAD_SECONDS),
            end=win_cues[-1].end + SLICE_PAD_SECONDS,
        ))
        start_idx = end_idx

    return windows


def slice_audio_mp3(audio_path: Path, start: float, end: float, dest: Optional[Path] = None) -> bytes:
    """Slice a scene window into compact 16kHz 24kbps mono MP3.

    When `dest` is None, streams directly through stdout into memory so zero
    slice files accumulate on disk. When `audio_path` is already MP3, uses
    instant stream-copy (`-c:a copy`).
    """
    codec_args = (
        ["-c:a", "copy"]
        if audio_path.suffix.lower() == ".mp3"
        else ["-ac", "1", "-ar", "16000", "-b:a", "24k"]
    )
    if dest is None:
        proc = subprocess.run(
            [
                "ffmpeg", "-v", "error",
                "-ss", f"{max(0.0, start):.2f}",
                "-to", f"{end:.2f}",
                "-i", str(audio_path),
                *codec_args,
                "-f", "mp3", "pipe:1",
            ],
            capture_output=True,
            check=True,
        )
        return proc.stdout

    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-ss", f"{max(0.0, start):.2f}",
                "-to", f"{end:.2f}",
                "-i", str(audio_path),
                *codec_args,
                str(dest),
            ],
            check=True,
        )
    return dest.read_bytes()


def slice_video_mp4(video_path: Path, start: float, end: float, dest: Path) -> bytes:
    """Slice a scene window into compact 240p 1fps + 24kbps mono audio MP4."""
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-ss", f"{max(0.0, start):.2f}",
                "-to", f"{end:.2f}",
                "-i", str(video_path),
                "-vf", "scale=-2:240,fps=1",
                "-c:v", "libx264", "-crf", "30", "-preset", "ultrafast",
                "-ac", "1", "-ar", "16000", "-b:a", "24k",
                "-movflags", "+faststart",
                str(dest),
            ],
            check=True,
        )
    return dest.read_bytes()


def format_cast_roster(meta: dict) -> str:
    """Format Jellyfin cast metadata into a compact character roster prompt block."""
    cast = meta.get("cast") or []
    if cast:
        lines = []
        for entry in cast[:30]:
            canon = entry.get("canonical") or str(entry.get("role", "")).upper()
            actor = entry.get("actor") or ""
            if actor:
                lines.append(f"- {canon} (played by {actor})")
            else:
                lines.append(f"- {canon}")
        return "\n".join(lines)
    chars = meta.get("characters") or []
    if chars:
        return "\n".join(f"- {c}" for c in chars[:40])
    return "- (Infer canonical character names from the film)"


def build_attribution_prompt(
    window: SceneWindow,
    meta: dict,
    mode: str,
    strip_sdh: bool = False,
) -> str:
    """Build the calibrated scene-window speaker attribution prompt."""
    title = meta.get("title") or "Unknown Film"
    year = meta.get("year") or ""
    overview = (meta.get("overview") or "").strip()
    roster = format_cast_roster(meta)

    modality_instruction = {
        "text": (
            "You are reading timestamped subtitles for one continuous scene. "
            "Use dialogue flow, direct address, plot context, and character voice/personality."
        ),
        "audio": (
            "The attached audio clip is the center-channel dialogue track covering "
            f"{window.start:.1f}s to {window.end:.1f}s of the film (clip t=0.0s corresponds "
            f"to film {window.start:.1f}s). LISTEN CAREFULLY to each speaker's actual voice "
            "(pitch, accent, cadence, gender, timbre, droid/helmet/radio filters, off-screen speech) "
            "and cross-reference with the timestamps and cast roster."
        ),
        "video": (
            "The attached low-fps video+audio clip covers "
            f"{window.start:.1f}s to {window.end:.1f}s of the film (clip t=0.0s corresponds "
            f"to film {window.start:.1f}s). Use BOTH who is visible speaking on screen AND "
            "the audio voice characteristics (especially for off-screen/radio/masked dialogue)."
        ),
    }[mode]

    ctx_block = ""
    if window.context_cues:
        ctx_lines = []
        for c in window.context_cues:
            sdh = f" [SDH={c.speaker_label}]" if (not strip_sdh and c.speaker_label) else ""
            ctx_lines.append(f"  ({c.start:.1f}s){sdh} {c.text}")
        ctx_block = (
            "\nPreceding dialogue (READ-ONLY context, DO NOT output attributions for these):\n"
            + "\n".join(ctx_lines)
            + "\n"
        )

    cue_lines = []
    for c in window.cues:
        rel_t = max(0.0, c.start - window.start)
        time_tag = f"{c.start:.1f}s / clip {rel_t:.1f}s" if mode != "text" else f"{c.start:.1f}s"
        sdh = f" [SDH={c.speaker_label}]" if (not strip_sdh and c.speaker_label) else ""
        cue_lines.append(f"{c.index}. ({time_tag}){sdh} {c.text}")

    sdh_rule = (
        ""
        if strip_sdh
        else "- When a line carries an [SDH=...] tag from closed captions, treat it as a strong hint unless the audio/context clearly contradicts it, and normalize it to the canonical roster name.\n"
    )

    overview_line = f"Synopsis: {overview}\n" if overview else ""

    return f"""You are a precision film dialogue attribution system for a movie-quote guessing game.

Film: {title} ({year})
{overview_line}
Canonical character roster (prefer these exact ALL-CAPS names):
{roster}

Modality guidance:
{modality_instruction}
{ctx_block}
Lines to attribute (output EXACTLY one JSON object per line ID below):
{chr(10).join(cue_lines)}

Rules:
1. Use the exact canonical ALL-CAPS character name from the roster above (or a clear canonical name for a named recurring character not listed).
2. For clearly identifiable unnamed speaking roles (e.g. "STORMTROOPER", "IMPERIAL OFFICER", "REBEL PILOT", "GUARD", "BARTENDER", "POLICE OFFICER", "ANNOUNCER"), use a concise ALL-CAPS generic role label so conversational context stays intact. Reserve "OTHER" for crowds, overlapping chatter, or completely unidentifiable voices.
{sdh_rule}3. Calibrate "conf" (0.00 to 1.00) HONESTLY — precision matters far more than recall:
   - 0.95-1.00: Unmistakable (distinct voice/visual AND unambiguous conversational context).
   - 0.85-0.94: High confidence (very likely right, minor ambiguity).
   - 0.65-0.84: Moderate confidence (educated guess).
   - <0.65: Uncertain (multiple plausible speakers).
4. Set "clean": false ONLY if the line is non-dialogue (song lyrics, sound effect, opening/closing text, unreadable gibberish); otherwise true.

Respond with JSON ONLY matching this exact schema:
{{"attributions": [{{"id": <int>, "speaker": "<ALL CAPS NAME or OTHER>", "conf": <float 0-1>, "clean": <bool>}}]}}
"""


def build_verification_prompt(
    suspect_cues: Sequence[dict],
    window: SceneWindow,
    meta: dict,
    mode: str,
) -> str:
    """Build a focused verification prompt for uncertain/high-stakes target lines."""
    title = meta.get("title") or "Unknown Film"
    year = meta.get("year") or ""
    roster = format_cast_roster(meta)

    items = []
    for item in suspect_cues:
        rel_t = max(0.0, item["start"] - window.start)
        time_tag = f"{item['start']:.1f}s / clip {rel_t:.1f}s" if mode != "text" else f"{item['start']:.1f}s"
        items.append(
            f"{item['id']}. ({time_tag}) [DRAFT={item['speaker']}, conf={item['conf']:.2f}] {item['text']}"
        )

    return f"""You are a strict QA verifier auditing draft speaker attributions for {title} ({year}).
Only confirm a speaker with conf >= 0.95 if you are certain. Correct any misattributed line, or lower conf if genuinely ambiguous.

Canonical roster:
{roster}

Lines to verify:
{chr(10).join(items)}

Respond with JSON ONLY:
{{"attributions": [{{"id": <int>, "speaker": "<ALL CAPS NAME or OTHER>", "conf": <float 0-1>, "clean": <bool>}}]}}
"""


def parse_attributions_json(raw_text: str) -> Dict[int, dict]:
    """Parse LLM JSON response defensively, tolerating fenced markdown blocks or minor syntax glitches."""
    text = (raw_text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        payload = json.loads(text)
        rows = payload.get("attributions", []) if isinstance(payload, dict) else payload
    except json.JSONDecodeError:
        # Salvage complete individual attribution objects if a single line had a syntax glitch
        rows = []
        for m in re.finditer(r"\{[^{}]*\"id\"\s*:\s*\d+[^{}]*\}", text):
            try:
                rows.append(json.loads(m.group(0)))
            except json.JSONDecodeError:
                continue
        if not rows:
            raise
    out: Dict[int, dict] = {}
    for row in rows:
        if not isinstance(row, dict) or "id" not in row or "speaker" not in row:
            continue
        try:
            cid = int(row["id"])
        except (TypeError, ValueError):
            continue
        speaker = re.sub(r"\s+", " ", str(row["speaker"]).strip().upper())
        try:
            conf = max(0.0, min(1.0, float(row.get("conf", 0.5))))
        except (TypeError, ValueError):
            conf = 0.5
        clean = bool(row.get("clean", True))
        out[cid] = {"id": cid, "speaker": speaker or "OTHER", "conf": round(conf, 3), "clean": clean}
    return out


class GeminiClient:
    """Zero-dependency stdlib REST client for Gemini generateContent."""

    def __init__(
        self,
        api_key: str,
        timeout: int = 240,
        max_retries: int = 4,
        transport: Optional[Callable[[str, dict], dict]] = None,
    ):
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self._transport = transport

    @classmethod
    def from_env(cls, env_path: Optional[Path] = None, **kwargs) -> "GeminiClient":
        env = load_env(env_path)
        api_key = env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GEMINI_API_KEY in .env or environment")
        return cls(api_key=api_key, **kwargs)

    def generate_json(
        self,
        model: str,
        parts: List[dict],
        temperature: float = 0.0,
    ) -> Tuple[str, dict]:
        """Invoke generateContent and return (response_text, usageMetadata)."""
        # Strip provider prefix if someone passes google/gemini-... to direct Gemini API
        direct_model = model.split("/", 1)[-1] if model.startswith("google/") else model
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{direct_model}:generateContent?key={self.api_key}"
        )
        body = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": temperature,
            },
        }

        for attempt in range(1, self.max_retries + 1):
            try:
                if self._transport is not None:
                    data = self._transport(model, body)
                else:
                    req = urllib.request.Request(
                        url,
                        data=json.dumps(body).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                    )
                    with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                        data = json.loads(resp.read())
            except urllib.error.HTTPError as err:
                msg = err.read().decode(errors="replace")
                err.close()
                if err.code == 402:
                    raise BillingError(
                        f"Gemini HTTP 402 (credits depleted / billing paused): {msg[:240]}"
                    ) from err
                if err.code in (429, 500, 503):
                    if attempt == self.max_retries:
                        raise RateLimitError(
                            f"Gemini HTTP {err.code} after {self.max_retries} attempts: {msg[:200]}"
                        ) from err
                    delay_match = re.search(r"retry in ([\d.]+)s", msg, re.IGNORECASE)
                    wait_s = float(delay_match.group(1)) + 2.0 if delay_match else 10.0 * attempt
                    time.sleep(wait_s)
                    continue
                raise GeminiError(f"Gemini HTTP {err.code}: {msg[:240]}") from err
            except (urllib.error.URLError, TimeoutError) as err:
                if attempt == self.max_retries:
                    raise GeminiError(f"Network error after {self.max_retries} attempts: {err}") from err
                time.sleep(5.0 * attempt)
                continue

            cand = (data.get("candidates") or [{}])[0]
            text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
            usage = data.get("usageMetadata") or {}
            return text, usage

        raise GeminiError("Unreachable retry exit")


def _parts_to_openrouter_content(parts: List[dict]) -> List[dict]:
    """Convert Gemini-style parts (text / inlineData audio or video) to OpenRouter content blocks."""
    content: List[dict] = []
    for part in parts:
        if "text" in part:
            content.append({"type": "text", "text": part["text"]})
        elif "inlineData" in part:
            inline = part["inlineData"]
            mime = (inline.get("mimeType") or "").lower()
            b64 = inline.get("data") or ""
            if mime.startswith("audio/"):
                fmt = "mp3" if "mpeg" in mime or "mp3" in mime else mime.split("/", 1)[-1]
                content.append({
                    "type": "input_audio",
                    "input_audio": {"data": b64, "format": fmt},
                })
            elif mime.startswith("video/"):
                content.append({
                    "type": "video_url",
                    "video_url": {"url": f"data:{mime};base64,{b64}"},
                })
            elif mime.startswith("image/"):
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{b64}"},
                })
            else:
                raise ValueError(f"Unsupported inlineData mimeType for OpenRouter: {mime}")
    return content


def normalize_openrouter_model(model: str) -> str:
    """Ensure bare Gemini model names carry the google/ OpenRouter prefix."""
    m = model.strip()
    if "/" in m:
        return m
    if m.startswith("gemini-") or m.startswith("gemma-"):
        return f"google/{m}"
    return m


class OpenRouterClient:
    """Zero-dependency stdlib REST client for OpenRouter chat/completions (text + audio + video)."""

    API_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(
        self,
        api_key: str,
        timeout: int = 240,
        max_retries: int = 4,
        transport: Optional[Callable[[str, dict], dict]] = None,
    ):
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self._transport = transport

    @classmethod
    def from_env(cls, env_path: Optional[Path] = None, **kwargs) -> "OpenRouterClient":
        env = load_env(env_path)
        api_key = env.get("OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("Missing OPENROUTER_API_KEY in .env or environment")
        return cls(api_key=api_key, **kwargs)

    def generate_json(
        self,
        model: str,
        parts: List[dict],
        temperature: float = 0.0,
    ) -> Tuple[str, dict]:
        """Invoke OpenRouter chat/completions and return (response_text, normalized_usage)."""
        or_model = normalize_openrouter_model(model)
        body = {
            "model": or_model,
            "messages": [{"role": "user", "content": _parts_to_openrouter_content(parts)}],
            "temperature": temperature,
            "max_tokens": 16000,
            "response_format": {"type": "json_object"},
        }

        for attempt in range(1, self.max_retries + 1):
            try:
                if self._transport is not None:
                    data = self._transport(or_model, body)
                else:
                    req = urllib.request.Request(
                        self.API_URL,
                        data=json.dumps(body).encode("utf-8"),
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://scriptle.net",
                            "X-Title": "Scriptle Pipeline",
                        },
                    )
                    with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                        data = json.loads(resp.read())
            except urllib.error.HTTPError as err:
                msg = err.read().decode(errors="replace")
                err.close()
                if err.code == 402:
                    if "in_flight_budget_exhausted" in msg and attempt < self.max_retries:
                        time.sleep(6.0 * attempt)
                        continue
                    raise BillingError(
                        f"OpenRouter HTTP 402 (insufficient credits): {msg[:240]}"
                    ) from err
                if err.code in (429, 500, 502, 503):
                    if attempt == self.max_retries:
                        raise RateLimitError(
                            f"OpenRouter HTTP {err.code} after {self.max_retries} attempts: {msg[:200]}"
                        ) from err
                    time.sleep(8.0 * attempt)
                    continue
                raise GeminiError(f"OpenRouter HTTP {err.code}: {msg[:240]}") from err
            except (urllib.error.URLError, TimeoutError) as err:
                if attempt == self.max_retries:
                    raise GeminiError(f"Network error after {self.max_retries} attempts: {err}") from err
                time.sleep(5.0 * attempt)
                continue

            if "error" in data and not data.get("choices"):
                err_info = data["error"]
                code = err_info.get("code") if isinstance(err_info, dict) else None
                if code == 402:
                    raise BillingError(f"OpenRouter 402: {err_info}")
                raise GeminiError(f"OpenRouter error: {err_info}")

            msg_obj = ((data.get("choices") or [{}])[0]).get("message") or {}
            content = msg_obj.get("content") or ""
            if isinstance(content, list):
                text = "".join(
                    block.get("text", "") for block in content if isinstance(block, dict)
                )
            else:
                text = str(content)

            raw_usage = data.get("usage") or {}
            details = raw_usage.get("completion_tokens_details") or {}
            usage = {
                "promptTokenCount": int(raw_usage.get("prompt_tokens") or 0),
                "candidatesTokenCount": int(raw_usage.get("completion_tokens") or 0),
                "thoughtsTokenCount": int(details.get("reasoning_tokens") or 0),
                "costUsd": float(raw_usage.get("cost") or 0.0),
            }
            return text, usage

        raise GeminiError("Unreachable retry exit")


def create_client(
    provider: str = "auto",
    env_path: Optional[Path] = None,
    **kwargs,
):
    """Build either OpenRouterClient or GeminiClient based on provider or available keys."""
    if provider == "openrouter":
        return OpenRouterClient.from_env(env_path=env_path, **kwargs)
    if provider == "gemini":
        return GeminiClient.from_env(env_path=env_path, **kwargs)
    if provider != "auto":
        raise ValueError(f"Unsupported provider: {provider}")

    env = load_env(env_path)
    if env.get("OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY"):
        return OpenRouterClient.from_env(env_path=env_path, **kwargs)
    if env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY"):
        return GeminiClient.from_env(env_path=env_path, **kwargs)
    raise RuntimeError(
        "Missing API key: set OPENROUTER_API_KEY (recommended) or GEMINI_API_KEY in .env"
    )


def extract_film(
    cues: Sequence[srt.Cue],
    meta: dict,
    client: GeminiClient,
    model: str = DEFAULT_MODEL,
    mode: str = "audio",
    audio_path: Optional[Path] = None,
    video_path: Optional[Path] = None,
    cache_dir: Optional[Path] = None,
    strip_sdh: bool = False,
    window_seconds: float = DEFAULT_WINDOW_SECONDS,
    max_cues: int = DEFAULT_MAX_CUES,
    context_cues: int = DEFAULT_CONTEXT_CUES,
    workers: int = 4,
    verify: bool = False,
    verify_model: str = DEFAULT_VERIFY_MODEL,
    window_limit: Optional[int] = None,
) -> dict:
    """Run scene-window attribution across a film and return rich per-cue results."""
    if mode not in ("text", "audio", "video"):
        raise ValueError(f"Unsupported mode: {mode}")
    if mode == "audio" and (not audio_path or not audio_path.exists()):
        raise FileNotFoundError(f"Audio mode requires existing audio_path, got: {audio_path}")
    if mode == "video" and (not video_path or not video_path.exists()):
        raise FileNotFoundError(f"Video mode requires existing video_path, got: {video_path}")

    windows = build_scene_windows(
        cues,
        target_seconds=window_seconds,
        max_cues=max_cues,
        context_cues=context_cues,
    )
    if window_limit is not None:
        windows = windows[:window_limit]

    started = time.time()
    total_usage = UsageStats()

    def process_window(win: SceneWindow) -> Tuple[int, Dict[int, dict], UsageStats]:
        w_usage = UsageStats()
        cache_file = (
            cache_dir / f"win_{win.window_index:03d}.json"
            if cache_dir is not None
            else None
        )
        if cache_file and cache_file.exists():
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            w_usage.cache_hits = 1
            return win.window_index, {int(k): v for k, v in cached["attributions"].items()}, w_usage

        parts: List[dict] = []
        slice_dur = max(0.0, win.end - win.start)
        if mode == "audio":
            assert audio_path is not None
            raw = slice_audio_mp3(audio_path, win.start, win.end, dest=None)
            parts.append({"inlineData": {"mimeType": "audio/mpeg", "data": base64.b64encode(raw).decode()}})
            w_usage.audio_seconds += slice_dur
        elif mode == "video":
            assert video_path is not None
            slice_path = (cache_dir or video_path.parent / "slices") / f"win_{win.window_index:03d}.mp4"
            raw = slice_video_mp4(video_path, win.start, win.end, slice_path)
            parts.append({"inlineData": {"mimeType": "video/mp4", "data": base64.b64encode(raw).decode()}})
            w_usage.video_seconds += slice_dur
            w_usage.audio_seconds += slice_dur

        prompt = build_attribution_prompt(win, meta, mode=mode, strip_sdh=strip_sdh)
        parts.append({"text": prompt})

        parsed = {}
        usage = {}
        for parse_attempt in range(1, 3):
            text, usage = client.generate_json(
                model=model,
                parts=parts,
                temperature=0.0 if parse_attempt == 1 else 0.2,
            )
            w_usage.prompt_tokens += int(usage.get("promptTokenCount") or 0)
            w_usage.output_tokens += int(usage.get("candidatesTokenCount") or 0)
            w_usage.thought_tokens += int(usage.get("thoughtsTokenCount") or 0)
            w_usage.reported_cost_usd += float(usage.get("costUsd") or 0.0)
            w_usage.api_calls += 1
            try:
                parsed = parse_attributions_json(text)
                break
            except json.JSONDecodeError:
                if parse_attempt == 2:
                    raise

        if verify:
            suspects = [
                {
                    "id": c.index,
                    "start": c.start,
                    "text": c.text,
                    "speaker": parsed.get(c.index, {}).get("speaker", "OTHER"),
                    "conf": parsed.get(c.index, {}).get("conf", 0.0),
                }
                for c in win.cues
                if 0.60 <= parsed.get(c.index, {}).get("conf", 0.0) < 0.94
                and len(c.text.split()) >= 5
            ]
            if suspects:
                v_parts = list(parts[:-1])
                v_parts.append({"text": build_verification_prompt(suspects, win, meta, mode)})
                v_text, v_usage = client.generate_json(model=verify_model, parts=v_parts)
                v_parsed = parse_attributions_json(v_text)
                w_usage.prompt_tokens += int(v_usage.get("promptTokenCount") or 0)
                w_usage.output_tokens += int(v_usage.get("candidatesTokenCount") or 0)
                w_usage.thought_tokens += int(v_usage.get("thoughtsTokenCount") or 0)
                w_usage.reported_cost_usd += float(v_usage.get("costUsd") or 0.0)
                w_usage.api_calls += 1
                for cid, v_item in v_parsed.items():
                    orig = parsed.get(cid)
                    if orig and orig["speaker"] == v_item["speaker"]:
                        # Independent agreement boosts confidence
                        v_item["conf"] = round(min(0.99, max(orig["conf"], v_item["conf"]) + 0.04), 3)
                    parsed[cid] = v_item

        if cache_file:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(
                json.dumps({"window": win.window_index, "attributions": parsed, "usage": usage}, indent=1),
                encoding="utf-8",
            )
        return win.window_index, parsed, w_usage

    all_preds: Dict[int, dict] = {}
    max_workers = max(1, min(workers, len(windows)))
    if max_workers == 1:
        for win in windows:
            _, preds, wu = process_window(win)
            all_preds.update(preds)
            total_usage.add(wu)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = [pool.submit(process_window, w) for w in windows]
            for fut in concurrent.futures.as_completed(futures):
                _, preds, wu = fut.result()
                all_preds.update(preds)
                total_usage.add(wu)

    total_usage.elapsed_seconds = time.time() - started

    target_cues = [c for w in windows for c in w.cues]
    items = []
    for cue in target_cues:
        pred = all_preds.get(cue.index) or {"speaker": "OTHER", "conf": 0.0, "clean": True}
        items.append({
            "id": cue.index,
            "start": round(cue.start, 3),
            "end": round(cue.end, 3),
            "text": cue.text,
            "speaker": pred["speaker"],
            "conf": pred["conf"],
            "clean": pred.get("clean", True),
            "sdhLabel": cue.speaker_label,
        })

    return {
        "meta": meta,
        "config": {
            "model": model,
            "mode": mode,
            "stripSdh": strip_sdh,
            "verify": verify,
            "verifyModel": verify_model if verify else None,
            "windows": len(windows),
        },
        "usage": total_usage.to_dict(model),
        "items": items,
    }
