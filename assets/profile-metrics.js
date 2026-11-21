const explanationMetrics=[
 'Performance','Prestige','Result Score','Opponent Strength',
 'Confidence','Activity','Match Days','Recency','Map Score','Format Score',
];

function compareProfiles(rows,getValues){
 const profiles=new Map(rows.map(row=>[row,{strong:[],weak:[]}]));
 const values=rows.map(row=>[row,getValues(row)]);
 const relative=new Map(rows.map(row=>[row,[]]));
 for(const name of explanationMetrics){
  const scores=values.flatMap(([row,fields])=>{
   const label=String(fields[name]??'').trim();
   const number=Number(label.replace(/%$/,''));
   return label&&Number.isFinite(number)?[{row,number,percent:label.endsWith('%')}]:[];
  }).sort((a,b)=>a.number-b.number);
  if(scores.length<2||scores[0].number===scores.at(-1).number)continue;
  for(let i=0;i<scores.length;){
   let end=i+1;
   while(end<scores.length&&scores[end].number===scores[i].number)end++;
   const percentile=(i+end-1)/(2*(scores.length-1));
   for(const {row,number,percent} of scores.slice(i,end))relative.get(row).push({name,number,percent,percentile});
   i=end;
  }
 }
 for(const [row,metrics] of relative){
  metrics.sort((a,b)=>b.percentile-a.percentile);
  const strong=metrics.slice(0,2);
  const weak=metrics.slice(2).reverse().slice(0,2);
  const format=list=>list.map(({name,number,percent})=>[name,String(Number(number.toFixed(2)))+(percent?'%':'')]);
  profiles.set(row,{strong:format(strong),weak:format(weak)});
 }
 return profiles;
}

export {compareProfiles};
