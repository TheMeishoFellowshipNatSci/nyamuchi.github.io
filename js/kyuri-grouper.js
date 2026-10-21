const NOMINAL = new Set(['D','POSS','A','NUM','N','PROPN','PRON']);
const AUXILIARY = new Set(['MODAL','AUX','NEG','ADV']);

export function groupKyuRi(tokens) {
  const groups=[];
  for(let i=0;i<tokens.length;){
    const t=tokens[i];
    if(t.pos==='PUNCT'){groups.push(makeGroup('PUNCT',[t]));i++;continue;}
    if(t.pos==='P'){
      const parts=[t]; i++;
      while(i<tokens.length && NOMINAL.has(tokens[i].pos)){parts.push(tokens[i++]);}
      groups.push(makeGroup('PP',parts,{head:t.lemma,particle:t.lemma})); continue;
    }
    if(t.pos==='INF'){
      groups.push(makeGroup('INF',[t],{head:'to'}));i++;continue;
    }
    if(NOMINAL.has(t.pos)){
      const parts=[];
      if(t.pos==='PRON'){parts.push(t);i++;}
      else while(i<tokens.length && NOMINAL.has(tokens[i].pos) && tokens[i].pos!=='PRON'){parts.push(tokens[i++]);}
      groups.push(makeGroup('NP',parts,{head:lastNominal(parts)?.lemma}));continue;
    }
    if(['MODAL','AUX','NEG'].includes(t.pos)){
      const parts=[]; while(i<tokens.length && AUXILIARY.has(tokens[i].pos)){parts.push(tokens[i++]);}
      groups.push(makeGroup('I',parts,{head:parts.find(x=>['MODAL','AUX'].includes(x.pos))?.lemma??parts[0].lemma}));continue;
    }
    if(t.pos==='V'){groups.push(makeGroup('V',[t],{head:t.lemma,frames:t.frames}));i++;continue;}
    if(t.pos==='A'){const parts=[];while(i<tokens.length&&['ADV','A'].includes(tokens[i].pos))parts.push(tokens[i++]);groups.push(makeGroup('AP',parts,{head:parts.at(-1).lemma}));continue;}
    if(t.pos==='ADV'){groups.push(makeGroup('AdvP',[t],{head:t.lemma}));i++;continue;}
    if(t.pos==='C'){groups.push(makeGroup('C',[t],{head:t.lemma}));i++;continue;}
    if(t.pos==='CONJ'){groups.push(makeGroup('CONJ',[t],{head:t.lemma}));i++;continue;}
    groups.push(makeGroup('X',[t],{head:t.lemma}));i++;
  }
  return groups;
}

function lastNominal(parts){return [...parts].reverse().find(x=>['N','PROPN','PRON'].includes(x.pos))??parts.at(-1);}
function makeGroup(category,parts,extra={}){
  const surface=joinSurface(parts);
  return {kind:category,phraseCategory:category,surface,content:surface,base:extra.head??parts.at(-1)?.lemma??'',particle:extra.particle??null,markerType:category==='C'?'complementizer':null,complementCategory:null,parts,...extra};
}
function joinSurface(parts){let s='';for(const p of parts){if(!s)s=p.surface;else if(/^[.,!?;:)]$/.test(p.surface))s+=p.surface;else if(p.expansionIndex>0&&p.surface===parts[parts.indexOf(p)-1]?.surface)continue;else s+=' '+p.surface;}return s;}
