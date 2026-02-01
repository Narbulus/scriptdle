"""
URL Fetching Utilities

Fetch HTML content from URLs for transcript extraction.
Supports both simple HTTP requests and headless browser rendering
for JavaScript-heavy sites like Fandom wikis.
"""

import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

JS_REQUIRED_PATTERNS = [
    "JavaScript is disabled",
    "Please enable JavaScript",
    "couldn't load",
    "Loading...",
    '<noscript>',
]

JS_REQUIRED_DOMAINS = [
    "fandom.com",
    "wikia.com",
]


def fetch_url(
    url: str,
    timeout: int = 30,
    headers: Optional[dict] = None,
    use_browser: Optional[bool] = None,
) -> str:
    """
    Fetch HTML content from a URL.

    Automatically detects if a page requires JavaScript rendering
    and falls back to Playwright if needed.

    Args:
        url: URL to fetch
        timeout: Request timeout in seconds
        headers: Optional custom headers
        use_browser: Force browser rendering (True), force simple request (False),
                    or auto-detect (None, default)

    Returns:
        HTML content as string

    Raises:
        Exception: If fetching fails
    """
    if use_browser is None:
        use_browser = any(domain in url for domain in JS_REQUIRED_DOMAINS)

    if use_browser:
        return fetch_url_browser(url, timeout=timeout)

    html = fetch_url_simple(url, timeout=timeout, headers=headers)

    if any(pattern in html for pattern in JS_REQUIRED_PATTERNS):
        logger.info("Page requires JavaScript, falling back to browser rendering")
        return fetch_url_browser(url, timeout=timeout)

    return html


def fetch_url_simple(
    url: str,
    timeout: int = 30,
    headers: Optional[dict] = None
) -> str:
    """
    Fetch HTML content using simple HTTP request.

    Args:
        url: URL to fetch
        timeout: Request timeout in seconds
        headers: Optional custom headers

    Returns:
        HTML content as string

    Raises:
        requests.RequestException: If the request fails
    """
    if headers is None:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

    logger.info(f"Fetching URL (simple): {url}")

    response = requests.get(url, timeout=timeout, headers=headers)
    response.raise_for_status()

    response.encoding = response.apparent_encoding or 'utf-8'

    logger.info(f"Fetched {len(response.text)} characters from {url}")

    return response.text


def fetch_url_browser(
    url: str,
    timeout: int = 30,
    wait_for_selector: Optional[str] = None,
) -> str:
    """
    Fetch HTML content using Playwright headless browser.

    Renders JavaScript and returns the fully loaded page content.

    Args:
        url: URL to fetch
        timeout: Page load timeout in seconds
        wait_for_selector: Optional CSS selector to wait for before extracting content

    Returns:
        HTML content as string

    Raises:
        Exception: If browser rendering fails
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise ImportError(
            "Playwright is required for browser rendering. "
            "Install it with: pip install playwright && playwright install chromium"
        )

    logger.info(f"Fetching URL (browser): {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_default_timeout(timeout * 1000)

            page.goto(url, wait_until="domcontentloaded")

            if wait_for_selector:
                page.wait_for_selector(wait_for_selector, timeout=timeout * 1000)
            else:
                try:
                    page.wait_for_selector(
                        ".mw-parser-output, .mw-content-text, #content, main",
                        timeout=10000
                    )
                except Exception:
                    page.wait_for_timeout(2000)

            html = page.content()

            logger.info(f"Fetched {len(html)} characters from {url} (browser)")

            return html

        finally:
            browser.close()


def fetch_wiki_content(
    url: str,
    timeout: int = 30,
) -> str:
    """
    Fetch and extract main content from a wiki page.

    Uses browser rendering and extracts just the main content area,
    removing navigation, ads, and other boilerplate.

    Args:
        url: Wiki page URL
        timeout: Page load timeout in seconds

    Returns:
        Extracted main content HTML

    Raises:
        Exception: If fetching or extraction fails
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise ImportError(
            "Playwright is required for wiki content extraction. "
            "Install it with: pip install playwright && playwright install chromium"
        )

    logger.info(f"Fetching wiki content: {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_default_timeout(timeout * 1000)

            page.goto(url, wait_until="domcontentloaded")

            try:
                page.wait_for_selector(".mw-parser-output", timeout=10000)
            except Exception:
                page.wait_for_timeout(3000)

            content = page.evaluate("""
                () => {
                    const content = document.querySelector('.mw-parser-output');
                    if (!content) return null;

                    const clone = content.cloneNode(true);

                    const selectors = [
                        '.toc', '.navbox', 'table', '.mw-editsection',
                        '.reference', 'script', 'style',
                        '[class*="cnx-"]', '[class*="ad-"]',
                        '.portable-infobox', '.infobox'
                    ];
                    selectors.forEach(sel => {
                        clone.querySelectorAll(sel).forEach(el => el.remove());
                    });

                    return clone.innerHTML;
                }
            """)

            if content:
                logger.info(f"Extracted {len(content)} characters of wiki content")
                return content
            else:
                logger.warning("Could not extract wiki content, returning full page")
                return page.content()

        finally:
            browser.close()
