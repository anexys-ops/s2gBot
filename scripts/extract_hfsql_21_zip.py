#!/usr/bin/env python3
"""
Extrait 21.zip (HFSQL WinDef) via 7z — compatible Deflate64 (method 9), chemins UTF-8.

Dépendance : 7z (p7zip) — ex. brew install p7zip

Espace : l’archive complète ~450 Go une fois extraite. Modes :
  --mode light   : exclut _Backup/ + ignore les fichiers > --max-mo (hors __System/)
  --mode no-backup : tout le répertoire actif (sans _Backup), ~150 Go
  --mode full    : tout (dont _Backup), ~450 Go
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

SEVEN_Z = os.environ.get("P7ZIP", "7z")


def collect_names(
    z: zipfile.ZipFile, mode: str, max_bytes: int | None
) -> list[str]:
    out: list[str] = []
    for info in z.infolist():
        if info.is_dir():
            continue
        name = info.filename
        if mode in ("light", "no-backup") and "/_Backup/" in name:
            continue
        if mode == "light" and max_bytes is not None:
            if "/__System/" in name:
                out.append(name)
                continue
            if "/_Backup/" in name:
                continue
            if info.file_size > max_bytes:
                continue
        out.append(name)
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--zip",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "21.zip",
    )
    p.add_argument(
        "--dest",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "BD_S2G_PROLAB",
    )
    p.add_argument(
        "--mode", choices=("light", "no-backup", "full"), default="light"
    )
    p.add_argument("--max-mb", type=float, default=120.0, help="mode light uniquement")
    p.add_argument(
        "--yes",
        action="store_true",
        help="Poursuivre même si l’espace libre semble insuffisant (no-backup/full)",
    )
    args = p.parse_args()
    zpath, dest = args.zip, args.dest
    max_bytes = int(args.max_mb * 1024 * 1024) if args.mode == "light" else None

    if not zpath.is_file():
        print(f"Fichier introuvable : {zpath}", file=sys.stderr)
        return 1
    if shutil.which(SEVEN_Z) is None:
        print(
            f"7z introuvable ({SEVEN_Z}). Installez p7zip : brew install p7zip",
            file=sys.stderr,
        )
        return 1

    with zipfile.ZipFile(zpath, "r") as zf:
        names = collect_names(zf, args.mode, max_bytes)
        total = 0
        for n in names:
            try:
                total += zf.getinfo(n).file_size
            except KeyError:
                pass

    stat = os.statvfs(zpath.parent)
    free = stat.f_bavail * stat.f_bsize
    if not args.yes and total > free:
        print(
            f"Espace disque insuffisant (besoin ~{total/1e9:.1f} Go, ~{free/1e9:.1f} Go libres). "
            f"Libérez de l’espace, un autre volume, ou --mode light, ou --yes (risque d’échec I/O).",
            file=sys.stderr,
        )
        return 1

    dest.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".lst", delete=False
    ) as tmp:
        for n in names:
            tmp.write(n + "\n")
        list_path = tmp.name

    try:
        cmd = [
            SEVEN_Z,
            "x",
            str(zpath),
            f"@{list_path}",
            f"-o{dest}",
            "-y",
        ]
        r = subprocess.run(cmd, check=False)
        if r.returncode != 0:
            print("7z a retourné une erreur.", file=sys.stderr)
            return r.returncode
    finally:
        os.unlink(list_path)

    print(
        f"Extrait : {len(names)} fichiers, ~{total/1e9:.2f} Go, mode={args.mode} → {dest}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
