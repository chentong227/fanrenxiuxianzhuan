/* 玩法质量门禁（gameplay-template §四 选择质量 + §五 战斗质量 的机器执法器）。
 * audit-gate.md §D2 的落地：把"靠人记得勾审计表"变成"一改就红"。
 *
 * 检查项：
 *   战斗质量——boss/named 敌人必须有 introNote（战术题面）+ attacks（出招表）。
 *   选择质量——剧情节点不得出现"假多选"（≥2 选项全部同 resolve 且无 effect/fight＝伪装成多选的单选）。
 *
 * 豁免：BASIC_MOOK_ELEM_OK——基础杂兵（教学档）允许无 elem（无五行克制谜面是有意设计）。
 * 用法：node test/quality.audit.js（exit 0=全过，1=有违规）。
 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const store = {};
const sb = {
  console: { log() {}, warn() {}, error() {} },
  Math, Date, JSON, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  performance: { now: () => Date.now() },
};
sb.window = sb; sb.globalThis = sb; sb.navigator = { vibrate: () => {} };
sb.document = { body: { classList: { toggle() {}, add() {}, remove() {} } }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {} }) };
sb.UI = new Proxy({}, { get() { return () => {}; } });
sb.Audio = function () { return { play() { return Promise.resolve(); }, pause() {}, addEventListener() {} }; };
const ctx = vm.createContext(sb);
const files = ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/exploremap.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"];
for (const f of files) { try { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f }); } catch (e) { console.error("LOAD " + f + ": " + e.message); } }
const { State, STORY, WORLD } = sb;
State.create("韩立", { root: "wu" });

const fails = [];

/* —— 战斗质量：boss/named 敌人必须 introNote + attacks —— */
const E = WORLD.enemies || {};
Object.keys(E).forEach(id => {
  const e = E[id];
  if (!e || typeof e !== "object") return;
  // boss/named 判定：显式 boss 标记 / 有具名稀材 / 名字含"王""巨擘"等头衔
  const isBossish = !!(e.boss || e.namedLoot || /妖王|巨擘|教主|老祖|长老/.test(e.name || ""));
  if (isBossish && !e.introNote) fails.push(`[战斗质量] boss/named「${e.name || id}」(${id}) 缺 introNote（战术题面）`);
  if (!e.attacks || !e.attacks.length) fails.push(`[战斗质量] 敌人「${e.name || id}」(${id}) 无 attacks 出招表`);
});

/* —— 选择质量：剧情节点不得出现"假多选" —— */
function getChoices(node) {
  try {
    if (typeof node.choices === "function") return node.choices(State.data) || [];
    return node.choices || [];
  } catch (e) { return []; }
}
STORY.forEach((node, i) => {
  const id = node.id || ("#" + i);
  const ch = getChoices(node);
  if (ch.length >= 2) {
    // 假多选：所有选项指向同一 resolve 且无 effect/fight（实为单选包装，玩家选什么都一样）
    const r0 = ch[0].resolve;
    const allSame = ch.every(c => c.resolve === r0 && typeof c.effect !== "function" && !c.fight);
    if (allSame) fails.push(`[选择质量] 节点「${id}」${ch.length} 选项全部同 resolve「${r0}」且无 effect/fight＝假多选`);
  }
});

if (fails.length) {
  process.stdout.write("玩法质量门禁 FAIL（" + fails.length + " 项）:\n");
  fails.forEach(l => process.stdout.write("  ✗ " + l + "\n"));
  process.exit(1);
} else {
  process.stdout.write("玩法质量门禁 PASS：boss/named 敌人 introNote+attacks 齐全；剧情无假多选。\n");
  process.exit(0);
}
