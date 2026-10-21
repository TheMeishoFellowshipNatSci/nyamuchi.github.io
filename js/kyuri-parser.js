import { getKyuRiVerbFrames } from './kyuri-dictionary.js';

export function parseKyuRi(groups) {
  const clauses=splitClauses(groups);
  const warnings=[];
  const parsed=clauses.map((clause,index)=>parseClause(clause,warnings,index));
  const root=parsed.length===1?parsed[0].root:node('C″',parsed.map(x=>x.root));
  const main=parsed[0]??{};
  return {root,warnings,score:Math.max(0,100-warnings.reduce((n,w)=>n+(w.severity==='error'?20:8),0)),frame:main.frame??null,pred:main.lemma??null,predicate:main.surface??null,clauses:parsed};
}

function splitClauses(groups){const out=[];let cur=[];for(const g of groups){if(g.kind==='PUNCT'&&/[.!?]/.test(g.surface)){if(cur.length)out.push(cur);cur=[];}else cur.push(g);}if(cur.length)out.push(cur);return out;}
function parseClause(groups,warnings,index){
  const verbIndex=findFiniteOrLexicalVerb(groups);
  if(verbIndex<0){warnings.push(warn('NO_PREDICATE',`第${index+1}文の述語を特定できません。`,'error'));return {root:node('C″',groups.map(groupNode)),frame:null};}
  const vg=groups[verbIndex], lemma=vg.head||vg.base;
  const subject=findSubject(groups,verbIndex);
  const pre=groups.slice(0,verbIndex).filter(g=>g!==subject&&g.kind!=='C');
  const post=groups.slice(verbIndex+1).filter(g=>g.kind!=='CONJ');
  const complements=post.filter(g=>['NP','PP','AP','C','INF','V'].includes(g.kind));
  const adjuncts=post.filter(g=>['AdvP'].includes(g.kind));
  const frames=getKyuRiVerbFrames(lemma);
  const frame=chooseFrame(frames,subject,complements);
  validate(frame,subject,complements,warnings,index);
  const vpChildren=[node('V′',[leaf('V',vg.surface),...complements.map(groupNode),...adjuncts.map(groupNode)])];
  const iGroups=groups.slice(0,verbIndex).filter(g=>g.kind==='I');
  const ipChildren=[]; if(subject)ipChildren.push(groupNode(subject));
  ipChildren.push(node('I′',[...iGroups.map(groupNode),...pre.filter(g=>g.kind==='AdvP').map(groupNode),node('V″',vpChildren)]));
  const c=groups.find(g=>g.kind==='C');
  const root=node('C″',[...(c?[leaf('C',c.surface)]:[]),node('I″',ipChildren)]);
  return {root,frame,lemma,surface:vg.surface,subject,complements};
}
function findFiniteOrLexicalVerb(groups){const vi=groups.findIndex(g=>g.kind==='V');if(vi>=0)return vi;return groups.findIndex(g=>g.kind==='I'&&g.parts.some(x=>x.pos==='AUX'&&x.lemma==='be'));}
function findSubject(groups,vi){for(let i=vi-1;i>=0;i--)if(groups[i].kind==='NP')return groups[i];return null;}
function chooseFrame(frames,subject,complements){let best=frames[0]??'S+O',score=Infinity;for(const f of frames){const req=parseFrame(f).filter(x=>x!=='S');const d=Math.abs(req.length-complements.length)+req.reduce((n,x,i)=>n+(matches(x,complements[i])?0:1),0);if(d<score){score=d;best=f;}}return best;}
function parseFrame(f){return String(f).split('+').filter(Boolean);}
function matches(req,g){if(!g)return false;if(req==='O'||req==='O2')return g.kind==='NP';if(req==='C')return ['NP','AP'].includes(g.kind);if(req==='CP')return g.kind==='C';if(req==='INF')return ['INF','V'].includes(g.kind);if(req==='ING')return g.kind==='V'&&g.parts.some(x=>x.features?.includes('PROG'));if(req.startsWith('PP'))return g.kind==='PP'&&(!req.includes(':')||g.head===req.split(':')[1]);return true;}
function validate(frame,subject,complements,warnings,index){const req=parseFrame(frame);if(req.includes('S')&&!subject)warnings.push(warn('MISSING_SUBJECT',`第${index+1}文で主語候補を確認できません。`,'warning'));const needed=req.filter(x=>x!=='S');for(let i=0;i<needed.length;i++)if(!matches(needed[i],complements[i]))warnings.push(warn('FRAME_MISMATCH',`第${index+1}文は動詞フレーム ${frame} の ${needed[i]} を満たさない可能性があります。`,'warning'));}
function warn(code,message,severity){return {code,message,severity};}
function groupNode(g){const label={NP:'N″',PP:'P″',AP:'A″',AdvP:'Adv″',I:'I',C:'C',INF:'I',V:'V',X:'X'}[g.kind]??g.kind;return g.parts?.length>1?node(label,g.parts.map(t=>leaf(tokenLabel(t),t.surface))):leaf(label,g.surface);}
function tokenLabel(t){return {N:'N',PROPN:'N',PRON:'N',D:'D',POSS:'D',A:'A',ADV:'Adv',P:'P',V:'V',AUX:'I',MODAL:'I',NEG:'Neg',C:'C',NUM:'Num'}[t.pos]??t.pos;}
function node(label,children=[]){return {label,type:'node',children};}
function leaf(label,text){return {label,type:'leaf',text,children:[]};}
