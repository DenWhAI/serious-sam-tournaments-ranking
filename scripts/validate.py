"""Validate public values against the exact approved CSVs and frozen checksums."""
import csv, hashlib, json, math, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(p): return json.loads(p.read_text(encoding='utf-8'))
manifest=read(ROOT/'data/manifest.json'); current=read(ROOT/'data/current.json')
total=0
for game,releases in manifest['games'].items():
    assert releases and releases==sorted(releases,key=lambda r:r['to'])
    assert len({r['id'] for r in releases})==len(releases)
    assert current[game]==releases[-1]['id']
    for release in releases:
        path=ROOT/release['path']; meta=read(path/'meta.json'); players=read(path/'ranking.json')['players']
        assert path.resolve().is_relative_to((ROOT/'data/rankings').resolve())
        assert meta['game']==game and meta['id']==release['id']
        assert release['from']<release['to']
        assert [p['rank'] for p in players]==list(range(1,len(players)+1))
        assert len({p['name'].lower() for p in players})==len(players)
        assert [p['points'] for p in players]==sorted([p['points'] for p in players],reverse=True)
        for table in ['simple','advanced']:
            with (path/(table+'.csv')).open(encoding='utf-8-sig',newline='') as f: csvrows=list(csv.DictReader(f))
            lookup={r['PlayerID']:r for r in csvrows}
            assert set(lookup)=={p['name'] for p in players}
            for p in players:
                assert p[table]==lookup[p['name']]
                assert p['points']==int(lookup[p['name']]['Points'])
                assert math.isfinite(p['finalScore'])
                if meta['algorithmVersion'] in ('Z7','V9.2','10.2'):
                    assert p['points']>=1
                    assert {'Performance','Confidence','Activity','Match Days'}<=p['advanced'].keys()
                    assert 'Consistency' not in p['advanced']
                else:
                    assert 0<=p['points']<=3000
                assert int(p['simple']['W-L'])==int(p['simple']['Wins'])-int(p['simple']['Losses'])
                score='Raw Score' if meta['algorithmVersion'] in ('Z7','V9.2','10.2') else 'FinalScore'
                assert abs(float(p['simple'][score])-p['finalScore'])<.006
        total+=len(players)
lock=ROOT/'data/checksums.json'
if lock.exists():
    for relative,digest in read(lock).items():
        payload=(ROOT/relative).read_bytes()
        exact=hashlib.sha256(payload).hexdigest()
        lf=hashlib.sha256(payload.replace(b'\r\n',b'\n')).hexdigest()
        assert digest in (exact,lf), f'Historical file modified: {relative}'
print(f'Validated {total} player records in {sum(map(len,manifest["games"].values()))} releases; public Points match all CSVs.')
