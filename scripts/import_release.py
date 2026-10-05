"""Import one approved Studio snapshot plus its two CSV exports; never recalculate."""
import argparse, csv, hashlib, json, math, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
def read_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding='utf-8-sig'))
def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def import_release(snapshot, simple, advanced, start, end, published, notes='Approved Studio export'):
    slots = read_json(snapshot)['slots']
    if len(slots)!=1: raise ValueError('Export the open rating, not all saved slots.')
    slot=slots[0]; game=slot['game']; release=end
    target=ROOT/'data'/'rankings'/game/release
    if target.exists(): raise ValueError(f'Immutable release already exists: {target}')
    tables=[]
    for path in [simple,advanced]:
        with open(path,encoding='utf-8-sig',newline='') as f: tables.append(list(csv.DictReader(f)))
    presentation={p['name']:p['points'] for p in slot['presentation']['players']}
    details={p['name']:p for p in slot['result']['players']}
    seeds={p['name']:p['points'] for p in slot['players']}
    if any(set(r['PlayerID'] for r in rows)!=set(details) for rows in tables): raise ValueError('CSV player sets differ from snapshot')
    advanced_rows={r['PlayerID']:r for r in tables[1]}
    players=[]
    for row in tables[0]:
        name=row['PlayerID']; detail=details[name]; adv=advanced_rows[name]
        points=int(row['Points'])
        if points!=int(adv['Points']) or points!=math.floor(presentation[name]+.5): raise ValueError(f'Display Points mismatch: {name}')
        if abs(float(row['FinalScore'])-detail['final'])>.006: raise ValueError(f'FinalScore mismatch: {name}')
        players.append({'name':name,'rank':int(row['#']),'points':points,'historicalSeedPoints':seeds[name],
            'finalScore':detail['final'],'simple':row,'advanced':adv,
            'raw':detail.get('raw',{}),'model':detail.get('model'),
            'ratedMatches':detail.get('ratedMatches'), 'disqualificationMatches':detail.get('disqualificationMatches',0)})
    players.sort(key=lambda p:p['rank'])
    meta={'schemaVersion':1,'id':release,'game':game,'period':{'from':start,'to':end},'publishedAt':published,
          'title':f'{game} · {start} — {end}','algorithmVersion':slot['algorithmVersion'],
          'studioVersion':slot.get('studioVersion','V2'),'snapshotId':slot['id'],'baseId':slot.get('baseId'),
          'sources':slot['sources'],'notes':notes,'pointsPolicy':'approved-presentation',
          'provenance':[{'file':pathlib.Path(p).name,'sha256':hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()} for p in [snapshot,simple,advanced]]}
    manifest_path=ROOT/'data'/'manifest.json'
    manifest=read_json(manifest_path) if manifest_path.exists() else {'schemaVersion':1,'games':{'TSE':[],'BFE':[]}}
    for old in manifest['games'][game]:
        if old['id']==release: raise ValueError('Duplicate release')
    write_json(target/'ranking.json',{'schemaVersion':1,'players':players})
    write_json(target/'meta.json',meta)
    for path,name in [(simple,'simple.csv'),(advanced,'advanced.csv')]:
        (target/name).write_bytes(pathlib.Path(path).read_bytes())
    manifest['games'][game].append({'id':release,'from':start,'to':end,'path':f'data/rankings/{game}/{release}'})
    manifest['games'][game].sort(key=lambda r:r['to'])
    write_json(manifest_path,manifest)
    write_json(ROOT/'data'/'current.json',{g:rows[-1]['id'] if rows else None for g,rows in manifest['games'].items()})
    display_path=ROOT/'data'/'release-display.json'
    display=read_json(display_path) if display_path.exists() else {}
    display.setdefault(game,{})[release]={'number':len(manifest['games'][game]),'label':'','matches':slot['result'].get('meta',{}).get('matches')}
    write_json(display_path,display)
    return len(players)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for k in ['snapshot','simple','advanced','start','end','published']: p.add_argument('--'+k,required=True)
    p.add_argument('--notes',default='Approved Studio export')
    a=p.parse_args(); print(f'Imported {import_release(a.snapshot,a.simple,a.advanced,a.start,a.end,a.published,a.notes)} players.')
