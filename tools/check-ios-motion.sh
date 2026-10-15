#!/bin/sh
# Fails if any SwiftUI animation site bypasses the Reduce Motion gate.
# Allowed: MotionGate/motionAnimation/Motion.reduced, the `reduceMotion ? nil`
# inline ternaries, TimelineView pause/minimumInterval forms, Motion.swift's own
# gate definition, and WidgetGalleryView's pre-gated local.
set -eu
repo=$(git rev-parse --show-toplevel)
fail=0
check() { # $1 = pattern, $2 = dir
    hits=$(grep -rn "$1" "$repo/$2" --include='*.swift' \
        | grep -v 'motion\.animate\|motionAnimation\|Motion\.reduced\|MotionGate\|reduceMotion ? nil\|paused:\|minimumInterval\|withAnimation(animation)\|reduced(layout, reduce)\|turning && !reduceMotion' || true)
    if [ -n "$hits" ]; then
        echo "Ungated animation sites in $2:"
        printf '%s\n' "$hits"
        fail=1
    fi
}
check 'withAnimation(' 'apps/ios'
check '\.animation(' 'apps/ios'
exit $fail
