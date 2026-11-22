import {captureRows,animateRows,captureWheel,animateWheel} from './motion.js';
import { renderDocs } from './system.js?v=20261122-simple-method';
import {strings,applyLanguage} from './i18n.js?v=20261121-date-type';
import {compareProfiles} from './profile-metrics.js?v=20261121-profile-2';
let lang='en',display={};

const t=key=>strings[lang][key];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=n=>n>0?'+'+n:String(n);
const delta=(n,empty='—')=>`<small class="rating-delta ${n==null||n===0?'delta-flat':n>0?'delta-up':'delta-down'}">${n==null?empty:signed(n)}</small>`;
const month=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'});
const period=r=>`${r.from.slice(8)} ${month(r.from)} — ${r.to.slice(8)} ${month(r.to)} ${r.to.slice(0,4)}`;
const periodMarkup=r=>`<span class="period-start">${esc(r.from.slice(8)+' '+month(r.from)+' — ')}</span><span class="period-end">${esc(r.to.slice(8)+' '+month(r.to)+' '+r.to.slice(0,4))}</span>`;
let manifest,game='BFE',index=0,view='simple',sort='Points',direction=-1,rows=[],meta,base=[],loadId=0;
let profiles=new Map();
const cache=new Map();
async function json(url){if(!cache.has(url))cache.set(url,fetch(url+(url.includes('?')?'&':'?')+'build=20261121-rating-103').then(r=>{if(!r.ok)throw Error(`Could not load ${url} (${r.status})`);return r.json()}).catch(e=>{cache.delete(url);throw e}));return cache.get(url)}
function stateURL(){const p=new URLSearchParams({game,release:manifest.games[game][index].id,view,lang});history.replaceState(null,'','?'+p+(location.hash.startsWith('#game=')?'':location.hash))}
function readURL(){const p=new URLSearchParams(location.hash.startsWith('#game=')?location.hash.slice(1):location.search);lang=p.get('lang')==='ru'?'ru':'en';applyLanguage(lang);game=p.get('game')==='TSE'?'TSE':'BFE';const list=manifest.games[game];const found=list.findIndex(r=>r.id===p.get('release')||r.aliases?.includes(p.get('release')));index=found>=0?found:list.length-1;view=p.get('view')==='advanced'?'advanced':'simple';}
async function load(motion=null){
 const request=++loadId;const list=manifest.games[game],release=list[index];
 document.documentElement.dataset.game=game;$('game').value=game;$('game-logo').src=`assets/logos/Serious${game}.png`;
 $('previous').disabled=index===0;$('next').disabled=index===list.length-1;
 $('ranking-title').innerHTML=periodMarkup(release);$('release-kind').textContent='';
 const around=(date,offset)=>{const d=new Date(date+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})};
 $('months-before').innerHTML=[-3,-2,-1].map(n=>`<span>${around(release.from,n)}</span>`).join('');
 $('months-after').innerHTML=[1,2,3].map(n=>`<span>${around(release.to,n)}</span>`).join('');

 $('status').textContent=motion?'':t('loading');$('rating-table').hidden=!motion;
 try{
  const [rating,metadata,previous]=await Promise.all([json(release.path+'/ranking.json'),json(release.path+'/meta.json'),index?json(list[index-1].path+'/ranking.json'):Promise.resolve({players:[]})]);
  if(request!==loadId)return;rows=rating.players;meta=metadata;base=previous.players;
  profiles=compareProfiles(rows,r=>{
   const prestige=r.historicalSeedPoints??r.raw?.prestige;
   return {...r.advanced,'Match Days':r.matchDays??r.advanced?.['Match Days'],
    Prestige:prestige>0?String(Math.round(prestige)):''};
  });
  $('json-download').href=release.path+'/ranking.json';
  document.title=`${game} · ${period(release)} | Serious Sam Tournaments`;
  $('status').textContent='';$('rating-table').hidden=false;stateURL();render();renderDocs(meta,lang);releaseSummary();if(motion){animateRows(motion.rows);animateWheel(motion.wheel,motion.direction)}
 }catch(e){if(request!==loadId)return;$('rating-table').hidden=true;$('status').replaceChildren(document.createTextNode(t('failed')));const retry=document.createElement('button');retry.textContent=t('retry');retry.onclick=()=>load();$('status').append(retry);console.error(e)}
}
const previous=r=>base.find(p=>p.name.toLowerCase()===r.name.toLowerCase());
function rankChange(r){const p=previous(r);return p?p.rank-r.rank:null}
function pointsChange(r){const p=previous(r);return p?r.points-p.points:null}
function value(r,key){if(key==='PointsChange')return pointsChange(r);if(key==='RankChange')return rankChange(r);if(key==='#')return r.rank;if(key==='PlayerID')return r.name;if(key==='Points')return r.points;return r[view][key]}
function numeric(v){return v!==null&&v!==''&&Number.isFinite(Number(v))}
const explanationTags=text=>[...String(text??'').matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
const explanationItems=(items,format)=>items.map(([name,v])=>format(name,v)).join(', ')||'—';
function expl(text,profile){
 const tags=explanationTags(text);
 const badges=tags.map(t=>{const division=t.startsWith('Division ');return `<span class="arch ${division?'division-badge division-'+esc(t.slice(9).replace('/','')):'a-balanced'}">${esc(t)}</span>`}).join('');
 const title=lang==='ru'?'Сравнение показателей с другими игроками выпуска':'Metrics compared with other players in the release';
 const line=(label,items)=>`<div class="expl-line" title="${title}"><span class="${label==='STRONG'?'tag-s':'tag-w'}">${label}</span> ${explanationItems(items,(name,v)=>`${esc(name)} (${esc(v)})`)}</div>`;
 return `<div class="explanation-badges">${badges}</div>`+line('STRONG',profile.strong)+line('WEAK',profile.weak);
}
function cell(r,key){
 const v=key==='Format Stats'?(display[game]?.[manifest.games[game][index].id]?.formatStats?.[r.name]??value(r,key)):value(r,key),raw=r.raw||{};
 if(key==='PointsChange')return `<td class="points-change" title="${t('pointsMovement')}">${delta(v,base.length?'new':'—')}</td>`;
 if(key==='RankChange')return `<td class="movement" title="${t('movement')}">${delta(v)}</td>`;
 if(key==='#')return `<td class="rank">${String(r.rank).padStart(2,'0')}</td>`;
 if(key==='PlayerID')return `<td class="pname">${esc(r.name)}</td>`;
 if(key==='Points')return `<td class="pts points-cell"><span>${r.points}</span><div class="ptsbar" style="width:${Math.min(100,Math.max(1,r.points/30))}%"></div></td>`;
 if(key==='Raw Score')return `<td class="mono">${r.finalScore.toFixed(3)}</td>`;
 if(key==='Explanation')return `<td class="expl">${expl(v,profiles.get(r))}</td>`;
 if(key==='W-L')return `<td class="mono wl">${esc(v)}</td>`;
 if(key==='Wins'||key==='Losses'||key==='Draws')return `<td class="mono"><span class="${key==='Wins'?'w':key==='Losses'?'l':'d'}">${esc(v)}</span></td>`;
 if(key==='Maps Stats'||key==='Format Stats')return `<td class="ms">${esc(v).split('; ').map(x=>x.replace(/^(Best|Worst|Freq):/,'<span class="lbl">$1</span>').replace(/\(([+−-]?\d+(?:\.\d+)?)\)/g,(_,n)=>`(<span class="${Number(n.replace('−','-'))>0?'pos':Number(n.replace('−','-'))<0?'neg':'neutral'}">${n}</span>)`)).join('<br>')}</td>`;
 if(view==='advanced'){
  const shown=key==='Recency'&&numeric(v)?Number(Number(v).toFixed(2)):v;
  const caption=key==='Result Score'&&Number.isFinite(raw.result)
   ?`<div class="rv">${r.model?.resultScore!=null?'μ':'Σ'} ${raw.result.toFixed(2)}</div>`:'';
  return `<td><div class="nv">${esc(shown)}</div>${caption}</td>`;
 }
 return `<td class="mono">${esc(v)}</td>`;
}
function render(){
 $('simple').setAttribute('aria-pressed',view==='simple');$('advanced').setAttribute('aria-pressed',view==='advanced');
 $('table-title').textContent=view==='simple'?t('standings'):t('breakdown');
 const cols=Object.keys(rows[0]?.[view]||{}).filter(key=>key!=='Success Score');cols.splice(cols.indexOf('Points')+1,0,'PointsChange');if(!cols.includes(sort))sort='Points';
 $('rating-table').className=view==='advanced'?'advanced-table':'';
 $('download').href=manifest.games[game][index].path+'/'+view+'.csv';
 const th=document.querySelector('thead');th.innerHTML='<tr>'+cols.map(k=>`<th scope="col" aria-sort="${sort===k?(direction<0?'descending':'ascending'):'none'}"><button data-sort="${esc(k)}" title="${t('sort')} ${k==='PointsChange'?'Δ Points':esc(k)}"${k==='PointsChange'?' aria-label="Δ Points"':''}>${k==='RankChange'?'Δ RANK':k==='PointsChange'?'<span aria-hidden="true">Δ</span>':esc(k)}${sort===k?(direction<0?' ↓':' ↑'):''}</button></th>`).join('')+'</tr>';
 th.querySelectorAll('button').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:(b.dataset.sort==='PlayerID'||b.dataset.sort==='#'?1:-1);sort=b.dataset.sort;render()});
 const query=$('search').value.trim().toLowerCase();const filtered=rows.filter(r=>r.name.toLowerCase().includes(query));
 filtered.sort((a,b)=>{const x=value(a,sort),y=value(b,sort);if(x==null||y==null)return x==null?(y==null?a.rank-b.rank:1):-1;const parse=v=>sort==='Confidence'?Number(String(v).replace(/%$/,'')):numeric(v)?Number(v):NaN;const aNumber=parse(x),bNumber=parse(y);const diff=Number.isFinite(aNumber)&&Number.isFinite(bNumber)?aNumber-bNumber:String(x).localeCompare(String(y));return diff*direction||a.rank-b.rank});
 document.querySelector('tbody').innerHTML=filtered.length?filtered.map(r=>`<tr data-player="${esc(r.name)}" class="${r.rank===1?'r1':''}">${cols.map(k=>cell(r,k)).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}">${t('noPlayers')}: “${esc($('search').value)}”.</td></tr>`;
 $('player-count').textContent=`${filtered.length} / ${rows.length} ${t('players').toUpperCase()}`;
}
$('game').onchange=()=>{const id=manifest.games[game][index].id;game=$('game').value;index=manifest.games[game].findIndex(r=>r.id===id);if(index<0)index=manifest.games[game].length-1;sort='Points';direction=-1;$('search').value='';load()};
function changeRelease(target){if(target===index||target<0||target>=manifest.games[game].length)return;const motion={rows:captureRows(),wheel:captureWheel(),direction:target>index?1:-1};index=target;load(motion)}
$('previous').onclick=()=>changeRelease(index-1);$('next').onclick=()=>changeRelease(index+1);
for(const name of ['simple','advanced'])$(name).onclick=()=>{view=name;sort='Points';direction=-1;if(rows.length){stateURL();render()}};
$('search').oninput=()=>{if(rows.length)render()};
$('download').onclick=event=>{
 if(view!=='simple'||!rows.length||$('status').textContent)return;
 event.preventDefault();
 const columns=Object.keys(rows[0].simple);
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const records=rows.map(r=>columns.map(key=>{
  const value=r.simple[key];
  if(key!=='Explanation')return value;
  const tags=explanationTags(value).map(tag=>'['+tag+']');
  const {strong,weak}=profiles.get(r);
  const items=list=>explanationItems(list,(name,v)=>name+' ('+v+')');
  return [...tags,'STRONG '+items(strong)+'; WEAK '+items(weak)].join(' ');
 }));
 const csv=[columns,...records].map(record=>record.map(quote).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');
 link.href=url;link.download='simple.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#game=')){readURL();load()}});
function releaseSummary(){const r=manifest.games[game][index],d=display[game]?.[r.id]||{};$('release-kind').textContent=[`${t('release')} №${d.number||index+1}`,(d.labels?.[lang]||d.label),d.weekends,d.matches!=null?`${d.matches} ${t('matches')}`:null,`${rows.length} ${t('players')}`].filter(Boolean).join(' · ')}
$('language').onchange=()=>{lang=$('language').value;try{localStorage.setItem('ranking-language',lang)}catch{}applyLanguage(lang);if(meta){stateURL();render();renderDocs(meta,lang);releaseSummary()}};
try{[manifest,display]=await Promise.all([json('data/manifest.json'),json('data/release-display.json')]);readURL();await load()}catch(e){$('status').textContent=t('archiveFailed');console.error(e)}
