import { expandKyuRiContraction, normalizeKyuRiToken } from './kyuri-dictionary.js';

const TOKEN_RE = /(?:[A-Za-z]\.){2,}|[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+(?:[.,]\d+)*(?:%|st|nd|rd|th)?|[.!?,;:()[\]{}"“”'‘’—–-]/g;
const SENTENCE_END = new Set(['.', '!', '?']);

export function tokenizeKyuRi(input) {
  const text = String(input ?? '').normalize('NFKC').replace(/[\u2018\u2019]/g, "'");
  const raw = [...text.matchAll(TOKEN_RE)];
  const tokens = [];
  let sentence = 0;

  raw.forEach((match, rawIndex) => {
    const surface = match[0];
    const start = match.index ?? 0;
    const end = start + surface.length;
    const kind = classify(surface);
    const normalized = normalizeKyuRiToken(surface);
    const expansion = kind === 'WORD' ? expandKyuRiContraction(normalized) : [normalized];

    expansion.forEach((part, expansionIndex) => {
      tokens.push({
        id: tokens.length,
        surface,
        normalized: part,
        kind,
        start,
        end,
        sentence,
        rawIndex,
        expansionIndex,
        expansionLength: expansion.length,
        contracted: expansion.length > 1 || part !== normalized
      });
    });
    if (SENTENCE_END.has(surface)) sentence += 1;
  });
  return tokens;
}

function classify(surface) {
  if (/^\d/.test(surface)) return 'NUMBER';
  if (/^[A-Za-z]/.test(surface)) return 'WORD';
  return 'PUNCT';
}

export function splitKyuRiSentences(tokens) {
  const map = new Map();
  for (const token of tokens) {
    if (!map.has(token.sentence)) map.set(token.sentence, []);
    map.get(token.sentence).push(token);
  }
  return [...map.values()].filter(sentence => sentence.some(t => t.kind !== 'PUNCT'));
}
