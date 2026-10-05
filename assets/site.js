import { renderDocs } from './system.js';
import {strings,applyLanguage} from './i18n.js';
let lang='en',display={};
try{lang=localStorage.getItem('ranking-language')==='ru'?'ru':'en'}catch{}
const t=key=>strings[lang][key];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=n=>n>0?'+'+n:String(n);
const delta=(n,empty='—')=>`<small class="rating-delta ${n==null||n===0?'delta-flat':n>0?'delta-up':'delta-down'}">${n==null?empty:signed(n)}</small>`;
const month=d=>new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'});
const period=r=>`${r.from.slice(8)} ${month(r.from)} — ${r.to.slice(8)} ${month(r.to)} ${r.to.slice(0,4)}`;
let manifest,game='TSE',index=0,view='simple',sort='Points',direction=-1,rows=[],meta,base=[],loadId=0;
const cache=new Map();
async function json(url){if(!cache.has(url))cache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error(`Could not load ${url} (${r.status})`);return r.json()}).catch(e=>{cache.delete(url);throw e}));return cache.get(url)}
function stateURL(){const p=new URLSearchParams({game,release:manifest.games[game][index].id,view,lang});history.replaceState(null,'','?'+p+(location.hash.startsWith('#game=')?'':location.hash))}
function readURL(){const p=new URLSearchParams(location.hash.startsWith('#game=')?location.hash.slice(1):location.search);if(['ru','en'].includes(p.get('lang')))lang=p.get('lang');applyLanguage(lang);game=p.get('game')==='BFE'?'BFE':'TSE';const list=manifest.games[game];const found=list.findIndex(r=>r.id===p.get('release'));index=found>=0?found:list.length-1;view=p.get('view')==='advanced'?'advanced':'simple';}
async function load(){
 const request=++loadId;const list=manifest.games[game],release=list[index];
 document.documentElement.dataset.game=game;$('game').value=game;$('game-name').textContent=game==='TSE'?'SERIOUS SAM HD: THE SECOND ENCOUNTER':'SERIOUS SAM 3: BFE';
 $('previous').disabled=index===0;$('next').disabled=index===list.length-1;
 $('ranking-title').textContent=period(release);$('release-kind').textContent='';
 $('archive').innerHTML=list.map((r,i)=>`<option value="${i}" ${i===index?'selected':''}>${period(r)}</option>`).join('');
 const around=(date,offset)=>{const d=new Date(date+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})};
 $('months-before').innerHTML=[-3,-2,-1].map(n=>`<span>${around(release.from,n)}</span>`).join('');
 $('months-after').innerHTML=[1,2,3].map(n=>`<span>${around(release.to,n)}</span>`).join('');
 const center=document.querySelector('.release-center');center.classList.remove('animate');requestAnimationFrame(()=>center.classList.add('animate'));
 $('status').textContent=t('loading');$('rating-table').hidden=true;
 try{
  const [rating,metadata,previous]=await Promise.all([json(release.path+'/ranking.json'),json(release.path+'/meta.json'),index?json(list[index-1].path+'/ranking.json'):Promise.resolve({players:[]})]);
  if(request!==loadId)return;rows=rating.players;meta=metadata;base=previous.players;
  $('json-download').href=release.path+'/ranking.json';
  document.title=`${game} · ${period(release)} | Serious Sam Tournaments`;
  $('status').textContent='';$('rating-table').hidden=false;stateURL();render();renderDocs(meta,lang);releaseSummary();
 }catch(e){if(request!==loadId)return;$('status').replaceChildren(document.createTextNode(t('failed')));const retry=document.createElement('button');retry.textContent=t('retry');retry.onclick=load;$('status').append(retry);console.error(e)}
}
const previous=r=>base.find(p=>p.name.toLowerCase()===r.name.toLowerCase());
function rankChange(r){const p=previous(r);return p?p.rank-r.rank:null}
function value(r,key){if(key==='RankChange')return rankChange(r);if(key==='#')return r.rank;if(key==='PlayerID')return r.name;if(key==='Points')return r.points;return r[view][key]}
function numeric(v){return v!==null&&v!==''&&Number.isFinite(Number(v))}
function expl(text){
 const tags=[...text.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]);
 const badges=tags.map(t=>{const division=t.startsWith('Division ');return `<span class="arch ${division?'division-badge division-'+esc(t.slice(9).replace('/','')):'a-balanced'}">${esc(t)}</span>`}).join('');
 const body=text.replace(/\[[^\]]+\]\s*/g,'');
 return `<div class="explanation-badges">${badges}</div>`+body.split('; ').map(t=>`<div class="expl-line">${esc(t).replace(/^STRONG /,'<span class="tag-s">STRONG</span> ').replace(/^WEAK /,'<span class="tag-w">WEAK</span> ')}</div>`).join('');
}
function cell(r,key){
 const v=value(r,key),raw=r.raw||{};
 if(key==='RankChange')return `<td class="movement" title="${t('movement')}">${delta(v)}</td>`;
 if(key==='#')return `<td class="rank">${String(r.rank).padStart(2,'0')}</td>`;
 if(key==='PlayerID')return `<td class="pname">${esc(r.name)}</td>`;
 if(key==='Points'){const p=previous(r);return `<td class="pts points-cell"><span class="points-inline"><span>${r.points}</span>${base.length?delta(p?r.points-p.points:null,'new'):''}</span><div class="ptsbar" style="width:${Math.max(1,r.points/30)}%"></div></td>`}
 if(key==='Explanation')return `<td class="expl">${expl(v)}</td>`;
 if(key==='W-L')return `<td class="mono wl">${esc(v)}</td>`;
 if(key==='Wins'||key==='Losses'||key==='Draws')return `<td class="mono"><span class="${key==='Wins'?'w':key==='Losses'?'l':'d'}">${esc(v)}</span></td>`;
 if(key==='Maps Stats'||key==='Format Stats')return `<td class="ms">${esc(v).split('; ').map(x=>x.replace(/^(Best|Worst|Freq):/,'<span class="lbl">$1</span>')).join('<br>')}</td>`;
 if(view==='advanced'){
  const captions={'Result Score':['Σ',raw.result],'Format Score':['avg',raw.fmt],'Map Score':['avg',raw.map],'Recency':['avg',raw.rec]};
  const c=captions[key];return `<td><div class="nv">${esc(v)}</div>${c&&Number.isFinite(c[1])?`<div class="rv">${c[0]} ${c[1].toFixed(2)}</div>`:''}</td>`;
 }
 return `<td class="mono">${esc(v)}</td>`;
}
function render(){
 $('simple').setAttribute('aria-pressed',view==='simple');$('advanced').setAttribute('aria-pressed',view==='advanced');
 $('table-title').textContent=view==='simple'?t('standings'):t('breakdown');
 const cols=Object.keys(rows[0]?.[view]||{});if(!cols.includes(sort))sort='Points';
 $('rating-table').className=view==='advanced'?'advanced-table':'';
 $('download').href=manifest.games[game][index].path+'/'+view+'.csv';
 const th=document.querySelector('thead');th.innerHTML='<tr>'+cols.map(k=>`<th scope="col" aria-sort="${sort===k?(direction<0?'descending':'ascending'):'none'}"><button data-sort="${esc(k)}" title="${t('sort')} ${esc(k)}">${k==='RankChange'?'Δ RANK':esc(k)}${sort===k?(direction<0?' ↓':' ↑'):''}</button></th>`).join('')+'</tr>';
 th.querySelectorAll('button').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:(b.dataset.sort==='PlayerID'||b.dataset.sort==='#'?1:-1);sort=b.dataset.sort;render()});
 const query=$('search').value.trim().toLowerCase();const filtered=rows.filter(r=>r.name.toLowerCase().includes(query));
 filtered.sort((a,b)=>{const x=value(a,sort),y=value(b,sort);if(x==null||y==null)return x==null?(y==null?a.rank-b.rank:1):-1;const diff=numeric(x)&&numeric(y)?Number(x)-Number(y):String(x).localeCompare(String(y));return diff*direction||a.rank-b.rank});
 document.querySelector('tbody').innerHTML=filtered.length?filtered.map(r=>`<tr class="${r.rank===1?'r1':''}">${cols.map(k=>cell(r,k)).join('')}</tr>`).join(''):`<tr><td colspan="${cols.length}">${t('noPlayers')}: “${esc($('search').value)}”.</td></tr>`;
 $('player-count').textContent=`${filtered.length} / ${rows.length} ${t('players').toUpperCase()}`;
}
$('game').onchange=()=>{const id=manifest.games[game][index].id;game=$('game').value;index=manifest.games[game].findIndex(r=>r.id===id);if(index<0)index=manifest.games[game].length-1;sort='Points';direction=-1;$('search').value='';load()};
$('previous').onclick=()=>{if(index>0){index--;load()}};$('next').onclick=()=>{if(index<manifest.games[game].length-1){index++;load()}};
$('archive').onchange=()=>{index=Number($('archive').value);load()};
for(const name of ['simple','advanced'])$(name).onclick=()=>{view=name;sort='Points';direction=-1;if(rows.length){stateURL();render()}};
$('search').oninput=()=>{if(rows.length)render()};
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#game=')){readURL();load()}});
function releaseSummary(){const r=manifest.games[game][index],d=display[game]?.[r.id]||{};$('release-kind').textContent=[`${t('release')} №${d.number||index+1}`,d.label,d.matches!=null?`${d.matches} ${t('matches')}`:null,`${rows.length} ${t('players')}`].filter(Boolean).join(' · ')}
$('language').onchange=()=>{lang=$('language').value;try{localStorage.setItem('ranking-language',lang)}catch{}applyLanguage(lang);if(meta){stateURL();render();renderDocs(meta,lang);releaseSummary()}};
try{[manifest,display]=await Promise.all([json('data/manifest.json'),json('data/release-display.json')]);readURL();await load()}catch(e){$('status').textContent=t('archiveFailed');console.error(e)}
