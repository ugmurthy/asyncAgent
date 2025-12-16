#!/bin/bash
# Replace all URLs in piped text with [URL]

sed -E 's#https?://[^[:space:]]+#[URL]#g' | \
sed -E 's#www\.[^[:space:]]+#[URL]#g' | \
sed -E 's#[a-zA-Z0-9.-]+\.(com|org|net|edu|gov|io|co|dev|ai)[^[:space:]]*#[URL]#g'
