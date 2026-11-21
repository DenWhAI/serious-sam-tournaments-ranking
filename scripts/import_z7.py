"""Publish the six Z7 tables exported by Rating Studio without recalculating."""
import csv
from argparse import ArgumentParser
from io import StringIO
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT.parent / 'System Files/v7/z7-site-export.json'
PERIODS = {
    '0726': ('2026-01-01', '2026-07-01'),
    '0926': ('2026-07-18', '2026-09-01'),
    '1126': ('2026-09-18', '2026-11-15'),
}
RELEASE_LABELS = {
    '0726': {'labels': {'en': '2026 until Summer Tournament', 'ru': '2026 до Летнего Турнира'}, 'weekends': 'SW 154 — SW 171'},
    '0926': {'labels': {'en': 'Only Summer Tournament 2026', 'ru': 'Только Летний Турнир 2026'}},
    '1126': {'labels': {'en': '1st release after Summer Tournament 2026', 'ru': '1-й выпуск после Летнего Турнира 2026'}, 'weekends': 'SW 172 — SW 179'},
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def table(source, players, name):
    rows = {row['PlayerID']: row for row in csv.DictReader(StringIO(source))}
    assert rows.keys() == {player['name'] for player in players}
    result = []
    for player in players:
        row = rows[player['name']]
        assert int(row['Points']) == player['points']
        delta = '' if player['previousRank'] is None else str(player['previousRank'] - player['rank'])
        columns = {'RankChange': delta, '#': str(player['rank'])}
        for key, value in row.items():
            if key in ('RankChange', '#', 'Robustness', 'SSD'):
                continue
            if key == 'FinalScore':
                assert abs(float(value)-player['finalScore']) < .001
                columns['Raw Score'] = value
            elif key == 'Consistency':
                columns['Match Days'] = str(player['matchDays'])
            elif key == 'RecencyAvg':
                columns['Recency'] = value
            else:
                columns[key] = value
        player[name] = columns
        result.append(columns)
    return result


def main(input_path=INPUT, version='Z7', game_filter=None, revision=None):
    data = read(input_path)
    base = ROOT / 'data'
    manifest = read(base / 'manifest.json')
    display = read(base / 'release-display.json')
    current = read(base / 'current.json')
    for game, editions in data.items():
        if game_filter and game != game_filter:
            continue
        old = manifest['games'][game]
        releases = []
        for number, (code, period) in enumerate(PERIODS.items(), 1):
            start, end = period
            release = f'{end}-{version.lower().replace(".", "")}'
            if revision is not None:
                release += f'-r{revision}'
            path = Path('data/rankings') / game / release
            target = ROOT / path
            if target.exists():
                raise FileExistsError(f'Release already exists: {release}')
            source = editions[code]
            players = source['players']
            target.mkdir(parents=True)
            for view in ('simple', 'advanced'):
                rows = table(source[view], players, view)
                with (target / f'{view}.csv').open('w', encoding='utf-8', newline='') as stream:
                    writer = csv.DictWriter(stream, rows[0], lineterminator='\n')
                    writer.writeheader()
                    writer.writerows(rows)
            for player in players:
                player.pop('previousRank')
            write(target / 'ranking.json', {'schemaVersion': 1, 'players': players})
            write(target / 'meta.json', {
                'schemaVersion': 1, 'id': release, 'game': game, 'period': {'from': start, 'to': end},
                'publishedAt': '2026-11-21' if version == '10.2' else '2026-11-20',
                'title': f'{game} · {start} — {end}', 'algorithmVersion': version,
                'studioVersion': 'V7', 'baseId': releases[-1]['id'] if releases else None,
                'sources': source['sources'], 'pointsPolicy': 'fixed-smooth-low-tail-floor-1',
                'divisionCorrection': False,
            })
            aliases = [alias for previous in old if previous['to'] == end
                       for alias in [previous['id'], *previous.get('aliases', [])] if alias != release]
            releases.append({'id': release, 'from': start, 'to': end, 'path': path.as_posix(), 'aliases': list(dict.fromkeys(aliases))})
            display.setdefault(game, {})[release] = {'number': number, 'matches': source['matches'], **RELEASE_LABELS[code]}
        current[game] = releases[-1]['id']
        manifest['games'][game] = releases
    write(base / 'manifest.json', manifest)
    write(base / 'current.json', current)
    write(base / 'release-display.json', display)


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--input', type=Path, default=INPUT)
    parser.add_argument('--version', choices=['Z7', 'V9.2', '10.2'], default='Z7')
    parser.add_argument('--game', choices=['BFE', 'TSE'])
    parser.add_argument('--revision', type=int)
    args = parser.parse_args()
    main(args.input, args.version, args.game, args.revision)
