"""Refresh both modes and build the release site. No logs or browser data are read.

Daily CI restores snapshot/ and raw/wiki/ from cache before running this command.
Wiki entries are never refetched automatically; new pages use the existing 1/s fetcher.
"""
import argparse
import contextlib
import io
import shutil
import subprocess
import sys
from pathlib import Path
from etl_tarkov_dev import ROOT, latest_snapshot
from compare_wiki import main as compare_wiki


def prune_snapshots():
    """Cache only the newest complete snapshot per mode, including after a failed fetch."""
    for mode in ('regular', 'pve'):
        base = (ROOT / 'snapshot' / mode).resolve()
        if not any(p.is_dir() and not p.name.startswith('pending-') and (p / 'manifest.json').exists() for p in base.glob('*')):
            continue
        keep = latest_snapshot(mode).resolve()
        for path in base.iterdir():
            resolved = path.resolve()
            if path.is_dir() and not path.is_symlink() and resolved.parent == base and resolved != keep:
                shutil.rmtree(resolved)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--offline', action='store_true')
    ap.add_argument('--level', type=int, default=1)
    ap.add_argument('--faction', choices=['USEC', 'BEAR'], default='USEC')
    ap.add_argument('--max-age-hours', type=float, default=24)
    args = ap.parse_args()
    def run(script, *options):
        subprocess.run([sys.executable, str(ROOT / 'scripts' / script), *map(str, options)], cwd=ROOT, check=True)
    try:
        for mode in ('regular', 'pve'):
            run('etl_tarkov_dev.py', '--mode', mode, *(['--offline'] if args.offline else []))
            run('build_progression.py', '--mode', mode)
            base = ROOT / 'data' / ('' if mode == 'regular' else 'pve')
            # The curated wiki comparison covers its named reference quests, not every quest.
            report = io.StringIO()
            with contextlib.redirect_stdout(report):
                compare_wiki(str(base / 'maps' / 'customs.json'), str(ROOT / 'raw' / 'customs-wiki.json'))
            (ROOT / 'reports' / f'customs-conflicts-{mode}.md').write_text(report.getvalue(), encoding='utf-8')
        run('build_page.py', '--site', '--level', args.level, '--faction', args.faction, '--max-age-hours', args.max_age_hours)
        run('check_site.py')
    finally:
        # Never publish source snapshots. Retain just the fallback for the next cache restore.
        if all((ROOT / 'snapshot' / m).exists() for m in ('regular', 'pve')):
            prune_snapshots()


if __name__ == '__main__':
    main()
