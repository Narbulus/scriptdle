"""
HTML Text Extraction

Pure functions for extracting text from HTML screenplays.
Handles both plain text extraction and structured element extraction.
"""

import logging
from typing import Optional

from bs4 import BeautifulSoup, NavigableString

logger = logging.getLogger(__name__)


def extract_html(html: str) -> str:
    """
    Extract plain text from HTML content.
    
    Removes script/style tags and returns clean text.
    Preserves whitespace/formatting, especially within <pre> tags.
    
    Args:
        html: HTML content string
        
    Returns:
        Extracted plain text
    """
    soup = BeautifulSoup(html, "html.parser")
    
    for script in soup(["script", "style"]):
        script.decompose()
    
    pre_tags = soup.find_all("pre")
    if pre_tags:
        return "\n\n".join(tag.get_text() for tag in pre_tags).strip()
    
    text = soup.get_text(separator="\n")
    lines = [line.rstrip() for line in text.splitlines()]
    return "\n".join(lines).strip()


def extract_html_structured(html: str) -> list[dict]:
    """
    Extract structured elements from HTML screenplay.
    
    Returns list of elements with:
    - text: raw text
    - content: stripped text
    - is_bold: whether text was bold
    - indent: indentation level
    
    Args:
        html: HTML content string
        
    Returns:
        List of element dictionaries
    """
    html = html.replace('�', '—')
    html = html.replace('\x92', "'")
    html = html.replace('\x93', '"')
    html = html.replace('\x94', '"')
    html = html.replace('&amp;', '&')
    
    soup = BeautifulSoup(html, "html.parser")
    
    for script in soup(["script", "style"]):
        script.decompose()
    
    id_speakers = soup.find_all(attrs={'id': 'speaker'})
    if len(id_speakers) >= 3:
        return _extract_id_based(soup)
    
    pre_tag = soup.find("pre")
    if not pre_tag:
        pre_tag = soup.find("body") or soup
    
    elements = []
    
    def get_indent_level(text: str) -> int:
        if not text:
            return 0
        expanded = text.replace('\t', '        ')
        stripped = expanded.lstrip()
        return len(expanded) - len(stripped)
    
    def process_node(node, is_bold=False, depth=0):
        if depth > 100:
            return
        
        if isinstance(node, NavigableString):
            text = str(node)
            for line in text.split('\n'):
                if line.strip():
                    elements.append({
                        'text': line.rstrip(),
                        'is_bold': is_bold,
                        'indent': get_indent_level(line),
                        'content': line.strip()
                    })
        else:
            tag_is_bold = is_bold or node.name == 'b'
            node_id = node.get('id', '').lower() if hasattr(node, 'get') else ''
            if node_id in ('speaker', 'slug'):
                tag_is_bold = True
            
            for child in node.children:
                process_node(child, tag_is_bold, depth + 1)
    
    process_node(pre_tag)
    return elements


def extract_wiki(html: str) -> str:
    """
    Extract transcript text from wiki pages (Fandom/MediaWiki).

    Targets main content area and removes navigation, sidebars,
    table of contents, and other wiki boilerplate.

    Args:
        html: HTML content from wiki page

    Returns:
        Clean transcript text
    """
    soup = BeautifulSoup(html, "html.parser")

    unwanted_selectors = [
        'script', 'style',
        '#toc', '.toc',
        '.navbox', '.navigation-box',
        '.portable-infobox', '.infobox',
        '.categories', '.page-footer',
        '.page-header', '.page-header__categories',
        '.printfooter', '.mw-editsection',
        '.noprint', '.reference',
        'table',
    ]

    for selector in unwanted_selectors:
        for elem in soup.select(selector):
            elem.decompose()

    main_content = None
    content_selectors = [
        '.mw-parser-output',
        '.mw-content-text',
        '#mw-content-text',
        '.page-content',
        'main',
        '#content'
    ]

    for selector in content_selectors:
        main_content = soup.select_one(selector)
        if main_content:
            break

    if not main_content:
        main_content = soup.find('body') or soup

    for link in main_content.find_all('a'):
        link.replace_with(link.get_text())

    text = main_content.get_text(separator="\n")

    lines = [line.rstrip() for line in text.splitlines()]
    lines = [line for line in lines if line]

    return "\n".join(lines).strip()


def _extract_id_based(soup) -> list[dict]:
    """
    Extract structured elements from ID-based HTML screenplay.

    Handles IMSDb-style HTML with id="speaker", id="dia", etc.
    """
    elements = []

    def get_direct_text(elem):
        texts = []
        for child in elem.children:
            if isinstance(child, NavigableString):
                text = str(child).strip()
                if text:
                    texts.append(text)
        return ' '.join(texts)

    for elem in soup.find_all(attrs={'id': True}):
        elem_id = elem.get('id', '').lower()
        text = get_direct_text(elem)

        if not text:
            continue

        if elem_id == 'speaker':
            elements.append({'text': text, 'content': text, 'is_bold': True, 'indent': 37})
        elif elem_id == 'dia':
            elements.append({'text': text, 'content': text, 'is_bold': False, 'indent': 25})
        elif elem_id == 'slug':
            elements.append({'text': text, 'content': text, 'is_bold': True, 'indent': 0})
        elif elem_id == 'act':
            elements.append({'text': text, 'content': text, 'is_bold': False, 'indent': 0})
        elif elem_id == 'spkdir':
            elements.append({'text': f'({text})', 'content': f'({text})', 'is_bold': False, 'indent': 31})

    return elements
