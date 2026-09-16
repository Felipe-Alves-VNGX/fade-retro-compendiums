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

## Extracting the source PDF (Phase 2+)

The compendium content is derived from *Dark Dungeons, 4th Edition*
(Gurbintroll Games). The PDF itself is never committed to this
repository — point the extraction tool at your own copy:

```bash
export DD4_PDF_PATH="$HOME/Documentos/DD4/Dark_Dungeons_(4th_Edition).pdf"
node scripts/extract/pdf2txt.mjs --chapter equipment   # one chapter
node scripts/extract/pdf2txt.mjs --all                 # all chapters in scripts/extract/chapters.json
```

Output lands in `extract/raw/<chapter-id>.txt`, versioned and
human-auditable. See `docs/superpowers/specs/2026-09-17-fase2-extracao-pdf-design.md`
for how the extraction and normalization work.
