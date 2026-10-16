#!/bin/sh
# Fails if any SwiftUI animation site bypasses the Reduce Motion gate.
#
# A call is gated when its own argument carries the gate: `Motion.reduced(...)`,
# `resolve(...)`, the `reduceMotion ? nil` / `turning && !reduceMotion` ternaries,
# `MotionGate`/`motionAnimation`, or the TimelineView forms. The argument is matched, not the
# whole line, so a call is not excused by a gate word elsewhere on the line or in a comment.
set -eu
repo=$(git rev-parse --show-toplevel)
fail=0
check() { # $1 = call pattern, $2 = dir
    hits=$(grep -rnE "$1" "$repo/$2" --include='*.swift' \
        | awk '
            {
                # Split into path:line:text, keeping any further colons in the text.
                i = index($0, ":"); rest = substr($0, i + 1)
                j = index(rest, ":"); where = substr($0, 1, i + j - 1); text = substr(rest, j + 1)
                # Comments cannot excuse a call.
                sub(/\/\/.*/, "", text)
                # Match from the call onward, so only the argument decides.
                if (match(text, /(withAnimation|\.animation)[[:space:]]*[\(\{]/) == 0) next
                arg = substr(text, RSTART)
                if (arg ~ /Motion\.reduced|resolve\(|motionAnimation|MotionGate|reduceMotion \? nil|turning && !reduceMotion|paused:|minimumInterval|reduced\(layout, reduce\)|withAnimation\(animation\)/) next
                print where text
            }' || true)
    if [ -n "$hits" ]; then
        echo "Ungated animation sites in $2:"
        printf '%s\n' "$hits"
        fail=1
    fi
}
check 'withAnimation[[:space:]]*\(|withAnimation[[:space:]]*\{' 'apps/ios'
check '\.animation[[:space:]]*\(' 'apps/ios'
exit $fail
