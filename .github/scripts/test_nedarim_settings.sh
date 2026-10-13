#!/usr/bin/env bash
set -euo pipefail
SERIAL=$(adb devices | awk '/^emulator-.*device$/ {print $1}')
test -n "$SERIAL"
ADB=(adb -s "$SERIAL")
"${ADB[@]}" root
"${ADB[@]}" wait-for-device
# Block web traffic before launching the fixture; no production-store calls.
"${ADB[@]}" shell iptables -I OUTPUT -p tcp --dport 443 -j REJECT
"${ADB[@]}" shell iptables -I OUTPUT -p tcp --dport 80 -j REJECT
"${ADB[@]}" shell iptables -I OUTPUT -p udp --dport 443 -j REJECT
"${ADB[@]}" shell ip6tables -I OUTPUT -p tcp --dport 443 -j REJECT
"${ADB[@]}" shell ip6tables -I OUTPUT -p tcp --dport 80 -j REJECT
"${ADB[@]}" shell svc wifi disable
"${ADB[@]}" shell svc data disable
"${ADB[@]}" shell wm size 1920x1200
"${ADB[@]}" shell wm density 320
"${ADB[@]}" install updates/simple-store-tablet.apk
# Verify an ordinary in-place update preserves private data on this disposable emulator.
"${ADB[@]}" shell "run-as com.simplestore.tablet sh -c 'mkdir -p files; echo preserved > files/update-fixture.txt'"
"${ADB[@]}" install -r target-apk/app-debug.apk
test "$("${ADB[@]}" shell run-as com.simplestore.tablet cat files/update-fixture.txt | tr -d '\r\n')" = preserved
echo 'In-place signed update preserved private fixture data.'
"${ADB[@]}" install -t keyboard-test.apk
capture() {
  for shot in payment-form.png payment-keyboard.png payment-tap.png payment-regular.png; do
    "${ADB[@]}" exec-out run-as com.simplestore.tablet cat "cache/$shot" > "$shot" || true
  done
  "${ADB[@]}" logcat -d -s System.out:I chromium:E AndroidRuntime:E > payment-diagnostics.txt
}
trap capture EXIT
timeout 120 "${ADB[@]}" shell am instrument -w com.simplestore.keyboardtest/.PaymentSettingsInstrumentation | tee keyboard-result.txt
grep -F 'keyboard_result=PASS:' keyboard-result.txt
