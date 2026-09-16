# Retro Rules Compendiums for Fantastic Depths

Compendium module for the [Fantastic Depths](https://github.com/Forelius/fantastic-depths)
Foundry VTT system. Content is derived from *Dark Dungeons, 4th Edition*
(Gurbintroll Games) under the ORC License — see [CREDITS.md](CREDITS.md).

## Status

Phase 1: build pipeline skeleton, proven with a handful of hand-written
Item documents. See `docs/superpowers/specs/` and `docs/superpowers/plans/`
for the full roadmap.

## Development

```bash
npm install
npm run validate     # check packsrc/ documents against the schema rules
npm run comppacks     # packsrc/*.json -> packs/*.db -> packs/<name> (LevelDB)
npm run decomppacks   # packs/<name> (LevelDB) -> packs/*.db -> packsrc/*.json
```

`packsrc/` is the source of truth and is version-controlled. `packs/` is
build output (LevelDB) and is gitignored — regenerate it with
`npm run comppacks` before loading the module in Foundry.
