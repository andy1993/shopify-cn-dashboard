// 输入控件字号封顶：Input / textarea / SelectTrigger 内的文字统一为 text-sm
// （符合规则四：输入框内文字 text-xs -> text-sm，且不应被规则三升级到 text-base）
// 幂等：text-base -> text-sm，text-xs -> text-sm。高度 h-* 不动。

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIRS = [path.join(ROOT, "app", "dashboard"), path.join(ROOT, "app", "config")];

function walk(dir, ext = ".tsx") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      out.push(...walk(p, ext));
    } else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const TRIGGER = /<Input\s|<textarea\s|SelectTrigger\s/;

function capLine(line) {
  if (!TRIGGER.test(line)) return line;
  // 双引号 className
  line = line.replace(/className="([^"]*)"/g, (_m, cls) => {
    const next = cls.replace(/text-base/g, "text-sm").replace(/text-xs/g, "text-sm");
    return `className="${next}"`;
  });
  // 模板字符串 className
  line = line.replace(/className=\{(`[^`]*`)\}/g, (_m, tpl) => {
    const next = tpl.replace(/text-base/g, "text-sm").replace(/text-xs/g, "text-sm");
    return `className={${next}}`;
  });
  return line;
}

let changed = 0;
const files = [];
for (const dir of DIRS) {
  for (const f of walk(dir)) {
    const orig = fs.readFileSync(f, "utf8");
    const lines = orig.split("\n");
    let dirty = false;
    for (let i = 0; i < lines.length; i++) {
      const capped = capLine(lines[i]);
      if (capped !== lines[i]) { lines[i] = capped; dirty = true; }
    }
    if (dirty) {
      fs.writeFileSync(f, lines.join("\n"), "utf8");
      changed++;
      files.push(path.relative(ROOT, f));
    }
  }
}
console.log(`Capped input text to text-sm in ${changed} files:`);
for (const f of files) console.log("•", f);
