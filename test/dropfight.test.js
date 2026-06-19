/* ============================================================
 * D1-a 直接坠入·引擎层无头测试：node test/dropfight.test.js
 * 覆盖：Engine.startFight(id) 路由表（id→既有 startXxxFight）、hasFight、
 *      未知 id fail-soft（返回 false 不抛、不派发）、pendingEvent 清位、
 *      Engine.canWarp / gotoLocation（已知地点坠入、未知 fail-soft、战斗中拒绝）。
 *   不依赖 DOM：UI 以 no-op Proxy 桩，start 函数以桩记录调用（不跑真实战斗逻辑）。
 * ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const store = {};
const sandbox = {
  console, Math, Date, window: {},
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.UI = new Proxy({}, { get() { return () => {}; } });
const ctx = vm.createContext(sandbox);
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js",
  "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js",
  "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, WORLD } = sandbox;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失: ${msg}`); }
}

State.create("测试道友", "si");

// —— 以桩替换既有战斗入口：只记录"被派发到谁"，不跑真实战斗 ——
const calls = [];
const FNS = ["startShowdownFight", "startJinguangFight", "startRevengeFight", "startWanHunt",
  "startLuyunfengFight", "startPatrolFight", "startSantuanFight", "startTuoshiFight", "startXuwangFight",
  "startJinbeiFight", "startDuosheFight", "startJinguFight", "startHushanFight", "startHudaoFight",
  "startKuangdongFight", "startStarseaYaoshouFight", "startStarseaLeitaiFight", "startStarseaYingliFight",
  "startStarseaJiuzilingFight", "startStarseaWaihaiFight"];
FNS.forEach(fn => { Engine[fn] = function () { calls.push(fn); }; });
Engine.startEncounterFight = function (type) { calls.push("enc:" + type); };
Engine._nangongwanAlly = function () { return "__ally__"; };

console.log("== 1. startFight(id) 路由表：每个 id 派发到既有入口 ==");
function routes(id, expect) {
  calls.length = 0;
  const ok = Engine.startFight(id);
  assert(ok === true && calls[0] === expect, `startFight("${id}") → ${expect}`);
}
routes("showdown_win", "startShowdownFight");
routes("showdown_risk", "startShowdownFight");
routes("showdown", "startShowdownFight");                 // 别名
routes("jinguang_win", "startJinguangFight");
routes("jinguang", "startJinguangFight");                 // 别名
routes("revenge_fight", "startRevengeFight");
routes("wan_hunt_fight", "startWanHunt");
routes("luyunfeng_fight", "startLuyunfengFight");
routes("fengyue_fight", "enc:fengyue");
routes("mojiao_fight", "enc:mojiao");
routes("zhanwangchan_fight", "enc:zhanwangchan");
routes("zhanwangchan", "enc:zhanwangchan");               // 别名（战王蝉）
routes("xuanle_fight", "enc:xuanle");
routes("xueyu_zhizhu_fight", "enc:xueyu_zhizhu");
routes("tieluo_fight", "enc:tieluo");
routes("tieluo2_fight", "enc:tieluo_mao");
routes("wuse_fight", "enc:wuse_menzhu");
routes("moxiu_patrol_fight", "startPatrolFight");
routes("santuan_fight", "startSantuanFight");
routes("tuoshi_fight", "startTuoshiFight");
routes("xuwang_final_fight", "startXuwangFight");
routes("jinbei_fight", "startJinbeiFight");
routes("duoshe_fight", "startDuosheFight");
routes("jingu_fight", "startJinguFight");
routes("hushan_fight", "startHushanFight");
routes("hudao_fight", "startHudaoFight");
routes("kuangdong_fight", "startKuangdongFight");
routes("starsea_yaoshou_fight", "startStarseaYaoshouFight");
routes("starsea_leitai_fight", "startStarseaLeitaiFight");
routes("starsea_yingli_fight", "startStarseaYingliFight");
routes("starsea_jiuziling_fight", "startStarseaJiuzilingFight");
routes("starsea_waihai_fight", "startStarseaWaihaiFight");

console.log("== 1b. encounter 型临场参数：_nextFightType / 侧援布置正确 ==");
{
  calls.length = 0;
  Engine.startFight("zhanwangchan_fight");
  assert(Engine._nextFightType === "zhanwangchan", "encounter 设 _nextFightType");
  Engine.startFight("mojiao_fight");
  assert(Engine._sideOverride === "__ally__", "mojiao before 钩子布置南宫婉侧援");
}

console.log("== 2. hasFight：已知/别名 true，未知/空 false ==");
assert(Engine.hasFight("showdown_win") === true, "hasFight 已知 id=true");
assert(Engine.hasFight("zhanwangchan") === true, "hasFight 别名=true");
assert(Engine.hasFight("no_such_fight") === false, "hasFight 未知 id=false");
assert(Engine.hasFight(undefined) === false, "hasFight(undefined)=false");
assert(Engine.hasFight("") === false, "hasFight('')=false");

console.log("== 3. 未知 id fail-soft：返回 false、不派发、不抛 ==");
{
  calls.length = 0;
  const r = Engine.startFight("no_such_fight");
  assert(r === false, "startFight 未知 id→false（调用方据此退回旧选择屏）");
  assert(calls.length === 0, "未知 id 不派发任何战斗");
  let threw = false, r2;
  try { r2 = Engine.startFight(undefined); } catch (e) { threw = true; }
  assert(threw === false && r2 === false, "startFight(undefined)→false 不抛");
}

console.log("== 4. pendingEvent：派发成功即清场（同既有 chooseStory 语义）==");
{
  State.data.pendingEvent = "yanjia_boss";
  Engine.startFight("zhanwangchan_fight");
  assert(State.data.pendingEvent === null, "startFight 成功→pendingEvent=null");
  State.data.pendingEvent = "x";
  Engine.startFight("no_such_fight");
  assert(State.data.pendingEvent === "x", "未知 id→不动 pendingEvent（零副作用）");
}

console.log("== 5. canWarp / gotoLocation：地点坠入（薄封装，复用既有地点系统）==");
{
  // 收束副作用，聚焦坠入语义
  Engine.checkStory = function () {};
  Engine.checkLifespan = function () {};
  Engine._resolveLeadsAt = function () {};
  const logs = [];
  Engine.log = function (t) { logs.push(t); };

  assert(Engine.canWarp("houshan") === true, "canWarp 已知地点=true");
  assert(Engine.canWarp("no_such_loc") === false, "canWarp 未知地点=false");
  assert(Engine.canWarp(undefined) === false, "canWarp(undefined)=false");

  State.data.combat = null;
  State.data.location = "qingniu";
  const okw = Engine.gotoLocation("houshan", { spot: "yaolu", arrive: true });
  assert(okw === true && State.data.location === "houshan", "gotoLocation 已知→true 且切换地点（不耗赶路时月）");
  assert(logs.length === 1, "gotoLocation 落一条到达见闻");

  assert(Engine.gotoLocation("no_such_loc") === false, "gotoLocation 未知→false（fail-soft）");
  assert(State.data.location === "houshan", "未知目标不改地点（零副作用）");

  State.data.combat = { ongoing: true };
  assert(Engine.gotoLocation("town") === false, "战斗中 gotoLocation→false（不抢占战斗）");
  State.data.combat = null;
}

console.log(`\n========== D1-a 直接坠入：${fail === 0 ? "全通 ✓" : fail + " 项败 ✗"}（${pass} 项）==========`);
process.exit(fail ? 1 : 0);
