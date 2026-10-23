import { frames } from "./japanese-case-frames.js";

export const NYAMUCHI_ENGINE_NAME = "Nyamuchi Core";
export const NYAMUCHI_ENGINE_VERSION = "4.0.0";

let id = 0;
const node = (label, children = [], surface = null, metadata = {}) => ({
  id: ++id,
  label,
  children,
  surface,
  metadata
});

function nominalLeaf(surface, metadata = {}) {
  return node("N″", [node("N′", [node("N", [], surface, metadata)])]);
}

function genitiveSpecifier(parts) {
  // 属格指定部を必ず内部構造として投射する。
  // 例: 「私の」 -> [N″ [N′ [N 私] [P の]]]
  const finalNo = parts.at(-1)?.surface === "の" ? parts.at(-1) : null;
  const core = finalNo ? parts.slice(0, -1) : parts;
  const lastNounIndex = core.map(part => part.pos).lastIndexOf("N");

  if (lastNounIndex < 0) {
    return nominalLeaf(core.map(part => part.surface).join(""), {
      case: "genitive",
      caseMarker: finalNo?.surface || "の",
      parts
    });
  }

  const head = core[lastNounIndex];
  const preceding = core.slice(0, lastNounIndex);
  const nBarChildren = [];
  if (preceding.length) nBarChildren.push(genitiveSpecifier(preceding));
  nBarChildren.push(node("N", [], head.surface, { base: head.base }));
  if (finalNo) {
    nBarChildren.push(node("P", [], finalNo.surface, {
      case: "genitive",
      caseMarker: finalNo.surface
    }));
  }

  return node("N″", [node("N′", nBarChildren)], null, {
    case: "genitive",
    caseMarker: finalNo?.surface || "の",
    parts
  });
}

function genitiveNominalProjection(group) {
  const parts = group.parts ?? [];
  const finalMarker = [...parts].reverse().find(part => part.pos === "P" && part.surface !== "の");
  const nominalParts = finalMarker ? parts.slice(0, parts.lastIndexOf(finalMarker)) : parts;
  const headIndex = nominalParts.map(part => part.pos).lastIndexOf("N");
  const head = nominalParts[headIndex];
  const specifierParts = nominalParts.slice(0, headIndex);
  const specifier = genitiveSpecifier(specifierParts);

  // 本書のXバー方式: N″ → 指定部 N′、N′ → N（＋補語）。
  // 「私の」はP″ではなく、属格をもつN″指定部。主要部は「父」。
  const nBar = node("N′", [node("N", [], head?.surface || group.base || group.content || "", {
    base: head?.base || group.base
  })]);
  const markerSurface = finalMarker?.surface ?? group.particle;
  const children = [specifier, nBar];
  if (markerSurface) children.push(node("P", [], markerSurface, {
    particle: markerSurface,
    markerType: group.markerType
  }));
  return node("N″", children, null, {
    particle: finalMarker?.surface ?? group.particle,
    markerType: group.markerType,
    parts
  });
}

function lexicalProjection(category, group) {
  if (category === "N" && group.kind === "genitiveNominal") {
    return genitiveNominalProjection(group);
  }
  return node(category + "″", [
    node(category + "′", [
      node(category, [], group.surface, {
        base: group.base,
        particle: group.particle,
        markerType: group.markerType,
        parts: group.parts
      })
    ])
  ]);
}

function postpositionalProjection(group) {
  const contentPart = group.parts?.find(part => part.pos !== "P");
  const particlePart = group.parts?.find(part => part.pos === "P");
  const category = group.complementCategory || contentPart?.pos || "N";
  const complement = node(category + "″", [
    node(category + "′", [
      node(category, [], contentPart?.surface || group.content || "")
    ])
  ]);
  const head = node("P", [], particlePart?.surface || group.particle || "");
  return node("P″", [node("P′", [complement, head])]);
}

function projectGroup(group) {
  const category = group.phraseCategory || group.pos || "Unknown";
  if (category === "P" && group.particle) return postpositionalProjection(group);
  return lexicalProjection(category, group);
}

function defaultFrame() {
  return {
    required: [],
    optional: ["が", "は", "を", "に", "へ", "で", "と", "から", "まで"],
    gloss: "未登録動詞・汎用フレーム"
  };
}

export function parseNyamuchi(groups) {
  id = 0;
  const warnings = [];
  const predicateIndex = groups.map(group => group.pos).lastIndexOf("V");

  if (predicateIndex < 0) {
    return {
      root: node("C″", [node("C′", [node("I″", groups.map(projectGroup))])]),
      warnings: ["動詞主要部がありません。"],
      score: 40,
      frame: { gloss: "なし" },
      pred: null
    };
  }

  const predicate = groups[predicateIndex];
  const before = groups.slice(0, predicateIndex);
  const after = groups.slice(predicateIndex + 1);
  const frame = frames[predicate.base] || defaultFrame();

  const projected = before.map(group => ({ group, tree: projectGroup(group) }));
  const subject = projected.find(entry =>
    entry.group.phraseCategory === "N" &&
    ["は", "が"].includes(entry.group.particle)
  );
  const dependents = projected.filter(entry => entry !== subject).map(entry => entry.tree);

  const verbPhrase = node("V″", [
    node("V′", [
      ...dependents,
      node("V", [], predicate.surface, { base: predicate.base, parts: predicate.parts })
    ])
  ]);

  // Vの後ろにまとめたI系列を一つのI主要部として置く。
  const inflectionGroups = after.filter(group => group.pos === "I");
  const inflectionSurface = inflectionGroups.map(group => group.surface).join("") || "∅";
  const inflection = node("I", [], inflectionSurface, {
    parts: inflectionGroups.flatMap(group => group.parts || [])
  });

  const inflectionPhrase = node("I″", [
    ...(subject ? [subject.tree] : []),
    node("I′", [verbPhrase, inflection])
  ]);

  const complementizer = after.find(group => group.pos === "C");
  const clause = node("C″", [
    node("C′", [
      inflectionPhrase,
      node("C", [], complementizer?.surface || "∅")
    ])
  ]);

  const particles = new Set(before.map(group => group.particle).filter(Boolean));
  for (const required of frame.required || []) {
    if (!particles.has(required)) {
      warnings.push(`「${predicate.base}」が要求する「${required}」格がありません。`);
    }
  }
  if (!subject) warnings.push("表面上の主題・主語がありません。");
  if (frame.gloss?.startsWith("未登録")) warnings.push("動詞フレームが未登録です。");

  return {
    root: clause,
    warnings,
    score: Math.max(25, 96 - warnings.length * 12),
    frame,
    pred: predicate,
    predicate
  };
}

export function paths(root) {
  const output = [];
  function walk(current, parentPath = []) {
    const currentPath = [...parentPath, current.label];
    if (current.surface !== null) {
      if (current.surface !== "∅") output.push({ path: currentPath, surface: current.surface });
      return;
    }
    for (const child of current.children) walk(child, currentPath);
  }
  walk(root);
  return output;
}

export function brackets(current) {
  if (current.surface !== null) return `[${current.label} ${current.surface}]`;
  return `[${current.label}${current.children.length ? " " + current.children.map(brackets).join(" ") : ""}]`;
}

// 旧APIとの互換性を維持。
export const parse = parseNyamuchi;
