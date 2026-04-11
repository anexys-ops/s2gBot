#!/usr/bin/env bash
# Point d’entrée unique : API Laravel + front React (une seule interface web).

set -e
cd "$(dirname "$0")"
exec ./start-btp.sh
