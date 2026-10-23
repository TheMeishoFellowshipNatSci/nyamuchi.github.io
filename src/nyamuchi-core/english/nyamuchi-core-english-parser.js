import { getKyuRiVerbFrames } from '../../kyuri/kyuri-dictionary.js';

/**
 * Nyamuchi Core X-bar parser.
 * KyuRi 2.0 Neo supplies lexical and morphological analyses; this module builds Umiri trees.
 * Every lexical phrase is expanded through maximal and intermediate projections:
 * N″ > N′ > N, P″ > P′ > P, A″ > A′ > A, Adv″ > Adv′ > Adv,
 * V″ > V′ > V, and C″ > C′ > I″ > I′.
 */
export function parseNyamuchiEnglish(groups) {
  const clauses = splitClauses(groups);
  const warnings = [];
  const parsed = clauses.map((clause, index) => parseClause(clause, warnings, index));
  const root = parsed.length === 1
    ? parsed[0].root
    : node('C″', parsed.map(item => item.root));
  const main = parsed[0] ?? {};

  const scoreDetails = calculateEnglishConfidence(groups, parsed, warnings);
  return {
    root,
    warnings,
    score: scoreDetails.score,
    scoreDetails,
    frame: main.frame ?? null,
    pred: main.lemma ?? null,
    predicate: main.surface ?? null,
    clauses: parsed
  };
}

function calculateEnglishConfidence(groups, parsed, warnings) {
  const tokens = groups.flatMap(group => group.parts ?? []);
  const uniqueTokens = [...new Map(tokens.map(token => [`${token.rawIndex}:${token.expansionIndex ?? 0}`, token])).values()];
  const unknownCount = uniqueTokens.filter(token => token.features?.includes('UNKNOWN') || token.pos === 'X').length;
  const ambiguousCount = uniqueTokens.filter(token => (token.posCandidates?.length ?? 0) >= 3).length;
  const fallbackGroupCount = groups.filter(group => group.kind === 'X').length;
  const warningPenalty = warnings.reduce((sum, warning) => sum + (warning.severity === 'error' ? 22 : 10), 0);
  const unknownPenalty = Math.min(30, unknownCount * 10);
  const ambiguityPenalty = Math.min(16, ambiguousCount * 2);
  const fallbackPenalty = Math.min(20, fallbackGroupCount * 8);
  // KyuRi 2.0 Neo is rule-based and less reliable than MeCab/UniDic.
  // Its confidence therefore starts at 82 rather than presenting near-certain values.
  let score = 82 - warningPenalty - unknownPenalty - ambiguityPenalty - fallbackPenalty;
  if (!parsed.some(clause => clause.lemma)) score = Math.min(score, 35);
  if (warnings.some(warning => warning.code === 'MISSING_SUBJECT')) score = Math.min(score, 62);
  score = Math.max(5, Math.min(82, Math.round(score)));
  return {
    score,
    ceiling: 82,
    warningPenalty,
    unknownPenalty,
    ambiguityPenalty,
    fallbackPenalty,
    unknownCount,
    ambiguousCount,
    fallbackGroupCount,
    basis: 'Nyamuchi Core confidence calibration'
  };
}

function splitClauses(groups) {
  const clauses = [];
  let current = [];
  for (const group of groups) {
    if (group.kind === 'PUNCT' && /[.!?]/.test(group.surface)) {
      if (current.length) clauses.push(current);
      current = [];
    } else {
      current.push(group);
    }
  }
  if (current.length) clauses.push(current);
  return clauses;
}

