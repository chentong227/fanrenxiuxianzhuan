/* 存读档边界深挖：每个 STORY 节点作为 pendingEvent 时，
 *   save→序列化→反序列化→_migrate→按 loadGame 路径求值 resolved text/choices→Cutscene 编译，
 *   全程不抛 = 不会软锁。覆盖全部节点（读档软锁那类 bug 的通用防线）。
 * 跑：node test/saveload.test.js */
const fs = require("fs"), vm = require("vm"), path = require("path");
const store = {};
const sb = {
  console: { log(){}, warn(){}, error(){} }, Math, Date, JSON,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  performance: { now: () => Date.now() },
};
sb.window = sb; sb.globalThis = sb; sb.navigator = { vibrate: () => {} };
sb.document = { body: { classList: { toggle(){}, add(){}, remove(){} } }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style:{}, classList:{add(){},remove(){},toggle(){}}, appendChild(){}, addEventListener(){} }) };
sb.UI = new Proxy({}, { get() { return () => {}; } });
sb.Audio = function(){ return { play(){return Promise.resolve();}, pause(){}, addEventListener(){} }; };
const ctx = vm.createContext(sb);
const files = ["js/data.js","js/state.js","js/chapters.js","js/balance.js","js/world.js","js/npcsim.js","js/interactions.js","js/combat.js","js/explore.js","js/exploremap.js","js/loadout.js","js/dialogue.js","js/fortunes.js","js/quests.js","js/cutscene.js","js/story.js","js/engine.js"];
for (const f of files) { try { vm.runInContext(fs.readFileSync(path.join(__dirname,"..",f),"utf8"), ctx, {filename:f}); } catch(e){ /* cutscene 等可能无导出，忽略加载顺序问题 */ } }
const { State, Engine, STORY, Cutscene } = sb;

let pass = 0, fail = 0;
function assert(cond, msg){ if(cond){pass++;}else{fail++;console.log("  X "+msg);} }

// 模拟 loadGame 的 pendingEvent 恢复路径（main.js loadGame）
function rebuildResolved(stage, s){
  return (typeof stage.text === "function" || typeof stage.choices === "function")
    ? Object.assign({}, stage, {
        text: typeof stage.text === "function" ? stage.text(s) : stage.text,
        choices: typeof stage.choices === "function" ? stage.choices(s) : stage.choices,
      })
    : stage;
}

console.log("== 存读档 roundtrip：每个 STORY 节点作 pendingEvent ==");
STORY.forEach((node, i) => {
  if (!node.id) return;
  // 造一个推进到该节点的存档
  State.create("韩立", { root: "wu" });
  const s = State.data;
  s.storyStage = i;
  s.pendingEvent = node.id;
  // roundtrip：序列化→反序列化→迁移
  let ok = true, resolved = null;
  try {
    State.save();
    // 用真实 State.load() 走完整加载+迁移路径（比手搓 JSON.parse 更贴近线上）
    const loaded = State.load();
    assert(loaded === true, `[${node.id}] State.load() 成功`);
  } catch(e){ ok = false; fail++; console.log(`  X [${node.id}] save/load/migrate 抛错: ${e.message}`); }
  // loadGame 恢复路径：求值 resolved text/choices
  try {
    const st = STORY.find(x => x.id === State.data.pendingEvent);
    if (st) {
      resolved = rebuildResolved(st, State.data);
      // 进一步：Cutscene 编译 resolved（读档软锁正是 cutscene 编 segs 报错）
      if (typeof Cutscene !== "undefined" && Cutscene.compile) Cutscene.compile(resolved);
    }
  } catch(e){ ok = false; fail++; console.log(`  X [${node.id}] loadGame 恢复/编译 抛错: ${e.message}`); }
  if (ok) pass++;
});

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
