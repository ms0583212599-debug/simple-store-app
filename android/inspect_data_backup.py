"""Inspect a raw run-as TAR backup without extracting or printing private values."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile
import xml.etree.ElementTree as ET

def inspect(path):
    required = {'shared_prefs/simple_store_offline.xml', 'shared_prefs/kiosk.xml'}
    names, prefs, errors = set(), {}, []
    with tarfile.open(path, 'r:*') as archive:
        for item in archive:
            normalized = item.name.removeprefix('./')
            parts = PurePosixPath(normalized)
            if parts.is_absolute() or '..' in parts.parts or not (item.isfile() or item.isdir()):
                errors.append('Unsafe archive entry type or path')
                continue
            if normalized in names:
                errors.append('Duplicate archive entry')
            names.add(normalized)
            if not item.isfile():
                continue
            stream = archive.extractfile(item)
            if stream is None:
                errors.append('Unreadable archive member')
                continue
            digest, total = hashlib.sha256(), 0
            chunks = [] if normalized.startswith('shared_prefs/') and normalized.endswith('.xml') else None
            while chunk := stream.read(65536):
                total += len(chunk)
                digest.update(chunk)
                if chunks is not None:
                    if total > 32 * 1024 * 1024:
                        raise ValueError('Preferences file exceeds inspection limit')
                    chunks.append(chunk)
            if total != item.size:
                errors.append('Truncated archive member')
            if chunks is not None:
                try:
                    root = ET.fromstring(b''.join(chunks))
                    if root.tag != 'map':
                        raise ValueError('Not an Android preferences map')
                    counts = {}
                    for node in root:
                        if node.get('name') in ('pending_operations', 'failed_operations'):
                            value = json.loads(node.text or '[]')
                            if not isinstance(value, list):
                                raise ValueError('Invalid operation queue')
                            counts[node.get('name')] = len(value)
                    prefs[normalized] = {'bytes': total, 'sha256': digest.hexdigest(), 'entry_count': len(root), **counts}
                except (ET.ParseError, ValueError, TypeError):
                    errors.append('Invalid preferences XML or operation queue')
    missing = sorted(required - names)
    sha = hashlib.sha256()
    with Path(path).open('rb') as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return {'size_bytes': Path(path).stat().st_size, 'sha256': sha.hexdigest(),
            'member_count': len(names), 'preferences': prefs, 'missing_required': missing,
            'errors': errors, 'structurally_valid': not (errors or missing),
            'restore_test_passed': False,
            'note': 'Structure checks do not establish a consistent snapshot or successful restoration.'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup', type=Path)
    args = parser.parse_args()
    try:
        result = inspect(args.backup)
    except (OSError, tarfile.TarError, ValueError):
        parser.exit(1, 'Backup inspection failed; private data was not printed.\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['structurally_valid'] else 1)
