# Serious Sam Tournaments Rankings

Public site: https://DenWhAI.github.io/serious-sam-tournaments-ranking/

Approved TSE and BFE snapshots, two releases per game. Static HTML/CSS/JavaScript; no server, account system, tracking, or public upload endpoint. Only repository writers can publish changes. Do not grant write access to visitors.

## Local preview

```sh
python scripts/validate.py
python -m http.server 8080
```

Open http://localhost:8080. Use HTTP, not a file:// URL (the site loads JSON).

## Publish a new rating

1. Calculate and approve the release in the local Rating Studio.
2. Export **the open rating** as JSON plus its Simple and Advanced CSV tables.
3. Clone this repository with GitHub Desktop, or pull the latest main in an existing clone.
4. Import the approved files, giving explicit match-period dates and the actual publication date:

```sh
python scripts/import_release.py --snapshot "rating.json" --simple "Table1.csv" --advanced "Table2.csv" --start 2026-09-01 --end 2026-10-01 --published 2026-10-05 --notes "October approved release"
python scripts/validate.py
```

5. Preview the site and check both views. Commit new data and push to main. The **Validate and publish rankings** workflow validates and publishes GitHub Pages automatically.

The JSON must contain one slot and its presentation.players values. The importer rejects mismatched player sets, display Points, FinalScores and an existing release directory. It does not recalculate any rating. A corrected release must use a new ID/path; never silently replace an approved one. The initial approved files are protected by SHA-256 checksums, and the deployment workflow rejects modifications/deletions inside old release directories.

## Data contract

- `data/manifest.json`: ordered release archive for each game.
- `data/current.json`: latest IDs; validate.py checks these against the archive.
- `data/rankings/{TSE|BFE}/{release}/ranking.json`: immutable players, public Points, source CSV fields and separate historical seed Points.
- `meta.json`: period, publication date, algorithm, source names, source hashes, notes and schema version.
- `simple.csv`, `advanced.csv`: exact approved downloadable tables.

The first period is 01 Jan–01 Jul 2026 (current V2); the second is 01 Jul–01 Sep 2026 (V4.1, current V2 basis, hybrid 50/50). October publication is not the match period.

**Public Points are copied from presentation.players / CSV.** Never show V2's legacy relative seed values as the public Points. Those values are retained separately as historicalSeedPoints. The V4.1 model already used the approved current V2 displayed values for its actual prior; this site does not substitute another prior.

The approved Studio HTML files are not modified or needed at runtime. The website is a read-only viewer. Sorting, searching or navigating cannot change scores. The advanced metric values retain their game-specific exported units.

## GitHub Pages setup

Settings → Pages → Build and deployment → Source: **GitHub Actions**. Deployments are limited to main by the workflow. The repository is public; only add collaborators if you deliberately want them to have editing rights. No password or token belongs in the site.

Pages workflow follows [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Release display and languages

`data/release-display.json` stores the release number, optional tournament label and total unique match count from Studio result.meta.matches. This is presentation metadata: do not sum MapsPlayed. Rating snapshots stay immutable. UI and documentation support Russian and English; rating metric names stay in English. The language is saved locally and in shareable URLs.
