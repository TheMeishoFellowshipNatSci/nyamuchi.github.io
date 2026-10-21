import { lookupKyuRi } from './kyuri-dictionary.js';

const AUX_LEMMAS = new Set(['be','have','do']);
const MODALS = new Set(['can','could','may','might','must','shall','should','will','would','ought']);
const NEG = new Set(['not', "n't", 'never']);
const CLAUSE_MARKERS = new Set(['that','whether','if','because','although','though','unless','while','when','before','after','since']);
const DEGREE_ADVERBS = new Set(['very','quite','rather','too','so','extremely','highly','fairly']);
const WH = new Set(['who','whom','whose','what','which','where','when','why','how']);

export function tagKyuRi(tokens) {
  const tagged = tokens.map(seedTag);
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < tagged.length; i += 1) tagged[i] = resolveTag(tagged, i);
  }
  return tagged;
}

function seedTag(token) {
  if (token.kind === 'PUNCT') return {...token, lemma:token.normalized, pos:'PUNCT', posCandidates:['PUNCT'], features:[]};
  if (token.kind === 'NUMBER') return {...token, lemma:token.normalized, pos:'NUM', posCandidates:['NUM'], features:[]};
  const hit = lookupKyuRi(token.normalized);
  const best = selectBestAnalysis(hit.analyses, token) ?? {lemma:token.normalized,pos:['X'],features:['UNKNOWN'],source:'guesser'};
  let candidates = [...new Set(hit.analyses.flatMap(a => a.pos?.length ? a.pos : []).concat(best.pos ?? []))];
  if (/^[A-Z]/.test(token.surface) && !['I'].includes(token.surface) && !candidates.includes('D') && !candidates.includes('PRON')) candidates.unshift('PROPN');
  if (MODALS.has(best.lemma)) candidates.unshift('MODAL');
  if (AUX_LEMMAS.has(best.lemma)) candidates.unshift('AUX','V');
  if (NEG.has(token.normalized)) candidates.unshift('NEG');
  if (DEGREE_ADVERBS.has(token.normalized)) candidates.unshift('ADV');
  if (CLAUSE_MARKERS.has(token.normalized)) candidates.unshift('C');
  if (WH.has(token.normalized)) candidates.unshift('WH');
  candidates = [...new Set(candidates)];
  return {...token, lemma:best.lemma, pos:null, posCandidates:candidates, features:[...(best.features ?? [])], dictionaryFound:hit.found, source:best.source, frames:hit.frames};
}

function selectBestAnalysis(analyses, token){
  if(!analyses?.length)return null;
  const suffix=/ing$/.test(token.normalized)?'PROG':/ed$/.test(token.normalized)?'PAST':null;
  if(suffix){const x=analyses.find(a=>a.features?.includes(suffix)&&a.pos?.includes('V'));if(x)return x;}
  if(/(?:es|s)$/.test(token.normalized)){const x=[...analyses].reverse().find(a=>a.pos?.includes('V'));if(x)return x;}
  return analyses[0];
}

function has(token, pos){ return token?.posCandidates?.includes(pos); }
function previousContent(tokens,i){ for(let j=i-1;j>=0;j--) if(tokens[j].pos!=='PUNCT') return tokens[j]; return null; }
function nextContent(tokens,i){ for(let j=i+1;j<tokens.length;j++) if(tokens[j].pos!=='PUNCT') return tokens[j]; return null; }

function resolveTag(tokens, i) {
  const t=tokens[i];
  if (t.pos && ['PUNCT','NUM'].includes(t.pos)) return t;
  const p=previousContent(tokens,i), n=nextContent(tokens,i), c=t.posCandidates;
  let pos=t.pos;
  if (c.includes('NEG')) pos='NEG';
  else if (MODALS.has(t.lemma)) pos='MODAL';
  else if (c.includes('WH')) pos=chooseWh(t,n);
  else if (c.includes('C') && isClauseMarker(t,p,n)) pos='C';
  else if (AUX_LEMMAS.has(t.lemma) && isAuxiliary(t,n)) pos='AUX';
  else if (c.includes('PROPN')) pos='PROPN';
  else if (p?.pos==='D' || p?.pos==='POSS') pos=(has(t,'A') && n && (has(n,'N')||has(n,'PROPN'))) ? 'A' : firstOf(c,['N','PROPN','A']);
  else if (p?.pos==='MODAL' || (p?.lemma==='to' && p?.pos==='INF')) pos=has(t,'V')?'V':firstOf(c,['AUX','V','N']);
  else if (DEGREE_ADVERBS.has(t.lemma)) pos='ADV';
  else if (p?.pos==='AUX') pos=selectAfterAux(t,p);
  else if (p && DEGREE_ADVERBS.has(p.lemma) && has(t,'A')) pos='A';
  else if (has(t,'N') && n?.pos==='AUX') pos='N';
  else if (has(t,'N') && ['V','P','INF'].includes(p?.pos)) pos='N';
  else if (has(t,'ADV') && (/ly$/.test(t.normalized) || (n && has(n,'A')))) pos='ADV';
  else if (has(t,'P') && likelyPreposition(n)) pos='P';
  else if (has(t,'D') && n && ['N','A','PROPN','NUM'].some(x=>has(n,x))) pos='D';
  else if (has(t,'PRON')) pos='PRON';
  else if (has(t,'V') && likelyVerbPosition(p,tokens,i)) pos='V';
  else pos=firstOf(c,['PROPN','N','A','ADV','V','P','D','PRON','CONJ','X']);
  if (t.lemma==='to') pos=(n && has(n,'V') && !n.posCandidates?.includes('PROPN'))?'INF':'P';
  if (t.normalized==="'s") pos='POSS';
  return {...t,pos:pos??'X'};
}

function firstOf(candidates,order){return order.find(x=>candidates.includes(x))??candidates[0]??'X';}
function chooseWh(t,n){if(['where','when','why','how'].includes(t.lemma))return 'ADV';if(t.lemma==='whose')return 'D';if(t.lemma==='which'&&n&&(has(n,'N')||has(n,'A')))return 'D';return 'PRON';}
function isClauseMarker(t,p,n){return t.lemma==='that' ? !(n&&(has(n,'N')||has(n,'A'))&&!p) : true;}
function isAuxiliary(t,n){if(!AUX_LEMMAS.has(t.lemma))return false;return !!n && (has(n,'V') || n.pos==='NEG' || n.pos==='ADV');}
function selectAfterAux(t,p){if(p.lemma==='be'&&has(t,'A')&&!t.features.some(x=>['PROG','PTCP'].includes(x)))return 'A';if(has(t,'V'))return 'V';return firstOf(t.posCandidates,['A','N','ADV']);}
function likelyPreposition(n){return !!n && ['D','PRON','N','PROPN','A','NUM','WH'].some(x=>has(n,x)||n.pos===x);}
function likelyVerbPosition(p,tokens,i){if(!p||p.pos==='PUNCT'||['PRON','NP','PROPN','N','AUX','MODAL','ADV'].includes(p.pos))return true;return tokens.slice(0,i).some(x=>['PRON','N','PROPN'].includes(x.pos));}