function parseClause(groups, warnings, sentenceIndex) {
  const verbIndex = findPredicate(groups);
  if (verbIndex < 0) {
    warnings.push(warn('NO_PREDICATE', `第${sentenceIndex + 1}文の述語を特定できません。`, 'error'));
    return { root: wrapClause(groups.map(projectGroup)), frame: null };
  }

  const verbGroup = groups[verbIndex];
  const lemma = verbGroup.head || verbGroup.base;
  const subject = findSubject(groups, verbIndex);
  const auxiliaries = groups.slice(0, verbIndex).filter(group => group.kind === 'I');
  const preVerbAdjuncts = groups.slice(0, verbIndex).filter(group => group !== subject && !['I', 'C'].includes(group.kind));
  const postVerb = groups.slice(verbIndex + 1).filter(group => !['CONJ', 'PUNCT'].includes(group.kind));
  const complements = postVerb.filter(group => ['NP', 'PP', 'AP', 'C', 'INF', 'V'].includes(group.kind));
  const adjuncts = postVerb.filter(group => group.kind === 'AdvP');
  const frame = chooseFrame(getKyuRiVerbFrames(lemma), complements);

  validateFrame(frame, subject, complements, warnings, sentenceIndex);

  const vp = projectVP(verbGroup, complements, adjuncts);
  const iPrimeChildren = [
    ...auxiliaries.map(projectInflection),
    ...preVerbAdjuncts.map(projectGroup),
    vp
  ];
  const iPrime = node('I′', iPrimeChildren);
  const ip = node('I″', subject ? [projectNP(subject), iPrime] : [iPrime]);
  const complementizer = groups.find(group => group.kind === 'C');
  const cPrime = node('C′', complementizer
    ? [lexical('C', complementizer.surface), ip]
    : [ip]);
  const root = node('C″', [cPrime]);

  return {
    root,
    frame,
    lemma,
    surface: verbGroup.surface,
    subject,
    complements
  };
}

function wrapClause(children) {
  return node('C″', [node('C′', [node('I″', [node('I′', children)])])]);
}

function findPredicate(groups) {
  const lexicalVerb = groups.findIndex(group => group.kind === 'V');
  if (lexicalVerb >= 0) return lexicalVerb;
  return groups.findIndex(group => group.kind === 'I' && group.parts?.some(token => token.pos === 'AUX' && token.lemma === 'be'));
}

function findSubject(groups, verbIndex) {
  for (let index = verbIndex - 1; index >= 0; index -= 1) {
    if (groups[index].kind === 'NP') return groups[index];
  }
  return null;
}

function projectVP(verbGroup, complements, adjuncts) {
  let projection = node('V′', [lexical('V', verbGroup.surface)]);

  // Complements and adjuncts are attached one at a time, preserving binary branching.
  for (const complement of complements) {
    projection = node('V′', [projection, projectGroup(complement)]);
  }
  for (const adjunct of adjuncts) {
    projection = node('V′', [projection, projectGroup(adjunct)]);
  }

  return node('V″', [projection]);
}

function projectNP(group) {
  const parts = group.parts ?? [];
  const determiner = parts.find(token => ['Det', 'D', 'POSS'].includes(token.pos));
  const modifiers = parts.filter(token => ['A', 'ADV', 'NUM'].includes(token.pos));
  const head = [...parts].reverse().find(token => ['N', 'PROPN', 'PRON'].includes(token.pos)) ?? parts.at(-1);

  let nPrime = node('N′', [lexical('N', head?.surface || group.surface)]);
  for (const modifier of [...modifiers].reverse()) {
    const projectedModifier = modifier.pos === 'ADV'
      ? projectAdverbToken(modifier)
      : modifier.pos === 'A'
        ? projectAdjectiveToken(modifier)
        : lexical('Num', modifier.surface);
    nPrime = node('N′', [projectedModifier, nPrime]);
  }

  const children = determiner
    ? [lexical('Det', determiner.surface), nPrime]
    : [nPrime];
  return node('N″', children);
}

function projectPP(group) {
  const parts = group.parts ?? [];
  const preposition = parts.find(token => token.pos === 'P') ?? parts[0];
  const nominalParts = parts.filter(token => token !== preposition);
  const complement = nominalParts.length
    ? projectNP({ ...group, kind: 'NP', phraseCategory: 'NP', parts: nominalParts, surface: joinSurface(nominalParts) })
    : null;
  const pPrime = node('P′', complement
    ? [lexical('P', preposition?.surface || group.head || ''), complement]
    : [lexical('P', preposition?.surface || group.head || group.surface)]);
  return node('P″', [pPrime]);
}

