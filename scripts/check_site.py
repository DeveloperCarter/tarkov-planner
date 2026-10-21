"""Parse every inline script and check local navigation stays within the published site."""
import re
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from etl_tarkov_dev import ROOT


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.hrefs += [value for name, value in attrs if name == 'href']


def check(dist):
    dist = dist.resolve()
    scripts = 0
    pages = sorted(dist.rglob('*.html'))
    if not (dist / 'index.html').exists():
        raise ValueError('site home page missing')
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / 'inline.cjs'
        for page in pages:
            text = page.read_text(encoding='utf-8')
            if re.search(r'/\*__[A-Z_]+__\*/|<!--__SITE_NAV__-->', text):
                raise ValueError(f'{page}: unfilled template marker')
            for script in re.findall(r'<script\b[^>]*>(.*?)</script>', text, re.S | re.I):
                path.write_text(script, encoding='utf-8')
                subprocess.run(['node', '--check', str(path)], check=True, capture_output=True, text=True)
                scripts += 1
            links = Links()
            links.feed(text)
            for href in links.hrefs:
                url = urlsplit(href)
                if url.scheme or url.netloc or not url.path:
                    continue
                target = (page.parent / unquote(url.path)).resolve()
                if not target.is_relative_to(dist) or not target.exists():
                    raise ValueError(f'{page}: broken local link {href}')
    print(f'Checked {len(pages)} pages, {scripts} inline scripts and all local navigation links')
    return len(pages), scripts


if __name__ == '__main__':
    check(ROOT / 'dist')
