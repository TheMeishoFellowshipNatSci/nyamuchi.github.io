const NOMINAL=new Set(['Det','D','POSS','A','NUM','N','PROPN','PRON']);
const AUXILIARY=new Set(['MODAL','AUX','NEG','ADV']);

export function groupKyuRi(tokens){
 const groups=[];
 for(let i=0;i<tokens.length;){
  const t=tokens[i];
  if(t.pos==='PUNCT'){groups.push(make('PUNCT',[t]));i++;continue;}
  if(t.pos==='P'){const parts=[t];i++;while(i<tokens.length&&NOMINAL.has(tokens[i].pos)){if(startsNewNP(parts,tokens[i]))break;parts.push(tokens[i++]);}groups.push(make('PP',parts,{head:t.lemma,particle:t.lemma}));continue;}
  if(t.pos==='INF'){groups.push(make('INF',[t],{head:'to'}));i++;continue;}
  if(NOMINAL.has(t.pos)){const parts=[];if(t.pos==='PRON'){parts.push(t);i++;}else{while(i<tokens.length&&NOMINAL.has(tokens[i].pos)&&tokens[i].pos!=='PRON'){if(parts.length&&startsNewNP(parts,tokens[i]))break;parts.push(tokens[i++]);}}groups.push(make('NP',parts,{head:lastNominal(parts)?.lemma}));continue;}
  if(['MODAL','AUX','NEG'].includes(t.pos)){const parts=[];while(i<tokens.length&&AUXILIARY.has(tokens[i].pos))parts.push(tokens[i++]);groups.push(make('I',parts,{head:parts.find(x=>['MODAL','AUX'].includes(x.pos))?.lemma??parts[0].lemma}));continue;}
  if(t.pos==='V'){groups.push(make('V',[t],{head:t.lemma,frames:t.frames}));i++;continue;}
  if(t.pos==='A'){const parts=[];while(i<tokens.length&&['ADV','A'].includes(tokens[i].pos))parts.push(tokens[i++]);groups.push(make('AP',parts,{head:parts.at(-1).lemma}));continue;}
  if(t.pos==='ADV'){groups.push(make('AdvP',[t],{head:t.lemma}));i++;continue;}
  if(t.pos==='C'){groups.push(make('C',[t],{head:t.lemma}));i++;continue;}
  if(t.pos==='CONJ'){groups.push(make('CONJ',[t],{head:t.lemma}));i++;continue;}
  groups.push(make('X',[t],{head:t.lemma}));i++;
 }
 return groups;
}
function startsNewNP(parts,next){const hasHead=parts.some(x=>['N','PROPN','PRON'].includes(x.pos));return hasHead&&['Det','D','PROPN','PRON'].includes(next.pos);}
function lastNominal(parts){return [...parts].reverse().find(x=>['N','PROPN','PRON'].includes(x.pos))??parts.at(-1)}
function make(kind,parts,extra={}){const surface=join(parts);return {kind,phraseCategory:kind,surface,content:surface,base:extra.head??parts.at(-1)?.lemma??'',particle:extra.particle??null,markerType:kind==='C'?'complementizer':null,complementCategory:null,parts,...extra}}
function join(parts){const seen=new Set();const out=[];for(const p of parts){const key=`${p.rawIndex}:${p.surface}`;if(p.expansionIndex>0&&seen.has(key))continue;seen.add(key);out.push(p.surface)}return out.join(' ')}
