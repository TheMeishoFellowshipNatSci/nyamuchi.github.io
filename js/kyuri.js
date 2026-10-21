import { KYURI_NAME, KYURI_VERSION, KYURI_STATS, lookupKyuRi } from './kyuri-dictionary.js';
import { tokenizeKyuRi, splitKyuRiSentences } from './kyuri-tokenizer.js';
import { tagKyuRi } from './kyuri-tagger.js';
import { groupKyuRi } from './kyuri-grouper.js';
import { parseKyuRi } from './kyuri-parser.js';

export { KYURI_NAME, KYURI_VERSION, KYURI_STATS, lookupKyuRi, tokenizeKyuRi, tagKyuRi, groupKyuRi, parseKyuRi };

export function analyzeWithKyuRi(text) {
  const rawTokens=tokenizeKyuRi(text);
  const tokens=tagKyuRi(rawTokens);
  const groups=groupKyuRi(tokens);
  const parsed=parseKyuRi(groups);
  return {language:'en',engine:{name:KYURI_NAME,version:KYURI_VERSION},text:String(text??''),tokens,groups,...parsed};
}

export function analyzeKyuRiSentences(text) {
  return splitKyuRiSentences(tokenizeKyuRi(text)).map(sentence=>{
    const tokens=tagKyuRi(sentence), groups=groupKyuRi(tokens), parsed=parseKyuRi(groups);
    return {language:'en',engine:{name:KYURI_NAME,version:KYURI_VERSION},tokens,groups,...parsed};
  });
}
