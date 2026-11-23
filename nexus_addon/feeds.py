"""Bounded RSS/Atom collection from configured public HTTPS domains.
Feed entries are leads for Cú Chulainn, never automatically labelled verified fun facts.
"""
import hashlib
import html
import ipaddress
import json
import os
import socket
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

def check_url(url, allowed_hosts):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in (None, 443) or parsed.hostname not in allowed_hosts:
        raise ValueError('Use an approved public HTTPS source')
    for info in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError('Private network sources are not supported')
    return parsed

class CheckedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts):
        self.allowed_hosts = allowed_hosts
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl, self.allowed_hosts)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(url, allowed_hosts, max_bytes=2_000_000):
    check_url(url, allowed_hosts)
    req = urllib.request.Request(url, headers={'User-Agent': 'NexusOfficeResearch/3.0', 'Accept-Encoding': 'identity'})
    with urllib.request.build_opener(CheckedRedirect(allowed_hosts)).open(req, timeout=15) as response:
        body = response.read(max_bytes+1)
        if len(body) > max_bytes:
            raise ValueError('Source exceeds download budget')
        return body

def parse_feed(body, source_url, keywords=()):
    if b'<!DOCTYPE' in body.upper() or b'<!ENTITY' in body.upper():
        raise ValueError('Entity declarations are not supported')
    root = ET.fromstring(body)
    tag = lambda e: e.tag.rsplit('}', 1)[-1]
    rows, seen = [], set()
    for entry in root.iter():
        if tag(entry) not in ('item', 'entry'):
            continue
        children = {tag(e): e for e in entry}
        def text(name):
            e = children.get(name)
            return ''.join(e.itertext()).strip() if e is not None else ''
        title = html.unescape(text('title'))[:400]
        if keywords and not any(k.casefold() in title.casefold() for k in keywords):
            continue
        link = text('link')
        for child in entry:
            if tag(child) == 'link' and child.get('rel', 'alternate') == 'alternate':
                link = child.get('href') or link
                break
        url = urllib.parse.urljoin(source_url, link)
        p = urllib.parse.urlsplit(url)
        if not title or not link or p.scheme not in ('http', 'https') or p.username or p.password:
            continue
        # Preserve query parameters: distinct arXiv/search/article IDs can use them.
        canonical = urllib.parse.urlunsplit((p.scheme, p.netloc, p.path, p.query, ''))
        key = hashlib.sha256(canonical.encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        rows.append({'id': key, 'title': title, 'url': canonical, 'source_url': source_url,
                     'published_at': text('published') or text('pubDate') or text('updated') or None,
                     'retrieved_at': datetime.now(timezone.utc).isoformat(), 'verification': 'unreviewed_lead'})
        if len(rows) >= 100:
            break
    return rows

def collect(sources, allowed_hosts, keywords=()):
    items, errors, seen = [], [], set()
    for url in sources[:12]:
        try:
            for row in parse_feed(fetch(url, allowed_hosts), url, keywords):
                if row['id'] not in seen:
                    items.append(row)
                    seen.add(row['id'])
        except Exception as exc:
            errors.append({'source': url, 'error': type(exc).__name__})
    return {'items': items[:300], 'errors': errors, 'retrieved_at': datetime.now(timezone.utc).isoformat()}

def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name+'.')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
