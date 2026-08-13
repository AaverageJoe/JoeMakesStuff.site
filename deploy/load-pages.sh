#!/usr/bin/env bash
# Opens the admin panel and rack dashboard on this Pi's own display.
chromium --new-window "http://localhost/admin" "http://localhost/dashboard" >/dev/null 2>&1 &
disown
