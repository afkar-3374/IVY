#!/usr/bin/env bash
# Stores the TURN relay login (e.g. from ExpressTURN) as Supabase secrets for the turn-credentials function.
set -euo pipefail

read -rp "TURN server (e.g. relay1.expressturn.com:3478): " host
read -rp "TURN username: " username
read -rsp "TURN password (hidden): " password
echo

~/.local/bin/supabase secrets set --project-ref wwqjqzxwghuwyptxsxdi \
  "TURN_HOST=${host}" "TURN_USERNAME=${username}" "TURN_PASSWORD=${password}"
echo "Saved. Tell Claude it's done."
