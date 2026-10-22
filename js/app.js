import { tokenize, group, initializeMecab } from './tokenizer.js';
import { parseNyamuchi, paths, brackets } from './nyamuchi-engine.js';
import { analyzeWithNyamuchiEnglish } from './nyamuchi-engine-for-english.js';

const $ = selector => document.querySelector(selector);
const E = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const examples = [
  '私は日本語を勉強します。',
  '彼は駅で手紙を読みます。',
  '太郎が花子に本を与えた。',
  '公園で走った。'
];

examples.forEach(text => {
  const button = document.createElement('button');
  button.textContent = text;
  button.onclick = () => {
    $('#input').value = text;
    run();
  };
  $('#examples').append(button);
});

document.querySelectorAll('nav button').forEach(button => {
  button.onclick = () => {
    document.querySelectorAll('nav button,.panel').forEach(element => {
      element.classList.remove('active');
    });
    button.classList.add('active');
    $('#' + button.dataset.tab).classList.add('active');
  };
});

function isEnglishMode() {
  // index.html にチェック欄がない間は必ず false になり、従来の日本語回路だけを使う。
  return $('#englishMode')?.checked === true;
}

async function analyzeJapanese(text) {
  const tokens = await tokenize(text);
  const groups = group(tokens);
  const result = parseNyamuchi(groups);

  return {
    language: 'ja',
    engineName: 'Nyamuchi Engine (MeCab / UniDic)',
    tokens,
    groups,
    result,
    pathItems: paths(result.root),
    bracketText: brackets(result.root)
  };
}

function analyzeEnglish(text) {
  const result = analyzeWithNyamuchiEnglish(text);

  return {
    language: 'en',
    engineName: 'Nyamuchi Engine for English (KyuRi 2.0 Neo)',
    tokens: result.tokens,
    groups: result.groups,
    result,
    pathItems: kyuriPaths(result.root),
    bracketText: kyuriBrackets(result.root)
  };
}

async function run() {
  const analyzeButton = $('#analyze');
  const text = $('#input').value;
  analyzeButton.disabled = true;

  try {
    const analysis = isEnglishMode()
      ? analyzeEnglish(text)
      : await analyzeJapanese(text);

    renderAnalysis(analysis);
  } catch (error) {
    $('#status').textContent = '解析エラー';
    $('#diagnostics').textContent = error?.message || String(error);
  } finally {
    analyzeButton.disabled = false;
  }
}

function renderAnalysis({ language, engineName, tokens, groups, result, pathItems, bracketText }) {
  const warnings = normalizeWarnings(result.warnings);
  const predicate = language === 'en'
    ? result.pred || result.predicate || '未確定'
    : result.pred?.base || '未確定';
  const frame = language === 'en'
    ? result.frame || '未確定'
    : result.frame?.gloss || '未確定';

  $('#score').textContent = result.score;
  $('#meter').style.width = result.score + '%';
  $('#frame').innerHTML = `主要部: <b>${E(predicate)}</b><br>${E(frame)}`;
  $('#counts').textContent = `${groups.length}表示単位・${tokens.length}形態素`;
  $('#status').textContent = warnings.length
    ? `${warnings.length}件の注意`
    : `${engineName}解析完了`;

  $('#path-list').innerHTML = pathItems.map((item, index) => {
    const path = [...(item.path || []), item.surface || ''].filter(Boolean).join('　');
    return `<div class="path"><b>${String(index + 1).padStart(2, '0')}</b>${E(path)}</div>`;
  }).join('');

  $('#diagnostics').innerHTML = warnings
    .map(message => `<div class="warning">⚠ ${E(message)}</div>`)
    .join('');

  $('#morph-list').innerHTML = tokens.map(token => {
    const surface = token.expansionIndex > 0 ? token.normalized : token.surface;
    const pos = token.pos || 'X';
    const detail = language === 'en'
      ? `${token.features?.join(', ') || '-'} / ${token.lemma || token.normalized || surface}`
      : `${token.pos2 || ''} / ${token.base || ''}`;
    return `<div class="row"><b>${E(surface)}</b><span>${E(pos)}</span><span>${E(detail)}</span></div>`;
  }).join('');

  $('#groups').innerHTML = groups.map(item => {
    const pos = item.pos || item.phraseCategory || item.kind || 'X';
    return `<span class="chip">${E(item.surface)} ${E(pos)}</span>`;
  }).join('');

  $('#brackets').textContent = bracketText;
}

function normalizeWarnings(warnings = []) {
  return warnings.map(warning => {
    if (typeof warning === 'string') return warning;
    return warning?.message || warning?.code || String(warning);
  });
}

function kyuriPaths(root) {
  const output = [];

  function visit(node, path = []) {
    if (!node) return;
    const nextPath = node.label ? [...path, node.label] : path;
    const children = Array.isArray(node.children) ? node.children : [];

    if (node.type === 'leaf' || children.length === 0) {
      output.push({ path, surface: node.text || node.label || '' });
      return;
    }

    children.forEach(child => visit(child, nextPath));
  }

  visit(root);
  return output;
}

function kyuriBrackets(node) {
  if (!node) return '';
  const children = Array.isArray(node.children) ? node.children : [];

  if (node.type === 'leaf' || children.length === 0) {
    return `[${node.label || 'X'} ${node.text || ''}]`;
  }

  return `[${node.label || 'X'} ${children.map(kyuriBrackets).join(' ')}]`;
}

$('#analyze').onclick = run;

initializeMecab(message => {
  $('#status').textContent = message;
}).then(() => {
  $('#analyze').disabled = false;
  run();
}).catch(error => {
  $('#status').textContent = error?.message || String(error);
});
