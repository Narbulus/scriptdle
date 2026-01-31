"""
Output Schema for Scriptdle Game Format

Defines the flat dialogue list format required by the Scriptdle game.
Uses Pydantic for validation and serialization.
"""

from pydantic import BaseModel, Field
from typing import Optional


class DialogueLine(BaseModel):
    """A single line of dialogue."""
    character: str
    text: str


class Scriptdle(BaseModel):
    """
    Scriptdle game format - flat list of dialogue lines.

    This format is used by the Scriptdle guessing game where players
    identify the movie and character from dialogue snippets.
    """
    id: str = ""  # Movie identifier slug (e.g., "lotr-fotr")
    title: str = ""
    year: Optional[int] = None
    characters: list[str] = Field(default_factory=list)
    lines: list[DialogueLine] = Field(default_factory=list)

    @property
    def line_count(self) -> int:
        """Total number of dialogue lines."""
        return len(self.lines)

    @property
    def character_count(self) -> int:
        """Total number of unique characters."""
        return len(self.characters)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return self.model_dump()

    @classmethod
    def from_dict(cls, data: dict) -> "Scriptdle":
        """Create from dictionary."""
        return cls.model_validate(data)
