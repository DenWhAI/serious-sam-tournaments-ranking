const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let running=[];
export function captureRows(){
 const table=document.getElementById('rating-table'),top=table.getBoundingClientRect().top;
 const positions=new Map([...table.querySelectorAll('tbody tr[data-player]')].map(row=>[row.dataset.player,row.getBoundingClientRect().top-top]));
 running.forEach(animation=>animation.cancel());running=[];
 return positions;
}
export function animateRows(before){
 if(!before?.size||reduced())return;
 const table=document.getElementById('rating-table'),top=table.getBoundingClientRect().top;
 for(const row of table.querySelectorAll('tbody tr[data-player]')){
  const old=before.get(row.dataset.player),offset=old==null?18:old-(row.getBoundingClientRect().top-top);
  if(Math.abs(offset)<1&&old!=null)continue;
  const animation=row.animate([{transform:`translateY(${offset}px)`,opacity:old==null?0:1},{transform:'translateY(0)',opacity:1}],{duration:1500,easing:'cubic-bezier(.22,.7,.2,1)'});
  running.push(animation);
 }
}
export function captureWheel(){document.querySelectorAll('.wheel-ghost').forEach(el=>el.remove());return [...document.querySelectorAll('.release-center,.months')].map(el=>({el,copy:el.cloneNode(true)}))}
export function animateWheel(before,direction){
 if(!before||reduced())return;
 for(const {el,copy} of before){
  if(!el.isConnected)continue;
  el.getAnimations().forEach(a=>a.cancel());
  // Ghosts are visual only; IDs and live regions belong to the real controls.
  copy.removeAttribute('id');copy.removeAttribute('aria-live');copy.querySelectorAll('[id],[aria-live]').forEach(n=>{n.removeAttribute('id');n.removeAttribute('aria-live')});
  copy.setAttribute('aria-hidden','true');copy.classList.add('wheel-ghost');
  const rect=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();
  Object.assign(copy.style,{left:rect.left-parent.left+'px',top:rect.top-parent.top+'px',width:rect.width+'px',height:rect.height+'px'});
  el.parentElement.append(copy);
  const options={duration:800,easing:'cubic-bezier(.22,.7,.2,1)'};
  const leaving=copy.animate([{transform:'translateX(0)',opacity:.7},{transform:`translateX(${-direction*100}px)`,opacity:0}],options);
  leaving.finished.then(()=>copy.remove()).catch(()=>copy.remove());
  el.animate([{transform:`translateX(${direction*100}px)`,opacity:0},{transform:'translateX(0)',opacity:1}],options);
 }
}
