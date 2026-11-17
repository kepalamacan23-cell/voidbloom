# VOIDBLOOM — Arena Survival

An original 2D arena survival wave shooter for the desktop browser: hold the bloom,
break the swarm, chase the score. Plain HTML5 canvas + ES modules — no engine, no
assets, no network requests; all art is drawn in code and all sound is synthesised
with WebAudio.

**Full details:** concept, controls, enemy and pickup guide, features, technology
and verification notes live in [DOSSIER.md](DOSSIER.md).

**Play it locally:**

```sh
node serve.ts
```

**Produce the hand-in output** (copies `game/` and `screenshots/`, writes
`dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Licensed under the MIT License — see `LICENSE`.
