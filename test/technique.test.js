/* ============================================================
 * 功法系统无头测试：node test/technique.test.js
 * 核心：验证篇章锁定——青元剑诀/大衍诀绝不出现在七玄门篇（忠于动漫改编）
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const sandbox = {
  console, Math, Date, window: {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  setTimeout: () => 0, clearTimeout: () => {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/combat.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, DATA } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

console.log("\n=== 功法系统 · 篇章锁定（忠于动漫改编）===");
State.create("韩立", "si");

assert(State.data.technique === "changchun", "本篇主修为《长春功》");
assert(DATA.techniques.changchun && !DATA.techniques.changchun.locked, "《长春功》本篇可修");
assert(DATA.techniques.qingyuan_sword.locked === true, "《青元剑诀》在七玄门篇锁定（黄枫谷篇才得）");
assert(DATA.techniques.great_development.locked === true, "《大衍诀》在七玄门篇锁定（黄枫谷篇才得）");

const banned = ["qingyuan_sword", "great_development"];
assert(!State.data.spells.some(id => banned.includes(id)), "玩家招式池不含锁定功法");

const storySrc = fs.readFileSync(path.join(__dirname, "..", "js/story.js"), "utf8");
assert(!/qingyuan_sword|青元剑诀/.test(storySrc), "剧情脚本未在本篇出现青元剑诀");
assert(!/great_development|大衍诀/.test(storySrc), "剧情脚本未在本篇出现大衍诀");

for (const [k, t] of Object.entries(DATA.techniques)) {
  assert(!!t.origin && !!t.name, `《${t.name}》标注了来历`);
}
assert(/血色禁地|封岳|燕家堡|董萱/.test(DATA.techniques.qingyuan_sword.origin), "青元剑诀来历含血色禁地/封岳/燕家堡（忠于动漫）");
assert(/千竹教|大衍|卧底|雷万鹤/.test(DATA.techniques.great_development.origin), "大衍诀来历含千竹教卧底/雷万鹤（忠于动漫）");

// 品阶分级
assert(DATA.techniques.changchun.grade === 1, "长春功为黄阶(1)");
assert(DATA.techniques.qingyuan_sword.grade === 3, "青元剑诀为地阶(3)");
assert(DATA.techniques.great_development.grade === 4, "大衍诀为天阶(4)");

console.log(`\n========== 功法系统：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
