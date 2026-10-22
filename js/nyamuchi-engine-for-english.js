import { KYURI_NAME, KYURI_VERSION, KYURI_STATS, lookupKyuRi } from './kyuri-dictionary.js';
import { tokenizeKyuRi, splitKyuRiSentences } from './kyuri-tokenizer.js';
import { tagKyuRi } from './kyuri-tagger.js';
import { groupKyuRi } from './kyuri-grouper.js';
import { parseNyamuchiEnglish, parseKyuRi } from './nyamuchi-engine-for-english-parser.js';

export const NYAMUCHI_ENGLISH_ENGINE_NAME = 'Nyamuchi Engine for English';
export const NYAMUCHI_ENGLISH_ENGINE_VERSION = '1.0.0';
export { KYURI_NAME, KYURI_VERSION, KYURI_STATS, lookupKyuRi, tokenizeKyuRi, tagKyuRi, groupKyuRi, parseKyuRi };

export function analyzeWithNyamuchiEnglish(text) {
  const rawTokens=tokenizeKyuRi(text);
  const tokens=tagKyuRi(rawTokens);
  const groups=groupKyuRi(tokens);
  const parsed=parseNyamuchiEnglish(groups);
  return {language:'en',engine:{name:NYAMUCHI_ENGLISH_ENGINE_NAME,version:NYAMUCHI_ENGLISH_ENGINE_VERSION,morphology:{name:KYURI_NAME,version:KYURI_VERSION}},text:String(text??''),tokens,groups,...parsed};
}

export function analyzeNyamuchiEnglishSentences(text) {
  return splitKyuRiSentences(tokenizeKyuRi(text)).map(sentence=>{
    const tokens=tagKyuRi(sentence), groups=groupKyuRi(tokens), parsed=parseNyamuchiEnglish(groups);
    return {language:'en',engine:{name:NYAMUCHI_ENGLISH_ENGINE_NAME,version:NYAMUCHI_ENGLISH_ENGINE_VERSION,morphology:{name:KYURI_NAME,version:KYURI_VERSION}},tokens,groups,...parsed};
  });
}

// Backward-compatible aliases.
export const analyzeWithKyuRi = analyzeWithNyamuchiEnglish;
export const analyzeKyuRiSentences = analyzeNyamuchiEnglishSentences;
