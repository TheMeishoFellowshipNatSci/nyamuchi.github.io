import { KYURI_NAME, KYURI_VERSION, KYURI_STATS, lookupKyuRi } from '../../kyuri/kyuri-dictionary.js';
import { tokenizeKyuRi, splitKyuRiSentences } from '../../kyuri/kyuri-tokenizer.js';
import { tagKyuRi } from '../../kyuri/kyuri-tagger.js';
import { groupKyuRi } from '../../kyuri/kyuri-grouper.js';
import { parseNyamuchiEnglish, parseKyuRi } from './nyamuchi-core-english-parser.js';

export const NYAMUCHI_ENGLISH_ENGINE_NAME = 'Nyamuchi Core';
export const NYAMUCHI_ENGLISH_ENGINE_VERSION = '4.0.0';
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
