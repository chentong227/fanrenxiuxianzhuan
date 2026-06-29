/* 冒烟深挖：无头加载全部 js，跑一串跨系统操作，捕获任何抛错。
 * 不是断言测试，是"会不会炸"的排雷——找 tests 覆盖不到的运行时异常。 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const store = {};
const errors = [];
const sb = {
  console: { log(){}, warn(){}, error(m){ errors.push("console.error: " + m); } },
  Math, Date, JSON, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  performance: { now: () => Date.now() },
};
sb.window = sb; sb.globalThis = sb; sb.navigator = { vibrate: () => {} };
sb.document = { body: { classList: { toggle(){}, add(){}, remove(){} } }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style:{}, classList:{add(){},remove(){},toggle(){}}, appendChild(){}, addEventListener(){} }) };
sb.UI = new Proxy({}, { get() { return () => {}; } });
sb.Audio = function(){ return { play(){return Promise.resolve();}, pause(){}, addEventListener(){} }; };
const ctx = vm.createContext(sb);
const files = ["js/data.js","js/state.js","js/chapters.js","js/balance.js","js/world.js","js/npcsim.js","js/interactions.js","js/combat.js","js/explore.js","js/exploremap.js","js/loadout.js","js/dialogue.js","js/fortunes.js","js/quests.js","js/story.js","js/engine.js"];
for (const f of files) { try { vm.runInContext(fs.readFileSync(path.join(__dirname,"..",f),"utf8"), ctx, {filename:f}); } catch(e){ errors.push("LOAD "+f+": "+e.message); } }
const { State, Engine, STORY, WORLD } = sb;

function run(label, fn){ try { fn(); } catch(e){ errors.push(label+": "+e.message); } }

// 1. 全篇章每个 STORY 节点的 text()/choices() 求值（动态文本不炸）
run("create", () => State.create("韩立", { root: "wu" }));
let textErrs = 0;
STORY.forEach((node, i) => {
  const s = State.data;
  run("node["+i+":"+(node.id||"?")+"].text", () => { if (typeof node.text === "function") node.text(s); });
  run("node["+i+":"+(node.id||"?")+"].choices", () => { if (typeof node.choices === "function") node.choices(s); });
  run("node["+i+":"+(node.id||"?")+"].objHint", () => { if (typeof node.objHint === "function") node.objHint(s); });
});
// 2. currentObjective 在各 storyStage 不炸
run("objectives", () => { for (let i=0;i<STORY.length;i++){ State.data.storyStage=i; Engine.currentObjective(); } });
// 3. 各地点 location() + 旅途 gate 求值
run("locations", () => { (WORLD.continent.nodes||[]).forEach(n => { if(typeof n.gate==="function") n.gate(State.data); }); });

console.log = function(){}; // silence
process.stdout.write("SMOKE 错误数: " + errors.length + "\n");
errors.slice(0, 30).forEach(e => process.stdout.write("  ! " + e + "\n"));
process.exit(errors.length ? 1 : 0);
