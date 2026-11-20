#!/bin/sh
# read-only query helper: q.sh "<sql>"
psql -d compass_hotels -X -q --csv -c "set default_transaction_read_only = on" -c "set search_path = hotel" -c "$1"
