#!/usr/bin/env python3
"""
Script Parser - Main Entry Point

Parse movie/TV screenplays into scriptdle format using LLM-based parsers.

Usage:
    # Parse a PDF transcript
    python parser/main.py parse transcript.pdf --movie-id lotr-fotr --year 2001

    # Parse text file
    python parser/main.py parse script.txt --title "Example Movie" --year 2024

    # Parse from URL (e.g., Fandom wiki transcript)
    python parser/main.py parse-url "https://movies.fandom.com/wiki/Shrek/Transcript" --movie-id shrek-1 --year 2001

    # Download scripts from IMSDb
    python parser/main.py download --limit 10
"""

import argparse
import json
import logging
import sys
from pathlib import Path

from src.parsers import parse_text_llm, parse_transcript_llm, parse_transcript_pdf, parse_transcript_url
from src.extractors import extract_simple
from src.scrapers.imsdb import IMSDbScraper


def setup_logging(verbose: bool = False):
    """Setup logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )


def cmd_parse(args):
    """Parse a screenplay or transcript file."""
    path = Path(args.file)
    if not path.exists():
        print(f"Error: File not found: {path}", file=sys.stderr)
        sys.exit(1)

    movie_id = args.movie_id or ""
    title = args.title or None
    year = args.year

    if path.suffix.lower() == ".pdf":
        result = parse_transcript_pdf(
            path,
            movie_id=movie_id,
            title=title,
            year=year,
            verbose=args.verbose
        )
    else:
        text = extract_simple(path)
        if not text:
            with open(path, 'r', encoding='utf-8') as f:
                text = f.read()
        
        if not text:
            print(f"Error: Failed to extract text from {path}", file=sys.stderr)
            sys.exit(1)

        result = parse_transcript_llm(
            text,
            source_file=str(path),
            movie_id=movie_id,
            title=title,
            year=year,
            verbose=args.verbose
        )

    if result:
        output = result.to_dict()
        if args.output:
            output_path = Path(args.output)
            output_path.write_text(json.dumps(output, indent=2))
            print(f"Saved to: {output_path}")
        else:
            print(json.dumps(output, indent=2))
    else:
        print("Error: Parsing failed", file=sys.stderr)
        sys.exit(1)


def cmd_parse_url(args):
    """Parse a transcript from a URL."""
    movie_id = args.movie_id or ""
    title = args.title or None
    year = args.year

    result = parse_transcript_url(
        url=args.url,
        movie_id=movie_id,
        title=title,
        year=year,
        verbose=args.verbose
    )

    if result:
        output = result.to_dict()
        if args.output:
            output_path = Path(args.output)
            output_path.write_text(json.dumps(output, indent=2))
            print(f"Saved to: {output_path}")
        else:
            print(json.dumps(output, indent=2))
    else:
        print("Error: Parsing failed", file=sys.stderr)
        sys.exit(1)


def cmd_download(args):
    """Download scripts from IMSDb."""
    scraper = IMSDbScraper()

    if args.title:
        path = scraper.scrape_by_title(args.title)
        if path:
            print(f"Downloaded: {path}")
        else:
            print(f"Script not found: {args.title}")
    else:
        paths = scraper.scrape_all(limit=args.limit)
        print(f"Downloaded {len(paths)} scripts")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Parse screenplays into scriptdle format"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    parse_parser = subparsers.add_parser("parse", help="Parse a screenplay/transcript file")
    parse_parser.add_argument("file", help="Path to screenplay file")
    parse_parser.add_argument("--movie-id", help="Movie identifier slug (e.g., 'lotr-fotr')")
    parse_parser.add_argument("--title", help="Movie title")
    parse_parser.add_argument("--year", type=int, help="Release year")
    parse_parser.add_argument("--output", "-o", help="Output file path")

    parse_url_parser = subparsers.add_parser("parse-url", help="Parse a transcript from a URL")
    parse_url_parser.add_argument("url", help="URL to transcript page (e.g., Fandom wiki)")
    parse_url_parser.add_argument("--movie-id", help="Movie identifier slug (e.g., 'shrek-1')")
    parse_url_parser.add_argument("--title", help="Movie title")
    parse_url_parser.add_argument("--year", type=int, help="Release year")
    parse_url_parser.add_argument("--output", "-o", help="Output file path")

    download_parser = subparsers.add_parser("download", help="Download scripts from IMSDb")
    download_parser.add_argument("--title", help="Download specific script by title")
    download_parser.add_argument("--limit", type=int, default=5, help="Max scripts to download")

    args = parser.parse_args()

    setup_logging(args.verbose)

    if args.command == "parse":
        cmd_parse(args)
    elif args.command == "parse-url":
        cmd_parse_url(args)
    elif args.command == "download":
        cmd_download(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
