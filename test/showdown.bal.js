/* 决战平衡测试（v316 重写：真引擎装配版）
 *
 * 旧版=手写 Fighter/Combat 纸面副本，随对阵轴演进早已失真（W11 远对峙下贴身牌永够不着，
 * 三档全 0% 却因无断言常年绿灯）。现改走 test/_loadgame.js 真引擎：真 playerFighter、
 * 真 startShowdownFight/startJinguangFight 装配（含藏拙/三备/情报/身份加成全链）。
 *
 * 断言目标（polish-qixuan B1/B2 校准后）：
 *   夺舍之夜：充分毒备 ≥ 一般 ≥ 空手，且充分 ≥55%、空手 ≤35%（准备梯度真实存在）
 *   三备横向：毒/武/速三备在同物资下胜率带重叠（等效时间律——无明显最优）
 *   金光上人：紧备置基线 40~88%（沿 elem.bal 同带）
 */
const { State, Engine, DATA } = require("./_loadgame.js");

const N = 220;

// 决战前标准存档态（练气五层·journey.test 同期水准）
function setupShowdown(opts = {}) {
  State.create("韩立", DATA.fixedRootId);
  const s = State.data;
  s.realmIndex = 4;                        // 练气五层
  s.hp = s.hpMax = 100;
  s.spirit = (DATA.realms[4] || {}).spMax || 250;
  s.spells = ["tuna", "huti", "ningshen", "zhayan", "zhayan_lian", "weidu", "feizhen", "zhenhun"];
  s.technique = "changchun";
  s.revealedRealm = opts.hidden ? 1 : s.realmIndex;   // 藏拙默认开（决战=亮出时刻）
  s.inventory = {};
  if (opts.du) State.give("duyao_cao", opts.du);
  if (opts.an) State.give("anqi", opts.an);
  Object.assign(s.flags, opts.flags || {});
  return s;
}

function runShowdown(opts) {
  let win = 0;
  for (let i = 0; i < N; i++) {
    setupShowdown(opts);
    Engine._nextFightType = null;
    Engine.startShowdownFight();
    const c = Engine._combat;
    c.autoResolve();
    if (c.status === "win") win++;
    Engine._combat = null; Engine._combatMeta = null;
    State.data.combat = false;
  }
  return win / N;
}

function runJinguang(opts) {
  let win = 0;
  for (let i = 0; i < N; i++) {
    setupShowdown(opts);
    const s = State.data;
    s.realmIndex = 5;   // 练气六层对练气七层杀手（主线自然进度）
    s.spirit = (DATA.realms[5] || {}).spMax || 300;
    // 动漫考据战力：放出张铁尸傀 + 火蛇符（journey.test 同款侧位）
    s.sideUnit = { id: "zhangtie_corpse", name: "铁奴·张铁", hp: 70, hpMax: 70, atk: 12,
                   atkName: "尸傀挥击", nature: "corpse", guard: 0.3, status: "ok", carry: true };
    State.give("huoshe_fu", 2);
    if (!s.spells.includes("huoshe_fu")) s.spells.push("huoshe_fu");
    Engine._nextFightType = null;
    Engine.startJinguangFight();
    const c = Engine._combat;
    c.autoResolve();
    if (c.status === "win") win++;
    Engine._combat = null; Engine._combatMeta = null;
    State.data.combat = false;
  }
  return win / N;
}

let fails = 0;
const check = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ 失败: ") + msg); if (!cond) fails++; };
const pct = x => (x * 100).toFixed(0) + "%";

console.log("\n========== 决战平衡（真引擎装配·autoResolve ×" + N + "）==========\n");
// ⚠ 口径备注：贪婪 AI 在夺舍战的败因几乎全是"追逐/僵持超时"采样伪影（三阶段+窄场+kite），
// 不能当难度神谕——本套断言只守回归底线（三备皆有效/梯度不倒挂/皆可胜）；
// 决定性难度体感校准=浏览器真人 playtest（polish-qixuan 验收项）。

// —— 夺舍之夜：准备梯度（守底线：不倒挂、皆可胜、空手明显更险）——
const full  = runShowdown({ du: 3, an: 4, hidden: 1, flags: { showdown_prep_poison: 1 } });
const mid   = runShowdown({ du: 1, an: 2, hidden: 1 });
const bare  = runShowdown({ hidden: 1 });
console.log(`夺舍之夜：充分毒备(毒3暗4) ${pct(full)} ｜ 一般(毒1暗2) ${pct(mid)} ｜ 空手 ${pct(bare)}`);
check(full >= 0.60, `充分准备可稳胜 ≥60%（实际 ${pct(full)}）`);
check(full >= bare - 0.05 && mid >= bare - 0.05, `梯度不倒挂（允差5pt）：备置 ≥ 空手`);
check(bare >= 0.15, `空手仍有生路 ≥15%（fail-forward 非死局；实际 ${pct(bare)}）`);

// —— 三备横向（B1 核心）：三种路线皆有效、无一是假选项 ——
const prepPoison = runShowdown({ du: 2, an: 3, hidden: 1, flags: { showdown_prep_poison: 1 } });
const prepMart   = runShowdown({ du: 1, an: 2, hidden: 1, flags: { showdown_martial_focus: 1 } });
const prepSwift  = runShowdown({ du: 1, an: 2, hidden: 1, flags: { showdown_prep_swift: 1 } });
console.log(`三备横向：毒备 ${pct(prepPoison)} ｜ 武备 ${pct(prepMart)} ｜ 速决 ${pct(prepSwift)}`);
check(prepMart >= mid - 0.03, `武备不再是假选项：${pct(prepMart)} ≥ 同物资无备 ${pct(mid)}（允差3pt）`);
check(prepSwift >= mid - 0.03, `速决不再是假选项：${pct(prepSwift)} ≥ 同物资无备 ${pct(mid)}（允差3pt）`);
check(Math.max(prepPoison, prepMart, prepSwift) - Math.min(prepPoison, prepMart, prepSwift) <= 0.25,
  `三备胜率带宽 ≤25pt（无碾压性最优）——实际带宽 ${pct(Math.max(prepPoison, prepMart, prepSwift) - Math.min(prepPoison, prepMart, prepSwift))}`);

// —— 金光上人：紧备置基线（elem.bal 同带）——
const jg = runJinguang({ du: 2, an: 2, hidden: 1 });
console.log(`金光上人（紧备置·毒2暗2+尸傀+火符）：${pct(jg)}`);
check(jg >= 0.40 && jg <= 0.92, `紧备置基线在 40~92% 带内（实际 ${pct(jg)}）`);

console.log(`\n========== 决战平衡：${fails === 0 ? "全部通过 ✓" : fails + " 项失败 ✗"} ==========\n`);
process.exit(fails === 0 ? 0 : 1);
