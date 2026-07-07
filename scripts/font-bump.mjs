// 系统性字体大小提升脚本
// 关键顺序（避免双重升级）：
//   1) text-sm -> text-base  （先处理最大一级，释放 text-sm 作为目标）
//   2) text-xs -> text-sm    （原 text-xs 升一级，不会再次被步骤1命中）
//   3) text-[10px] -> text-xs（最后处理，生成的 text-xs 不会再被步骤2命中）
//   4) h-8 -> h-9            （控件高度配合字号）
// 规则六保持不变：text-lg/xl/2xl、text-base、text-[11px] 不处理。

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// 全规则目录
const FULL_DIRS = [
  path.join(ROOT, "app", "dashboard"),
  path.join(ROOT, "app", "config"),
];

// 仅 text-xs -> text-sm 的目录（shadcn 基础组件）
const UI_DIR = path.join(ROOT, "components", "ui");

// 跳过 text-sm->text-base 的文件（Toast 提示文字 text-sm 已足够）
const SKIP_TEXTSM_TO_BASE = new Set([
  path.join(ROOT, "app", "dashboard", "components", "ToastBar.tsx"),
]);

function walk(dir, ext = ".tsx") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...walk(p, ext));
    } else if (entry.name.endsWith(ext)) {
      out.push(p);
    }
  }
  return out;
}

function countRepl(orig, next, label, stats) {
  const n = (orig.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  stats[label] = (stats[label] || 0) + n;
}

function bumpFull(content, skipBase) {
  const stats = {};
  let c = content;
  // 1) text-sm -> text-base
  if (!skipBase) {
    countRepl(c, null, "text-sm", stats);
    c = c.replace(/text-sm/g, "text-base");
  }
  // 2) text-xs -> text-sm
  countRepl(c, null, "text-xs", stats);
  c = c.replace(/text-xs/g, "text-sm");
  // 3) text-[10px] -> text-xs
  countRepl(c, null, "text-[10px]", stats);
  c = c.replace(/text-\[10px\]/g, "text-xs");
  // 4) h-8 -> h-9 (not followed by a digit)
  countRepl(c, null, "h-8", stats);
  c = c.replace(/h-8(?![0-9])/g, "h-9");
  return { content: c, stats };
}

function bumpUi(content) {
  const stats = {};
  let c = content;
  countRepl(c, null, "text-xs", stats);
  c = c.replace(/text-xs/g, "text-sm");
  return { content: c, stats };
}

const report = {};

function processFile(file, mode) {
  const orig = fs.readFileSync(file, "utf8");
  let result;
  if (mode === "ui") result = bumpUi(orig);
  else result = bumpFull(orig, SKIP_TEXTSM_TO_BASE.has(file));
  if (result.content !== orig) {
    fs.writeFileSync(file, result.content, "utf8");
    report[file] = result.stats;
  }
}

let total = 0;
for (const dir of FULL_DIRS) {
  for (const f of walk(dir)) {
    processFile(f, "full");
    total++;
  }
}
for (const f of walk(UI_DIR)) {
  processFile(f, "ui");
  total++;
}

console.log("Processed files (changed shown below):", total);
let changed = 0;
for (const [file, stats] of Object.entries(report)) {
  changed++;
  const parts = Object.entries(stats)
    .map(([k, v]) => `${k}:${v}`)
    .join("  ");
  console.log(`• ${path.relative(ROOT, file)}\n    ${parts}`);
}
console.log(`\nChanged files: ${changed}`);
