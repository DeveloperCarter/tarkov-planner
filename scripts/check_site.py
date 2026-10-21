"""Parse every inline script and check local navigation stays within the published site."""
import re
import json
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


def check_search_indexes(dist):
    """Search hrefs are relative to the site root, including the PvE index's hrefs."""
    dist = dist.resolve()
    for relative in ('search-index.json', 'pve/search-index.json'):
        path = dist / relative
        if not path.is_file():
            raise ValueError(f'{relative}: search index missing')
        try:
            rows = json.loads(path.read_text(encoding='utf-8'))
        except (ValueError, UnicodeError) as exc:
            raise ValueError(f'{relative}: invalid search JSON') from exc
        if not isinstance(rows, list):
            raise ValueError(f'{relative}: search index must be an array')
        ids = set()
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not isinstance(row.get('maps'), list):
                raise ValueError(f'{relative}: invalid search entry')
            if row['id'] in ids:
                raise ValueError(f'{relative}: duplicate task {row["id"]}')
            ids.add(row['id'])
            for location in row['maps']:
                href = location.get('href') if isinstance(location, dict) else None
                if not isinstance(href, str) or not href:
                    raise ValueError(f'{relative}: missing map href')
                url = urlsplit(href)
                target = (dist / unquote(url.path)).resolve()
                if (url.scheme or url.netloc or url.path.startswith(('/', '\\')) or '\\' in url.path or
                        not target.is_relative_to(dist) or not target.is_file()):
                    raise ValueError(f'{relative}: broken search href {href}')


def check_career_data(dist):
    for mode, prefix in [('regular', ''), ('pve', 'pve/')]:
        path = dist / (prefix + 'career-data.json')
        if not path.is_file():
            raise ValueError(f'{path}: career data missing')
        data = json.loads(path.read_text(encoding='utf-8'))
        if data.get('mode') != mode or not isinstance(data.get('progression'), dict):
            raise ValueError(f'{path}: invalid career mode/progression')
        tasks = data.get('tasks')
        if not isinstance(tasks, list) or len({t['id'] for t in tasks}) != len(tasks):
            raise ValueError(f'{path}: invalid career tasks')
        for task in tasks:
            if task.get('kappa') is not None and not isinstance(task['kappa'], bool):
                raise ValueError(f'{path}: invalid Kappa flag')
            for location in task['maps']:
                href = location['href']
                url = urlsplit(href)
                target = (dist / unquote(url.path)).resolve()
                if (url.scheme or url.netloc or url.path.startswith(('/', '\\')) or '\\' in url.path or
                        not target.is_relative_to(dist.resolve()) or not target.is_file()):
                    raise ValueError(f'{path}: broken career href {href}')


def check(dist):
    dist = dist.resolve()
    scripts = 0
    pages = sorted(dist.rglob('*.html'))
    if not (dist / 'index.html').exists():
        raise ValueError('site home page missing')
    check_search_indexes(dist)
    check_career_data(dist)
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
    print(f'Checked {len(pages)} pages, {scripts} inline scripts, navigation links and both search indexes')
    return len(pages), scripts


if __name__ == '__main__':
    check(ROOT / 'dist')