function projectAP(group) {
  const parts = group.parts ?? [];
  const head = [...parts].reverse().find(token => token.pos === 'A') ?? parts.at(-1);
  const adverbs = parts.filter(token => token.pos === 'ADV');
  let aPrime = node('A′', [lexical('A', head?.surface || group.surface)]);
  for (const adverb of [...adverbs].reverse()) {
    aPrime = node('A′', [projectAdverbToken(adverb), aPrime]);
  }
  return node('A″', [aPrime]);
}

function projectAdvP(group) {
  const head = group.parts?.find(token => token.pos === 'ADV') ?? group.parts?.[0];
  return node('Adv″', [node('Adv′', [lexical('Adv', head?.surface || group.surface)])]);
}

function projectAdjectiveToken(token) {
  return node('A″', [node('A′', [lexical('A', token.surface)])]);
}

function projectAdverbToken(token) {
  return node('Adv″', [node('Adv′', [lexical('Adv', token.surface)])]);
}

function projectInflection(group) {
  const parts = group.parts ?? [];
  if (parts.length === 1) return lexical('I', parts[0].surface);
  return node('I′', parts.map(token => lexical(token.pos === 'NEG' ? 'Neg' : 'I', token.surface)));
}

function projectGroup(group) {
  switch (group.kind) {
    case 'NP': return projectNP(group);
    case 'PP': return projectPP(group);
    case 'AP': return projectAP(group);
    case 'AdvP': return projectAdvP(group);
    case 'I': return projectInflection(group);
    case 'INF': return node('I″', [node('I′', [lexical('I', group.surface)])]);
    case 'V': return node('V″', [node('V′', [lexical('V', group.surface)])]);
    case 'C': return lexical('C', group.surface);
    default: return lexical(group.kind || 'X', group.surface);
  }
}

function chooseFrame(frames, complements) {
  let best = frames[0] ?? 'S+O';
  let bestScore = Infinity;
  for (const frame of frames) {
    const required = parseFrame(frame).filter(item => item !== 'S');
    const score = Math.abs(required.length - complements.length)
      + required.reduce((sum, item, index) => sum + (matches(item, complements[index]) ? 0 : 1), 0);
    if (score < bestScore) {
      bestScore = score;
      best = frame;
    }
  }
  return best;
}

function parseFrame(frame) {
  return String(frame).split('+').filter(Boolean);
}

function matches(required, group) {
  if (!group) return false;
  if (required === 'O' || required === 'O2') return group.kind === 'NP';
  if (required === 'C') return ['NP', 'AP'].includes(group.kind);
  if (required === 'CP') return group.kind === 'C';
  if (required === 'INF') return ['INF', 'V'].includes(group.kind);
  if (required === 'ING') return group.kind === 'V' && group.parts?.some(token => token.features?.includes('PROG'));
  if (required.startsWith('PP')) {
    return group.kind === 'PP' && (!required.includes(':') || group.head === required.split(':')[1]);
  }
  return true;
}

function validateFrame(frame, subject, complements, warnings, sentenceIndex) {
  const required = parseFrame(frame);
  if (required.includes('S') && !subject) {
    warnings.push(warn('MISSING_SUBJECT', `第${sentenceIndex + 1}文で主語候補を確認できません。`, 'warning'));
  }
  const complementRequirements = required.filter(item => item !== 'S');
  complementRequirements.forEach((item, index) => {
    if (!matches(item, complements[index])) {
      warnings.push(warn('FRAME_MISMATCH', `第${sentenceIndex + 1}文は動詞フレーム ${frame} の ${item} を満たさない可能性があります。`, 'warning'));
    }
  });
}

function warn(code, message, severity) {
  return { code, message, severity };
}

function joinSurface(parts) {
  return parts.map(token => token.surface).join(' ');
}

function node(label, children = []) {
  return { label, type: 'node', children };
}

function lexical(label, text) {
  return { label, type: 'leaf', text, children: [] };
}

// Backward-compatible alias for extensions using the former API.
export const parseKyuRi = parseNyamuchiEnglish;
