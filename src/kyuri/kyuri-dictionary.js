import {KYURI_LEXICON} from './kyuri-lexicon.js';
import KYURI_IRREGULAR from './kyuri-irregular-forms.js';
import KYURI_CONTRACTIONS from './kyuri-contractions.js';
import KYURI_VERB_FRAMES from './kyuri-verb-frames.js';
export const KYURI_NAME='KyuRi';export const KYURI_VERSION='4.0.0';export {KYURI_LEXICON,KYURI_IRREGULAR,KYURI_CONTRACTIONS,KYURI_VERB_FRAMES};
export function normalizeKyuRiToken(value){return String(value??'').normalize('NFKC').replace(/[\u2018\u2019]/g,"'").toLowerCase().trim();}
export function expandKyuRiContraction(value){const k=normalizeKyuRiToken(value);return KYURI_CONTRACTIONS[k]?[...KYURI_CONTRACTIONS[k]]:[k];}
function candidate(lemma,features,source){const e=KYURI_LEXICON[lemma];return e?{lemma,pos:[...e.p],features,source}:{lemma,pos:guessKyuRiPOS(lemma),features,source};}
function undouble(s){return s.length>2&&s.at(-1)===s.at(-2)?s.slice(0,-1):s;}
export function analyzeKyuRiMorphology(value){
 const w=normalizeKyuRiToken(value); if(!w)return [];
 const e=KYURI_LEXICON[w]; if(e?.b)return [candidate(e.b,['IRREGULAR'],'lexicon-base')];
 const irr=KYURI_IRREGULAR[w]; if(irr)return [candidate(irr[0],irr.slice(1),'irregular')];
 const out=[]; const add=(x,fs,src)=>{if(x&&KYURI_LEXICON[x]&&!out.some(y=>y.lemma===x))out.push(candidate(x,fs,src));};
 if(w.endsWith("'s")){add(w.slice(0,-2),['POSS_OR_COPULA'],'suffix');}
 if(w.endsWith('ies')&&w.length>3)add(w.slice(0,-3)+'y',['PL_OR_3SG'],'suffix');
 if(w.endsWith('ves')&&w.length>3){add(w.slice(0,-3)+'f',['PL'],'suffix');add(w.slice(0,-3)+'fe',['PL'],'suffix');}
 if(w.endsWith('es')&&w.length>2){add(w.slice(0,-2),['PL_OR_3SG'],'suffix');add(w.slice(0,-1),['PL_OR_3SG'],'suffix');}
 if(w.endsWith('s')&&!w.endsWith('ss')&&w.length>1)add(w.slice(0,-1),['PL_OR_3SG'],'suffix');
 if(w.endsWith('ied')&&w.length>3)add(w.slice(0,-3)+'y',['PAST','PTCP'],'suffix');
 if(w.endsWith('ed')&&w.length>2){const s=w.slice(0,-2);add(s,['PAST','PTCP'],'suffix');add(s+'e',['PAST','PTCP'],'suffix');add(undouble(s),['PAST','PTCP'],'suffix');}
 if(w.endsWith('ying')&&w.length>4)add(w.slice(0,-4)+'ie',['PROG'],'suffix');
 if(w.endsWith('ing')&&w.length>3){const s=w.slice(0,-3);add(s,['PROG'],'suffix');add(s+'e',['PROG'],'suffix');add(undouble(s),['PROG'],'suffix');}
 if(w.endsWith('iest')&&w.length>4)add(w.slice(0,-4)+'y',['SUP'],'suffix');
 else if(w.endsWith('ier')&&w.length>3)add(w.slice(0,-3)+'y',['COMP'],'suffix');
 else if(w.endsWith('est')&&w.length>3){const s=w.slice(0,-3);add(s,['SUP'],'suffix');add(s+'e',['SUP'],'suffix');add(undouble(s),['SUP'],'suffix');}
 else if(w.endsWith('er')&&w.length>2){const s=w.slice(0,-2);add(s,['COMP'],'suffix');add(s+'e',['COMP'],'suffix');add(undouble(s),['COMP'],'suffix');}
 if(e)out.unshift(candidate(w,[],'lexicon'));
 return out.length?out:[{lemma:w,pos:guessKyuRiPOS(w),features:['UNKNOWN'],source:'guesser'}];
}
export function guessKyuRiPOS(value){const w=normalizeKyuRiToken(value);if(!w)return ['X'];if(/^\d+(?:[.,]\d+)*$/.test(w))return ['NUM'];if(/^[A-Z]/.test(String(value)))return ['PROPN','N'];if(/ly$/.test(w))return ['ADV'];if(/(?:tion|sion|ment|ness|ity|ship|ance|ence|ism|ist)$/.test(w))return ['N'];if(/(?:ous|ful|less|able|ible|ive|al|ic|ish|ary|ory)$/.test(w))return ['A'];if(/(?:ize|ise|ify|en)$/.test(w))return ['V'];if(/ing$/.test(w))return ['V','N'];if(/ed$/.test(w))return ['V','A'];return ['N','V','A'];}
export function lookupKyuRi(value){const surface=normalizeKyuRiToken(value);const entry=KYURI_LEXICON[surface]??null;const analyses=analyzeKyuRiMorphology(surface);return {surface,found:!!entry,entry:entry?{pos:[...entry.p],base:entry.b??surface}:null,analyses,expansion:expandKyuRiContraction(surface),frames:analyses.flatMap(a=>KYURI_VERB_FRAMES[a.lemma]??[])};}
export function getKyuRiVerbFrames(value){const a=analyzeKyuRiMorphology(value);for(const x of a){if(KYURI_VERB_FRAMES[x.lemma])return [...KYURI_VERB_FRAMES[x.lemma]];}return ['S','S+O'];}
export const KYURI_STATS=Object.freeze({entries:Object.keys(KYURI_LEXICON).length,irregularForms:Object.keys(KYURI_IRREGULAR).length,contractions:Object.keys(KYURI_CONTRACTIONS).length,verbFrameLemmas:Object.keys(KYURI_VERB_FRAMES).length});
