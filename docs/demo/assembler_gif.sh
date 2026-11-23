#!/usr/bin/env bash
# Assemble les images capturées par enregistrer_demo.js en docs/demo/demo.gif, en respectant leurs durées réelles.
# Palette calculée sur toute la vidéo : un GIF n'a que 256 couleurs, autant choisir les bonnes.
set -euo pipefail
cd "$(dirname "$0")"
LARGEUR=${LARGEUR:-960}

py - <<'PY'
import json, pathlib
d = pathlib.Path("images")
durees = json.loads((d / "durees.json").read_text())
images = sorted(d.glob("*.jpg"))
lignes = []
for img, t in zip(images, durees):
    lignes += [f"file '{img.name}'", f"duration {t:.3f}"]
lignes.append(f"file '{images[-1].name}'")  # le démultiplexeur ignore la durée de la dernière image
(d / "liste.txt").write_text("\n".join(lignes))
PY

IPS=${IPS:-8}
FILTRE="fps=${IPS},scale=${LARGEUR}:-1:flags=lanczos"
ffmpeg -loglevel error -y -f concat -safe 0 -i images/liste.txt -vf "$FILTRE,palettegen=max_colors=${COULEURS:-192}:stats_mode=diff" images/palette.png
ffmpeg -loglevel error -y -f concat -safe 0 -i images/liste.txt -i images/palette.png \
  -lavfi "$FILTRE [x]; [x][1:v] paletteuse=dither=${TRAMAGE:-bayer:bayer_scale=4}:diff_mode=rectangle" -loop 0 demo.gif
ls -la demo.gif
