"""
IMSDb Scraper - Downloads screenplays from imsdb.com

IMSDb provides free movie scripts in HTML format. This scraper:
1. Gets the list of all available scripts
2. Downloads individual scripts
3. Saves them as HTML files for later processing
"""

import os
import re
import time
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, quote

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://imsdb.com"
ALL_SCRIPTS_URL = f"{BASE_URL}/all-scripts.html"
SCRIPT_URL_TEMPLATE = f"{BASE_URL}/scripts/{{title}}.html"


class IMSDbScraper:
    """Scraper for downloading screenplays from IMSDb."""

    def __init__(self, output_dir: str = "data/scripts/imsdb", delay: float = 1.0):
        """
        Initialize the scraper.

        Args:
            output_dir: Directory to save downloaded scripts
            delay: Delay between requests in seconds (be nice to the server)
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })

    def get_all_script_links(self) -> list[dict]:
        """
        Get list of all available scripts from IMSDb.

        Returns:
            List of dicts with 'title' and 'url' keys
        """
        logger.info("Fetching list of all scripts from IMSDb...")
        response = self.session.get(ALL_SCRIPTS_URL)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        scripts = []

        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if "/Movie Scripts/" in href:
                title = link.get_text(strip=True)
                if title:
                    scripts.append({
                        "title": title,
                        "url": urljoin(BASE_URL, href)
                    })

        logger.info(f"Found {len(scripts)} scripts on IMSDb")
        return scripts

    def get_script_page(self, script_info: dict) -> Optional[str]:
        """
        Get the script page URL which contains link to actual script.

        Args:
            script_info: Dict with 'title' and 'url'

        Returns:
            URL to the actual script content, or None if not found
        """
        try:
            response = self.session.get(script_info["url"])
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            for link in soup.find_all("a", href=True):
                if "/scripts/" in link.get("href", "").lower():
                    return urljoin(BASE_URL, link["href"])

            return None
        except Exception as e:
            logger.error(f"Error getting script page for {script_info['title']}: {e}")
            return None

    def download_script(self, script_url: str, title: str) -> Optional[str]:
        """
        Download a script from IMSDb.

        Args:
            script_url: URL to the script page
            title: Title of the script

        Returns:
            The script content as HTML, or None if failed
        """
        try:
            response = self.session.get(script_url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            script_pre = soup.find("pre", class_="scrtext")
            if script_pre:
                return str(script_pre)

            script_td = soup.find("td", class_="scrtext")
            if script_td:
                return str(script_td)

            logger.warning(f"Could not find script content for {title}")
            return None

        except Exception as e:
            logger.error(f"Error downloading script {title}: {e}")
            return None

    def save_script(self, content: str, title: str) -> Path:
        """
        Save script content to a file.

        Args:
            content: HTML content of the script
            title: Title of the script

        Returns:
            Path to the saved file
        """
        safe_title = re.sub(r'[^\w\s-]', '', title).strip()
        safe_title = re.sub(r'[-\s]+', '-', safe_title)
        filename = f"{safe_title}.html"
        filepath = self.output_dir / filename

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

        logger.info(f"Saved script: {filepath}")
        return filepath

    def scrape_script(self, script_info: dict) -> Optional[Path]:
        """
        Scrape a single script from IMSDb.

        Args:
            script_info: Dict with 'title' and 'url'

        Returns:
            Path to saved file, or None if failed
        """
        title = script_info["title"]

        safe_title = re.sub(r'[^\w\s-]', '', title).strip()
        safe_title = re.sub(r'[-\s]+', '-', safe_title)
        filepath = self.output_dir / f"{safe_title}.html"
        if filepath.exists():
            logger.info(f"Script already exists: {title}")
            return filepath

        script_url = self.get_script_page(script_info)
        if not script_url:
            logger.warning(f"Could not find script URL for {title}")
            return None

        time.sleep(self.delay)

        content = self.download_script(script_url, title)
        if not content:
            return None

        return self.save_script(content, title)

    def scrape_all(self, limit: Optional[int] = None) -> list[Path]:
        """
        Scrape all scripts from IMSDb.

        Args:
            limit: Maximum number of scripts to download (None for all)

        Returns:
            List of paths to saved scripts
        """
        scripts = self.get_all_script_links()

        if limit:
            scripts = scripts[:limit]

        saved_paths = []
        for i, script_info in enumerate(scripts):
            logger.info(f"Processing {i+1}/{len(scripts)}: {script_info['title']}")

            path = self.scrape_script(script_info)
            if path:
                saved_paths.append(path)

            time.sleep(self.delay)

        logger.info(f"Successfully scraped {len(saved_paths)} scripts")
        return saved_paths

    def scrape_by_title(self, title: str) -> Optional[Path]:
        """
        Search for and scrape a specific script by title.

        Args:
            title: Title to search for (case-insensitive)

        Returns:
            Path to saved file, or None if not found
        """
        scripts = self.get_all_script_links()
        title_lower = title.lower()

        for script_info in scripts:
            if title_lower in script_info["title"].lower():
                return self.scrape_script(script_info)

        logger.warning(f"Script not found: {title}")
        return None
