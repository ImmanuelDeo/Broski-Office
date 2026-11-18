"""Reviewed template refresh. Never turn arbitrary scraped text into a fact.
After a source edit fails its anchor checks, keep old evidence/date; frontend TTL
will eventually suppress it. New facts require reviewed source evidence.
"""
from datetime import datetime, timezone
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
from .feeds import fetch, atomic_json

class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip-1)
    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

def refresh_templates(templates, output, fetcher=fetch):
    checked, errors, cache = [], [], {}
    try:
        previous = {f['id']: f for f in json.loads(Path(output).read_text(encoding='utf-8'))['facts']}
    except (OSError, ValueError, KeyError, TypeError):
        previous = {}
    for template in templates:
        url = template['url']
        try:
            if url not in cache:
                parser = PlainText()
                parser.feed(fetcher(url, {'science.nasa.gov', 'home.cern'}).decode('utf-8', errors='replace'))
                cache[url] = ' '.join(' '.join(parser.parts).split())
            text = cache[url]
            # Match the full reviewed evidence string, not isolated keywords.
            evidence = template['evidence']
            if evidence.casefold() not in text.casefold():
                raise ValueError('Reviewed evidence changed; needs human/source review')
            checked.append({**template, 'verified_at': datetime.now(timezone.utc).date().isoformat(),
                            'evidence_sha256': hashlib.sha256(evidence.encode()).hexdigest()})
        except Exception as exc:
            old = previous.get(template['id'], {})
            # Reuse last good date only for the same reviewed claim and source.
            checked.append(old if all(old.get(k) == template.get(k) for k in ('url','text','evidence')) else template)
            errors.append({'id': template['id'], 'error': type(exc).__name__})
    atomic_json(output, {'facts': checked, 'errors': errors})
    return checked, errors
