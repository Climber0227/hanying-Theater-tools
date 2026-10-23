// 把角色 / 辅助机 / 玩家头像从资源站拉下来，缩到 96px WebP 存进 public/img/chars/，
// 并生成 src/api/charPack.generated.js（哪些路径有本地小图）。
//
// 为什么：原图是 1024×1024 的 WebP（单张 40–150KB），页面上只显示 20–48px。
// 抽成本地小图后单张约 2–4KB，首页排行榜那 90 个角色头像从十几 MB 降到几百 KB。
//
// 为什么用 curl 而不是 fetch：本机到 assets.huaxu.app 的直连经常卡住（约一半请求 25s 不返回），
// 走系统代理 127.0.0.1:7877 后基本秒回；node 的 fetch 默认不认 HTTPS_PROXY，所以直接调 curl。
//
// 用法：node scripts/sync-char-icons.mjs [--force]

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const ROOT = process.cwd();
const ASSETS = 'https://assets.huaxu.app/cn';
const PROXY = process.env.ICON_PROXY || 'http://127.0.0.1:7877';
const RAW_DIR = path.join(ROOT, '.icons-raw');
const OUT_DIR = path.join(ROOT, 'public/img/chars');
const PACK_FILE = path.join(ROOT, 'src/api/charPack.generated.js');
const FORCE = process.argv.includes('--force');
const CONCURRENCY = 6;
const PASSES = 4;

// 只收这三类：角色头像、辅助机、玩家头像。icontools（涂装/武器）数量太多且只在弹窗里用，保持走原站。
const PREFIXES = ['image/rolecharacter/', 'image/rolepartner/', 'image/roleplayersp/'];

fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------- 1. 收集路径 ----------
const wanted = new Set();
const KEYS = new Set(['icon', 'cubIcon', 'portrait', 'frame', 'normalIcon', 'fashionIcon']);
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(walk);
  for (const [k, v] of Object.entries(node)) {
    if (KEYS.has(k) && typeof v === 'string' && PREFIXES.some((p) => v.startsWith(p))) wanted.add(v);
    else walk(v);
  }
}
for (const f of ['docs/perf/fixture-warzone-16.json', 'docs/perf/fixture-player.json']) {
  if (fs.existsSync(f)) walk(JSON.parse(fs.readFileSync(f, 'utf8')));
}
const slug = (p) => p.replace(/^image\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const list = [...wanted].sort();
console.log(`需要 ${list.length} 个图标`);

// ---------- 2. 下载（curl + 代理，多趟重试） ----------
async function fetchOne(p) {
  const raw = path.join(RAW_DIR, slug(p) + '.webp');
  if (!FORCE && fs.existsSync(raw) && fs.statSync(raw).size > 500) return true;
  try {
    await run('curl', ['-s', '--max-time', '25', '-x', PROXY, '-o', raw, `${ASSETS}/${p}.webp`], { timeout: 30000 });
    return fs.existsSync(raw) && fs.statSync(raw).size > 500;
  } catch {
    return false;
  }
}

let pending = list.slice();
for (let pass = 1; pass <= PASSES && pending.length; pass++) {
  const queue = pending.slice();
  const failed = [];
  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      if (p === undefined) return;
      if (!(await fetchOne(p))) failed.push(p);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  pending = failed;
  console.log(`第 ${pass} 趟：完成 ${list.length - pending.length}/${list.length}，失败 ${pending.length}`);
}
if (pending.length) console.log('仍然失败（这些会退回原站）：\n  ' + pending.slice(0, 10).join('\n  '));

// ---------- 3. 缩图 ----------
const PY =
  process.env.PYTHON ||
  'C:/Users/28135/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe';
const { stdout } = await run(PY, [path.join(ROOT, 'scripts/resize-char-icons.py'), RAW_DIR, OUT_DIR], { timeout: 900000 });
process.stdout.write(stdout);

// ---------- 4. 生成前端清单 ----------
const have = new Set(fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')));
const packed = list.filter((p) => have.has(slug(p)));
const body = `// 由 scripts/sync-char-icons.mjs 生成，请勿手改。
// 命中这里的路径，getImageUrl() 会用 /img/chars/ 下的 96px 本地小图。
const PACKED = new Set(${JSON.stringify(packed)});

const slug = (p) => p.replace(/^image\\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

export function localIconPath(imagePath) {
  return PACKED.has(imagePath) ? \`/img/chars/\${slug(imagePath)}.webp\` : null;
}
`;
fs.writeFileSync(PACK_FILE, body);
console.log(`生成 ${path.relative(ROOT, PACK_FILE)}：${packed.length} 项，${(body.length / 1024).toFixed(1)}KB`);
