import { lookupKyuRi } from './kyuri-dictionary.js';

const AUX = new Set(['be','have','do']);
const MODAL = new Set(['can','could','may','might','must','shall','should','will','would','ought']);
const NEG = new Set(['not',"n't",'never']);
const DET = new Set(['a','an','the','this','that','these','those','some','any','each','every','either','neither','another','no']);
const PREP = new Set(['about','above','across','after','against','along','among','around','at','before','behind','below','beneath','beside','between','beyond','by','despite','during','except','for','from','in','inside','into','near','of','off','on','onto','out','outside','over','past','since','through','throughout','to','toward','under','underneath','until','up','upon','with','within','without']);
const DEGREE = new Set(['very','quite','rather','too','so','extremely','highly','fairly']);
const CLAUSE = new Set(['that','whether','if','because','although','though','unless','while','when','before','after','since']);
const WH = new Set(['who','whom','whose','what','which','where','when','why','how']);

export function tagKyuRi(tokens){
  const tagged=tokens.map(seed);
  for(let pass=0;pass<4;pass++) for(let i=0;i<tagged.length;i++) tagged[i]=resolve(tagged,i);
  return tagged;
}

function seed(token){
  if(token.kind==='PUNCT')return {...token,lemma:token.normalized,pos:'PUNCT',posCandidates:['PUNCT'],features:[]};
  if(token.kind==='NUMBER')return {...token,lemma:token.normalized,pos:'NUM',posCandidates:['NUM'],features:[]};
  const hit=lookupKyuRi(token.normalized);
  const best=bestAnalysis(hit.analyses,token)??{lemma:token.normalized,pos:['X'],features:['UNKNOWN'],source:'guesser'};
  let candidates=[...new Set(hit.analyses.flatMap(a=>a.pos??[]).concat(best.pos??[]))];
  if(DET.has(token.normalized))candidates.unshift('Det');
  if(PREP.has(token.normalized))candidates.unshift('P');
  if(MODAL.has(best.lemma))candidates.unshift('MODAL');
  if(AUX.has(best.lemma))candidates.unshift('AUX','V');
  if(NEG.has(token.normalized))candidates.unshift('NEG');
  if(DEGREE.has(token.normalized))candidates.unshift('ADV');
  if(CLAUSE.has(token.normalized))candidates.unshift('C');
  if(WH.has(token.normalized))candidates.unshift('WH');
  const proper=/^[A-Z]/.test(token.surface)&&token.surface!=='I'&&!DET.has(token.normalized);
  if(proper)candidates.unshift('PROPN');
  return {...token,lemma:best.lemma,pos:null,posCandidates:[...new Set(candidates)],features:proper?[]:[...(best.features??[])],dictionaryFound:hit.found,source:best.source,frames:hit.frames};
}

function resolve(tokens,i){
  const t=tokens[i]; if(['PUNCT','NUM'].includes(t.pos))return t;
  const p=prev(tokens,i),n=next(tokens,i),c=t.posCandidates; let pos;
  if(DET.has(t.normalized))pos='Det';
  else if(PREP.has(t.normalized))pos=(t.lemma==='to'&&n&&has(n,'V')&&!has(n,'PROPN'))?'INF':'P';
  else if(NEG.has(t.normalized))pos='NEG';
  else if(MODAL.has(t.lemma))pos='MODAL';
  else if(c.includes('PROPN'))pos='PROPN';
  else if(WH.has(t.lemma))pos=['where','when','why','how'].includes(t.lemma)?'ADV':t.lemma==='whose'?'Det':'PRON';
  else if(CLAUSE.has(t.lemma)&&t.lemma!=='in')pos='C';
  else if(AUX.has(t.lemma)&&n&&(has(n,'V')||n.pos==='NEG'||n.pos==='ADV'||has(n,'A')))pos='AUX';
  else if(DEGREE.has(t.lemma))pos='ADV';
  else if(p?.pos==='Det'||p?.pos==='D'||p?.pos==='POSS')pos=has(t,'A')&&n&&(has(n,'N')||has(n,'PROPN'))?'A':pick(c,['N','PROPN','A']);
  else if(p?.pos==='MODAL'||p?.pos==='INF')pos=has(t,'V')?'V':pick(c,['AUX','V','N']);
  else if(p?.pos==='AUX')pos=p.lemma==='be'&&has(t,'A')&&!t.features.some(x=>['PROG','PTCP'].includes(x))?'A':has(t,'V')?'V':pick(c,['A','N','ADV']);
  else if(p&&DEGREE.has(p.lemma)&&has(t,'A'))pos='A';
  else if(has(t,'ADV')&&/ly$/.test(t.normalized))pos='ADV';
  else if(has(t,'N')&&n?.pos==='AUX')pos='N';
  else if(has(t,'N')&&['V','P','INF'].includes(p?.pos))pos='N';
  else if(has(t,'PRON'))pos='PRON';
  else if(has(t,'V')&&verbPosition(p,tokens,i))pos='V';
  else pos=pick(c,['N','A','ADV','V','P','Det','D','PRON','CONJ','X']);
  return {...t,pos:pos??'X'};
}

function bestAnalysis(a,t){if(!a?.length)return null;const f=/ing$/.test(t.normalized)?'PROG':/ed$/.test(t.normalized)?'PAST':null;if(f){const x=a.find(y=>y.features?.includes(f)&&y.pos?.includes('V'));if(x)return x;}if(/(?:es|s)$/.test(t.normalized)){const x=[...a].reverse().find(y=>y.pos?.includes('V'));if(x)return x;}return a[0];}
function has(t,p){return t?.posCandidates?.includes(p)}
function pick(c,o){return o.find(x=>c.includes(x))??c[0]??'X'}
function prev(a,i){for(let j=i-1;j>=0;j--)if(a[j].pos!=='PUNCT')return a[j];return null}
function next(a,i){for(let j=i+1;j<a.length;j++)if(a[j].pos!=='PUNCT')return a[j];return null}
function verbPosition(p,a,i){if(!p||p.pos==='PUNCT'||['PRON','PROPN','N','AUX','MODAL','ADV'].includes(p.pos))return true;return a.slice(0,i).some(x=>['PRON','N','PROPN'].includes(x.pos))}
