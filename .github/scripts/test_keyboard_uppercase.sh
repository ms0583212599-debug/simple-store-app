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
"${ADB[@]}" install target-apk/app-debug.apk
"${ADB[@]}" install -t keyboard-test.apk
timeout 120 "${ADB[@]}" shell am instrument -w com.simplestore.keyboardtest/.KeyboardInstrumentation | tee keyboard-result.txt
grep -F 'keyboard_result=PASS:' keyboard-result.txt
