"""Verify a published APK against its metadata and the migrated signing identity."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

def verify(apk, metadata, certificate, sdk):
    tools = Path(sdk) / 'build-tools' / '35.0.0'
    data = json.loads(Path(metadata).read_text())
    expected = Path(certificate).read_text().strip().lower()
    if not re.fullmatch(r'[0-9a-f]{64}', expected):
        raise ValueError('Invalid pinned public certificate fingerprint')
    result = subprocess.check_output([str(tools / 'apksigner'), 'verify', '--print-certs', str(apk)], text=True)
    signers = re.findall(r'^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]+)$', result, re.M)
    if [x.lower() for x in signers] != [expected]:
        raise ValueError('APK certificate differs from the migrated 10071 signing identity')
    result = subprocess.check_output([str(tools / 'aapt'), 'dump', 'badging', str(apk)], text=True)
    match = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", result, re.M)
    if not match or match[1] != 'com.simplestore.tablet':
        raise ValueError('Unexpected APK package')
    if int(match[2]) != int(data['versionCode']) or match[3] != data['versionName']:
        raise ValueError('APK version and published metadata disagree')
    digest = hashlib.sha256(Path(apk).read_bytes()).hexdigest()
    if digest != data.get('apkSha256'):
        raise ValueError('APK bytes and published SHA-256 disagree')
    if int(match[2]) < 10071:
        raise ValueError('Published version is older than the migrated generation')
    print('Verified published APK signature, pinned identity, package, version and SHA-256')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', default='updates/simple-store-tablet.apk')
    parser.add_argument('--metadata', default='updates/version.json')
    parser.add_argument('--certificate', default='android/signing_certificate.sha256')
    parser.add_argument('--sdk', default=os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT'))
    args = parser.parse_args()
    if not args.sdk:
        parser.error('ANDROID_HOME or --sdk is required')
    try:
        verify(args.apk, args.metadata, args.certificate, args.sdk)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print('Update verification failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
