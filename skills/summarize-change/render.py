"""Render a standalone review page from evidence.json and summary.json."""

import argparse
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

from jinja2 import Environment, FileSystemLoader, StrictUndefined, TemplateError


def http_url(href):
    url = urlsplit(href)
    if url.scheme not in {"http", "https"} or not url.hostname:
        raise ValueError("Expected an HTTP(S) evidence link.")
    return href


def render(evidence, summary):
    overview, changes, tests = (summary.get(k) for k in ("overview", "changes", "tests"))
    if (not isinstance(overview, str) or not overview.strip()
            or not all(isinstance(group, list) and group and
                       all(isinstance(s, str) and s.strip() for s in group) for group in (changes, tests))):
        raise ValueError("summary.json needs overview text and nonempty changes and tests lists.")
    env = Environment(loader=FileSystemLoader(Path(__file__).with_name("templates")),
                      autoescape=True, undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True)
    env.filters["http_url"] = http_url
    return env.get_template("overview.html.jinja").render(evidence=evidence, summary=summary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    out = parser.parse_args().out.resolve()
    page = render(*(json.loads((out / name).read_text(encoding="utf-8"))
                    for name in ("evidence.json", "summary.json")))
    path = out / "overview.html"
    path.write_text(page, encoding="utf-8")
    print(path)


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except (ValueError, KeyError, OSError, TemplateError) as error:
        sys.exit(str(error))
