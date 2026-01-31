import os
import logging
import time
from typing import Optional

from google import genai
from google.genai import types
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
INITIAL_BACKOFF = 60
MAX_BACKOFF = 300

load_dotenv()


class GeminiClient:

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-2.0-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment")

        self.client = genai.Client(api_key=self.api_key)
        self.model_name = model_name

    def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        max_tokens: int = 8192,
        temperature: float = 0.1
    ) -> str:
        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
            system_instruction=system_instruction,
        )

        backoff = INITIAL_BACKOFF
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=config,
                )
                return response.text

            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "Resource exhausted" in error_str:
                    if attempt < MAX_RETRIES - 1:
                        logger.warning(f"Rate limited, waiting {backoff}s (attempt {attempt + 1}/{MAX_RETRIES})")
                        time.sleep(backoff)
                        backoff = min(backoff * 2, MAX_BACKOFF)
                        continue
                logger.error(f"Gemini API error: {e}")
                raise

    def generate_with_image(
        self,
        prompt: str,
        image_data: bytes,
        mime_type: str = "application/pdf",
        system_instruction: Optional[str] = None,
        max_tokens: int = 8192,
        temperature: float = 0.1
    ) -> str:
        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
            system_instruction=system_instruction,
        )

        contents = [
            types.Part.from_bytes(data=image_data, mime_type=mime_type),
            prompt,
        ]

        backoff = INITIAL_BACKOFF
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )
                return response.text

            except Exception as e:
                error_str = str(e)
                if "429" in error_str or "Resource exhausted" in error_str:
                    if attempt < MAX_RETRIES - 1:
                        logger.warning(f"Rate limited, waiting {backoff}s (attempt {attempt + 1}/{MAX_RETRIES})")
                        time.sleep(backoff)
                        backoff = min(backoff * 2, MAX_BACKOFF)
                        continue
                logger.error(f"Gemini API error (multimodal): {e}")
                raise


SCRIPTDLE_SYSTEM_PROMPT = """You are an expert screenplay parser. Extract all dialogue as a flat list for the Scriptdle game format.

You must output valid JSON that follows this exact schema:

{
  "title": "string (movie/show title)",
  "lines": [
    {"character": "CHARACTER_1", "text": "dialogue text"},
    {"character": "CHARACTER_2", "text": "dialogue text"},
    ...
  ]
}

Rules:
- Extract ONLY dialogue lines, not action descriptions, scene headings, or transitions
- Normalize character names (e.g., "JOHN (CONT'D)" becomes "JOHN", "JOHN (V.O.)" becomes "JOHN")
- Character names should be UPPERCASE
- Keep dialogue together even if split across lines
- Preserve the exact order of dialogue as it appears in the text
- Only output the JSON, nothing else"""

PARSE_CHUNK_PROMPT = """Parse this screenplay/transcript chunk and extract all dialogue lines.

Output valid JSON following the schema provided.

Text:
```
{text}
```

JSON output:"""

PARSE_CONTINUE_PROMPT = """Continue parsing this screenplay/transcript chunk. This continues from the previous chunk.

Text:
```
{text}
```

JSON output:"""
