/* ============================================================
 * 对阵轴战斗引擎无头测试：node test/combat.test.js
 * 覆盖：灵力池/射程/贴身/移动挡线/瞬发/三型攻击(锁头·格子·范围)/
 *      遁走/蓄势打断/蓝尽/行动经济/克制特攻/速决
 * ============================================================ */
const { Combat, Fighter, SPELLS } = require("../js/combat.js");
const Balance = require("../js/balance.js");

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ 失败: " + msg); failures++; }
}
function seqRng(seq) { let i = 0; return () => seq[(i++) % seq.length]; }
const noCrit = () => 0.99;   // 永不暴击/不闪避/不触发概率事件

function mkHan(extra) {
  return new Fighter(Object.assign({
    name: "韩立", hp: 100, mp: 90, qiLayer: 11, team: "player", move: 1, speed: 12,
    insight: 0, agility: 0,
    spells: ["tuna", "huti", "ningshen", "zhayan", "weidu", "feizhen", "huodan", "huoshe_fu", "jinguang_zhuan", "zimu_ren"],
    pouch: { duyao_cao: 3, anqi: 3, huoshe_fu: 2, jinguang_zhuan_charge: 3 },
  }, extra || {}));
}
function dummy(extra) {
  return Object.assign({ name: "木桩", hp: 200, agility: 0, speed: 10, atk: 0, atkName: "发呆", mp: 60 }, extra || {});
}

console.log("\n=== 1. 灵力池：整场不刷新、凝息回元亮破绽 ===");
{
  const c = new Combat({ player: mkHan(), enemies: [dummy()], rng: noCrit });
  c.startRound();
  c.player.pos = 2; c.enemies[0].pos = 4;   // 距2：火弹术程内
  const mp0 = c.player.mp;
  c.cast("huodan", 0);          // 耗12
  assert(c.player.mp === mp0 - 12, `火弹术耗灵力12（${mp0}→${c.player.mp}）`);
  c.endRound(); c.startRound();
  assert(c.player.mp === mp0 - 12, "回合开始灵力不自动恢复（池制）");
  const r = c.cast("ningshen", 0);
  assert(r.ok && c.player.mp === Math.min(c.player.mpMax, mp0 - 12 + 12), "凝息回元+12（不超池上限）");
  assert(c.player.exposed === true, "凝息后破绽毕露（exposed）");
  const dmgTest = c.player.takeDamage(10, {});
  assert(dmgTest.dealt === 13, `破绽中受击+30%（10→${dmgTest.dealt}）`);
}

console.log("\n=== 2. 射程与贴身 ===");
{
  const c = new Combat({ player: mkHan(), enemies: [dummy()], rng: noCrit });
  c.startRound();
  // 初始 player pos1, enemy pos10（W11，v95 大战场小人物：标准战 9→11）：距9
  assert(c.dist(c.player, c.enemies[0]) === 9, `开局距离9（玩家${c.player.pos}，敌${c.enemies[0].pos}）`);
  const far = c.cast("zhayan", 0);
  assert(!far.ok, `眨眼剑法距7施放失败（${far.reason}）`);
  const far2 = c.cast("zimu_ren", 0);
  assert(!far2.ok, "御使子母刃距7也够不着（程1-3）");
  // 拉近到贴身测贴身惩罚
  c.enemies[0].pos = 2;   // 距1
  const hp0 = c.enemies[0].hp;
  c.cast("zimu_ren", 0);  // 御物贴身-30%：7→5/段 ×2段
  const dealt = hp0 - c.enemies[0].hp;
  assert(dealt === 10, `御物贴身两段共10伤（-30%惩罚，实际${dealt}）`);
  const r2 = c.cast("zhayan", 0);
  assert(!r2.ok && /主行动/.test(r2.reason), "主行动每回合一次");
}

console.log("\n=== 3. 移动与挡线 ===");
{
  const c = new Combat({ player: mkHan({ move: 5 }), enemies: [dummy()], rng: noCrit });
  c.startRound();
  c.player.pos = 2; c.enemies[0].pos = 4;
  assert(!c.canMoveTo(c.player, 6), "敌方占格挡路：穿不过去（挡线）");
  assert(c.canMoveTo(c.player, 3), "可走到敌身前一格");
  const mv = c.playerMove(3);
  assert(mv.ok && c.player.pos === 3, "移动成功");
  const mv2 = c.playerMove(2);
  assert(mv2.ok, "剩余步数内可再移动");
  const mv3 = c.playerMove(0);   // 已用2步，剩3步，0距2格 ok
  assert(mv3.ok && c.player.pos === 0, "分段移动累计扣步数");
  const mv4 = c.playerMove(3);   // 已用4步，剩1步，0→3 距3 超了
  assert(!mv4.ok, "剩余步数不够不能再动");
}

console.log("\n=== 4. 瞬发牌：不占主行动、每回合限一张 ===");
{
  const c = new Combat({ player: mkHan(), enemies: [dummy()], rng: noCrit });
  c.startRound();
  c.player.pos = 1; c.enemies[0].pos = 4;   // 距3：符程1-4、子母刃程1-3
  const q = c.cast("huoshe_fu", 0);
  assert(q.ok, "火蛇符瞬发成功");
  const main = c.cast("zimu_ren", 0);
  assert(main.ok, "瞬发后主行动仍可用");
  const q2 = c.cast("jinguang_zhuan", 0);
  assert(!q2.ok && /瞬发/.test(q2.reason), "每回合限一张瞬发");
}

console.log("\n=== 5. 近战必打相邻：侧位=真墙 ===");
{
  const side = { id: "tienu", name: "铁奴", kind: "corpse", hp: 60, hpMax: 60, atk: 10, atkName: "尸傀挥击", guard: 0, nature: "corpse" };
  const wolf = dummy({ name: "灵狼", nature: "beast", atk: 15, atkName: "撕咬", hp: 80, tactics: null, attacks: [{ name: "撕咬", dmg: 15, kind: "normal" }] });
  const c = new Combat({ player: mkHan(), enemies: [wolf], side, rng: noCrit });
  c.startRound();
  // 摆位：侧位在玩家身前贴敌（摆位后重锁意图——意图基于真实距离）
  c.player.pos = 1; c.side.pos = 3; c.enemies[0].pos = 4;
  c._rollEnemyIntents();
  const sideHp0 = c.side.hp, pHp0 = c.player.hp;
  c.cast("ningshen", 0);   // 随便用掉主行动
  c.endRound();
  assert(c.side.hp < sideHp0, `近战敌打的是挡线尸傀（尸傀${sideHp0}→${c.side.hp}）`);
  assert(c.player.hp === pHp0 || c.player.hp === pHp0, "玩家没挨刀（墙生效）");
}

console.log("\n=== 6. 打格子（cell）：移开=落空，站桩=实打 ===");
{
  const tiger = dummy({ name: "虎王", nature: "beast", hp: 300, move: 0,
    attacks: [{ name: "扑击", dmg: 24, kind: "normal", aim: "cell", range: [1, 9] }] });
  // 场1：玩家移开
  const c = new Combat({ player: mkHan({ move: 2 }), enemies: [tiger], rng: noCrit });
  c.startRound();
  assert(c.enemies[0].intent.targetCell === c.player.pos, "意图亮出目标格=玩家当前格");
  const hp0 = c.player.hp;
  c.playerMove(c.player.pos + 1);
  c.endRound();
  assert(c.player.hp === hp0, "移开一格——扑击落空");
  // 场2：站桩硬吃
  const c2 = new Combat({ player: mkHan(), enemies: [Object.assign({}, tiger)], rng: noCrit });
  c2.startRound();
  const hp1 = c2.player.hp;
  c2.cast("ningshen", 0);   // 不动（且破绽）
  c2.endRound();
  assert(c2.player.hp < hp1, `站桩被砸实（${hp1}→${c2.player.hp}）`);
}

console.log("\n=== 6.5 躲闪三角：趁虚窗口 / 扑击惯性 / 追踪修正 ===");
{
  // 前躲吃趁虚：扑空 → _whiffed → 受击+30%，窗口到它下次行动关闭
  const tiger = dummy({ name: "虎王", nature: "beast", hp: 300, move: 0,
    attacks: [{ name: "扑击", dmg: 24, kind: "normal", aim: "cell", lunge: true, range: [1, 9] }] });
  const c = new Combat({ player: mkHan({ move: 2 }), enemies: [tiger], rng: noCrit });
  c.startRound();
  const cellLocked = c.enemies[0].intent.targetCell;
  c.playerMove(c.player.pos + 1);   // 前躲一格
  c.endRound();
  assert(c.enemies[0]._whiffed === true, "扑空后亮出趁虚窗口（_whiffed）");
  assert(c.enemies[0].pos === cellLocked, `扑击惯性：敌冲进落点格（pos=${c.enemies[0].pos}）`);
  c.startRound();
  // 此刻敌在你身侧（你+1 前躲、它扑进你原位）——贴身反击吃趁虚
  const hp0 = c.enemies[0].hp;
  const d = c.dist(c.player, c.enemies[0]);
  assert(d === 1, `换位后贴身（距${d}）——前躲的人才吃得到这口肉`);
  c.cast("zhayan", 0);   // 武学：15×0.8源系数=12，趁虚×1.3=16（martial 不吃贴身惩罚）
  const dealt = hp0 - c.enemies[0].hp;
  assert(dealt === 16, `趁虚反击+30%（12→${dealt}）`);
  c.endRound();
  assert(c.enemies[0]._whiffed === false, "敌再次行动后趁虚窗口关闭");

  // 追踪修正：后躲一格被追上
  const hawk = dummy({ name: "隼妖", nature: "beast", hp: 200, move: 0,
    attacks: [{ name: "贯日喙", dmg: 20, kind: "normal", aim: "cell", track: true, range: [1, 9] }] });
  const c2 = new Combat({ player: mkHan({ move: 1 }), enemies: [hawk], rng: noCrit });
  c2.startRound();
  const hp1 = c2.player.hp;
  c2.playerMove(c2.player.pos + 1);   // 只躲一格
  c2.endRound();
  assert(c2.player.hp < hp1, "track 技：一步躲不开（落点追踪修正）");
}

console.log("\n=== 7. 范围（zone）：区间全体，侧位也吃 ===");
{
  const drake = dummy({ name: "墨蛟", nature: "beast", hp: 300,
    attacks: [{ name: "怒涛", dmg: 14, kind: "normal", aim: "zone", zoneSpan: 1, range: [1, 9] }] });
  // 侧位给远程招（免得它自己冲锋跑出区间）
  const side = { id: "tienu", name: "铁奴", kind: "corpse", hp: 60, hpMax: 60, guard: 0, nature: "corpse",
    moves: [{ name: "阴风爪", dmg: 8, range: [1, 9] }] };
  const c = new Combat({ player: mkHan(), enemies: [drake], side, rng: noCrit });
  c.startRound();
  c.player.pos = 3; c.side.pos = 4; c.enemies[0].pos = 8;
  // 重新锁意图（位置摆好后）
  c._rollEnemyIntents();
  const pHp = c.player.hp, sHp = c.side.hp;
  c.cast("ningshen", 0);
  c.endRound();
  assert(c.player.hp < pHp && c.side.hp < sHp, `怒涛区间内玩家与侧位都吃伤（玩家${pHp}→${c.player.hp}，侧位${sHp}→${c.side.hp}）`);
}

console.log("\n=== 8. 遁走：玩家阵脚抽身 / 敌残血逃逸 ===");
{
  const c = new Combat({ player: mkHan(), enemies: [dummy({ atk: 5 })], rng: noCrit });
  c.startRound();
  c.player.pos = 0;
  const f = c.playerFlee();
  assert(f.ok && c.status === "fled", "玩家在最左格遁走成功（status=fled）");

  const runner = dummy({ name: "怯敌", hp: 100, canFlee: true, move: 2, attacks: [{ name: "斩", dmg: 8, kind: "normal" }] });
  const c2 = new Combat({ player: mkHan(), enemies: [runner], rng: seqRng([0.0]) });
  c2.startRound();
  c2.enemies[0].hp = 5;   // 血只剩一成以下才起遁意（且非必逃——rng 0 必触发）
  c2._rollEnemyIntents();
  assert(c2.enemies[0].intent.kind === "flee", "命悬一线的敌意图=遁走（血≥一成时绝不轻易跑）");
  for (let i = 0; i < 4 && c2.status === "ongoing"; i++) { c2.cast("ningshen", 0); c2.endRound(); c2.startRound(); }
  assert(c2.status === "win" && c2.enemies[0].escaped, "敌走脱后战斗以胜利收场（敌 escaped）");
}

console.log("\n=== 9. 蓄势：破绽毕露 + 受击概率打断 ===");
{
  const brute = dummy({ name: "蛮修", hp: 200, tactics: "feral",
    attacks: [{ name: "崩山锤", dmg: 20, kind: "charge", weight: 99 }] });
  // rng=0.0：必选 charge、且打断判定必断
  const c = new Combat({ player: mkHan(), enemies: [brute], rng: seqRng([0.0]) });
  c.startRound();
  c.enemies[0].pos = 2;   // 贴身（蓄力技 range[1,1]）——摆位后重锁意图
  c._rollEnemyIntents();
  c.cast("ningshen", 0);
  c.endRound();            // 敌进入蓄力
  assert(!!c.enemies[0]._charging, "敌进入蓄力");
  assert(c.enemies[0].exposed, "蓄力中破绽毕露");
  c.startRound();
  c.cast("zhayan", 0);     // 贴身打它——rng 0 必触发打断
  assert(!c.enemies[0]._charging, "蓄势被打断");
}

console.log("\n=== 10. 敌人蓝尽：孤注一掷 ===");
{
  const mage = dummy({ name: "枯修", hp: 150, mp: 4, atk: 10,
    attacks: [{ name: "火链术", dmg: 16, kind: "normal", mp: 8 }] });
  const c = new Combat({ player: mkHan(), enemies: [mage], rng: noCrit });
  c.startRound();
  assert(c.enemies[0].intent.desperate === true, `蓝不够出招→拼死一搏（${c.enemies[0].intent.name}）`);
}

console.log("\n=== 11. 行动经济：遁速差抢额外行动 ===");
{
  const c = new Combat({ player: mkHan({ speed: 24 }), enemies: [dummy({ speed: 10 })], rng: seqRng([0.0]) });
  c.startRound();   // diff=14 → extraAction 必触发（rng 0）
  assert(c._pActsMax === 2, "遁速碾压：本回合主行动×2");
  c.enemies[0].pos = 3; c.player.pos = 2;
  const a1 = c.cast("zhayan", 0);
  const a2 = c.cast("zhayan", 0);
  assert(a1.ok && a2.ok, "两次主行动都打得出");
  const a3 = c.cast("zhayan", 0);
  assert(!a3.ok, "第三次没有了");
}

console.log("\n=== 12. 克制与特攻保留 ===");
{
  const goldie = dummy({ name: "金行修士", elem: "jin", hp: 100 });
  const c = new Combat({ player: mkHan(), enemies: [goldie], rng: noCrit });
  c.startRound();
  c.enemies[0].pos = 3; c.player.pos = 2;   // 距1...火弹range[1,2]，贴身惩罚对法术也有：×0.7
  c.enemies[0].pos = 4; c.player.pos = 2;   // 距2 无贴身惩罚
  const hp0 = c.enemies[0].hp;
  c.cast("huodan", 0);   // 火克金 ×1.25：24×1.25=30
  assert(hp0 - c.enemies[0].hp === 30, `火克金 ×1.25（实际${hp0 - c.enemies[0].hp}）`);
  // 尸傀毒免疫
  const corpse = dummy({ name: "尸傀", nature: "corpse", hp: 100 });
  const c2 = new Combat({ player: mkHan(), enemies: [corpse], rng: noCrit });
  c2.startRound();
  c2.enemies[0].pos = 2; c2.player.pos = 1;
  c2.cast("weidu", 0);
  assert(!c2.enemies[0].status.poison, "尸傀百毒不侵");
}

console.log("\n=== 12.5 灵力恢复链与控制：回元丹/金疮药/定身符（瞬发） ===");
{
  const c = new Combat({ player: mkHan({ hp: 60, hpMax: 110, mp: 40, mpMax: 90,
    spells: ["tuna", "huti", "ningshen", "zhayan", "huiyuan_dan", "jinchuang_yao", "dingshen_fu"],
    pouch: { huiyuan_dan: 1, huixue_dan: 1, dingshen_fu: 1 } }), enemies: [dummy()], rng: noCrit });
  c.startRound();
  c.player.pos = 2; c.enemies[0].pos = 5;
  const r1 = c.cast("huiyuan_dan", 0);
  assert(r1.ok && c.player.mp === 80, `回元丹瞬发+40灵力（40→${c.player.mp}）`);
  assert(!c._pActed, "吃丹不占主行动");
  c.endRound(); c.startRound();
  const r2 = c.cast("jinchuang_yao", 0);
  assert(r2.ok && c.player.hp > 60, `金疮药瞬发回血（60→${Math.round(c.player.hp)}）`);
  c.endRound(); c.startRound();
  const r3 = c.cast("dingshen_fu", 0);
  assert(r3.ok && c.enemies[0].status.dingshen === 1, "定身符瞬发：敌被定身1回合");
  const hp0 = c.player.hp;
  c.endRound();
  assert(c.player.hp === hp0, "被定身的敌人本回合没动手");
}

console.log("\n=== 12.6 阵法格：困足阵挡突进 / 聚灵阵回蓝 ===");
{
  const brute = dummy({ name: "蛮兽", nature: "beast", hp: 200, move: 2,
    attacks: [{ name: "撕咬", dmg: 18, kind: "normal", range: [1, 1] }] });
  const c = new Combat({ player: mkHan({ spells: ["tuna", "huti", "ningshen", "zhayan", "zhenqi_kunzu", "zhenqi_juling"],
    pouch: { zhenqi_kunzu: 1, zhenqi_juling: 1 } }), enemies: [brute], rng: noCrit });
  c.startRound();
  c.player.pos = 1; c.enemies[0].pos = 5;   // 距4：阵旗程内
  const rz = c.cast("zhenqi_kunzu", 0);   // 铺在敌脚下±1（4~6）
  assert(rz.ok && c.zones.length === 1 && c.zones[0].type === "kunzu", `困足阵铺设${c.zones[0] ? `（第${c.zones[0].from + 1}~${c.zones[0].to + 1}步）` : `失败：${rz.reason || ""}`}`);
  // 敌在阵内起步：第一步就陷
  c.cast("ningshen", 0);
  c.endRound();
  assert(c.dist(c.player, c.enemies[0]) > 1, `蛮兽被困足阵拖住，没贴到脸（距${c.dist(c.player, c.enemies[0])}）`);
  // 聚灵阵：铺自己脚下，回合开始回蓝
  c.startRound();
  const rj = c.cast("zhenqi_juling", 0);
  assert(rj.ok, "聚灵阵铺设（自家阵脚）");
  c.player.mp = 50;
  c.endRound(); c.startRound();
  assert(c.player.mp === 58, `立于聚灵阵中回蓝+8（50→${c.player.mp}）`);
  // 阵法随时间消散
  for (let i = 0; i < 6; i++) { c.endRound(); if (c.status !== "ongoing") break; c.startRound(); }
  assert(c.zones.length === 0 || c.status !== "ongoing", "阵法格随回合消散");
}

console.log("\n=== 12.65 雷遁（blink 钩子）：穿亚空间无视挡线与困足 ===");
{
  const wall = dummy({ name: "拦路兽", hp: 100, atk: 0 });
  const c = new Combat({ player: mkHan({ move: 3, blink: true }), enemies: [wall], rng: noCrit });
  c.startRound();
  c.player.pos = 2; c.enemies[0].pos = 4;
  assert(c.canMoveTo(c.player, 5), "雷遁可穿过敌方占格落到身后（挡线如无物）");
  c.zones.push({ from: 3, to: 3, type: "kunzu", turns: 3, team: "enemy" });
  const r = c.playerMove(5);
  assert(r.ok && c.player.pos === 5, "亚空间穿行：困足阵也踩不到（拉扯的资本）");
  const c2 = new Combat({ player: mkHan({ move: 3 }), enemies: [Object.assign({}, wall)], rng: noCrit });
  c2.startRound();
  c2.player.pos = 2; c2.enemies[0].pos = 4;
  assert(!c2.canMoveTo(c2.player, 5), "无雷遁者依旧被挡线拦住（对照）");
}

console.log("\n=== 12.7 玩家蓄势（chargeTurns 钩子）：起势→破绽→蓄满释放 ===");
{
  SPELLS.test_jianzhen = { name: "试剑阵", mp: 20, range: [1, 9], type: "atk", dmg: 40, chargeTurns: 2, source: "treasure", elem: "mu" };
  const c = new Combat({ player: mkHan({ mp: 100, spells: ["tuna", "huti", "ningshen", "zhayan", "test_jianzhen"] }), enemies: [dummy({ hp: 300, atk: 0 })], rng: noCrit });
  c.startRound();
  c.player.pos = 1; c.enemies[0].pos = 7;
  const r1 = c.cast("test_jianzhen", 0);
  assert(r1.ok && r1.charging && c.player._charging, "起势成功（占主行动+先付灵力）");
  assert(c.player.mp === 80 && c.player.exposed, "定金已付、破绽毕露");
  const r2 = c.cast("test_jianzhen", 0);
  assert(!r2.ok, `蓄势中不可再动此技（${r2.reason}）`);
  c.endRound(); c.startRound();   // left 2→1
  c.endRound(); c.startRound();   // left 1→0 蓄满
  assert(c.player._charging && c.player._charging.left <= 0, "两回合后蓄满待发");
  const hp0 = c.enemies[0].hp;
  const r3 = c.cast("test_jianzhen", 0);
  assert(r3.ok && !c.player._charging, "蓄满释放成功");
  const dealt = hp0 - c.enemies[0].hp;
  assert(dealt >= 60, `全威力×1.8 释放（伤${dealt}）`);
  // 移动打断
  const c2 = new Combat({ player: mkHan({ mp: 100, spells: ["zhayan", "test_jianzhen"] }), enemies: [dummy({ hp: 300, atk: 0 })], rng: noCrit });
  c2.startRound();
  c2.cast("test_jianzhen", 0);
  c2.playerMove(c2.player.pos + 1);
  assert(!c2.player._charging, "移动令蓄势溃散（坠魔谷名场面·玩家侧）");
  delete SPELLS.test_jianzhen;
}

console.log("\n=== 13. 速决（autoResolve）：碾压局快速取胜 ===");
{
  let wins = 0;
  for (let i = 0; i < 30; i++) {
    const c = new Combat({ player: mkHan({ hp: 130, mp: 110, qiLayer: 13 }), enemies: [dummy({ name: "拦路散修", hp: 70, atk: 10, attacks: [{ name: "斩", dmg: 10, kind: "normal" }] })] });
    c.startRound();
    if (c.autoResolve(16) === "win") wins++;
  }
  assert(wins >= 27, `碾压局速决胜率≥90%（${wins}/30）`);
}

console.log("\n=== 14. 推演一还原：陆云风之战（AI 自动打，胜率区间）===");
{
  let wins = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const lu = {
      name: "陆云风", hp: 190, sense: 11, speed: 12, agility: 9, move: 1,
      tactics: "cunning", qiLayer: 11, elem: "mu", armor: 3, mp: 84,
      attacks: [
        { name: "青叶剑光", dmg: 26, kind: "normal", weight: 12, elem: "mu", mp: 7 },
        { name: "缚灵金索", dmg: 22, kind: "pierce", weight: 7, elem: "jin", mp: 9 },
        { name: "怒剑诀", dmg: 36, kind: "charge", weight: 6, elem: "mu", mp: 12, range: [1, 4] },
      ],
    };
    // 牌况按推演一：金光砖充能1（七玄门战后未回充满）、符2、毒暗器若干
    // （v95 标准战 W 9→11：裸建战斗补 enemyPos=8 保持原推演的接敌距离 7——
    //  真实游戏路径由 engageDist 控距，不随 W 变）
    const c = new Combat({ player: mkHan({ hp: 150, mp: 100, qiLayer: 11,
      pouch: { duyao_cao: 2, anqi: 2, huoshe_fu: 2, jinguang_zhuan_charge: 1 } }), enemies: [lu], maxRounds: 18, enemyPos: 8 });
    c.startRound();
    if (c.autoResolve(18) === "win") wins++;
  }
  const rate = Math.round(wins / N * 100);
  console.log(`  · 陆云风战 AI 胜率：${rate}%（${wins}/${N}）`);
  assert(rate >= 25 && rate <= 100, `同阶恶战胜率在合理区间（AI 下限策略+满底牌，玩家手操更稳）`);
}

console.log("\n=== 15. 同轴一体：战中采集（热点上轴，花一个主行动摘下） ===");
{
  const c = new Combat({ player: mkHan(), enemies: [dummy()], rng: noCrit, W: 27,
    playerPos: 5, enemyPos: 25,
    hotspots: [
      { id: "h_near", pos: 6, name: "血色主药", loot: { xueshi_zhuyao: 2 } },
      { id: "h_far", pos: 13, name: "岩缝灵石", loot: { lingshi: 4 } },
    ] });
  c.startRound();
  const rFar = c.playerTake("h_far");
  assert(!rFar.ok, `隔太远战中也够不着（${rFar.reason}）`);
  const r1 = c.playerTake("h_near");
  assert(r1.ok && r1.loot.xueshi_zhuyao === 2, "邻格热点战中采得（主药×2）");
  assert(c._pActsUsed === 1, "采集吃掉一个主行动（这一拍没出手）");
  assert(c.hotspots.find(h => h.id === "h_near").taken, "采过即空（战斗轴上消失）");
  const r2 = c.playerTake("h_near");
  assert(!r2.ok, "复采无所得");
  const r3 = c.cast("ningshen", 0);
  assert(!r3.ok, "主行动已被采集占用——这回合出不了手（贪与稳的回合制等价物）");
}

console.log("\n=== 16. 空层 2.5D：升空/贴身隔层/俯击/击落/地雷不触/凌空耗灵 ===");
{
  const c = new Combat({ player: mkHan({ canFly: true, mp: 60 }), enemies: [dummy({
    name: "恶狼", hp: 120, nature: "beast",
    attacks: [{ name: "撕咬", dmg: 20, kind: "normal", weight: 10, range: [1, 1] }],
  })], rng: noCrit, W: 9, playerPos: 3, enemyPos: 4,
    mines: [{ cell: 5, kind: "anfu", dmg: 24 }] });
  c.startRound();
  const mp0 = c.player.mp;
  const up = c.playerFly();
  assert(up.ok && c.player.alt === 1, "升空成功（alt=1）");
  // 镜头三联动（D3）：升空耗尽地面脚力，但凌空身法+airMove——还能凭遁光滑行
  assert(c.playerCanMove() && c.moveCap(c.player) - c._pMoved === c.player.airMove,
    `升空脚力尽、余遁光滑行${c.player.airMove}格（凌空机动=境界档）`);
  c._pMoved = c.moveCap(c.player);   // 滑行也用完，进入"身法已尽"态（下面的断言沿用旧语义）
  assert(!c.playerCanMove(), "凌空步程用尽后身法已尽");
  const melee = c.cast("zhayan", 0);
  assert(!melee.ok, `凌空打不了地面贴身（${melee.reason}）`);
  // 俯击基线对照：同构地面战测一发火弹的素伤，再比空中的一发
  const cg = new Combat({ player: mkHan({ mp: 60 }), enemies: [dummy({ name: "恶狼", hp: 120, nature: "beast" })],
    rng: noCrit, W: 9, playerPos: 3, enemyPos: 4 });
  cg.startRound();
  const gHp = cg.enemies[0].hp;
  cg.cast("huodan", 0);
  const groundDealt = gHp - cg.enemies[0].hp;
  const hp0 = c.enemies[0].hp;
  c.cast("huodan", 0);
  const dealt = hp0 - c.enemies[0].hp;
  assert(dealt === Math.round(groundDealt * 1.15), `俯击+15%（地面${groundDealt}→空中${dealt}）`);
  // 敌贴身意图被过滤：仰首戒备（够不着天上）
  c._rollOneIntent(c.enemies[0]);
  assert(c.enemies[0].intent.kind === "approach" && c.enemies[0].intent.name === "仰首戒备",
    `地面近战敌对空中只能干瞪眼（${c.enemies[0].intent.name}）`);
  // 凌空耗灵：回合开始 -3
  const mpBefore = c.player.mp;
  c.endRound(); c.startRound();
  assert(c.player.mp === mpBefore - 3, `凌空每回合燃灵3（${mpBefore}→${c.player.mp}）`);
  // 击落：空中挨重击坠地+硬直
  c.player.alt = 1;
  const e = c.enemies[0];
  e.intent = { name: "巨石砸落", dmg: 30, kind: "normal", mp: 0, range: [1, 5] };
  c._enemyAct(e);
  assert(c.player.alt === 0 && c.player._knocked === true, "重击击落：坠地+下回合身法尽失");
  c.startRound();
  assert(!c.playerCanMove(), "被击落的下一拍迈不开步");
  // 地雷不触空中：敌人飞着走过雷区
  const c2 = new Combat({ player: mkHan(), enemies: [dummy({ name: "妖禽", canFly: true, hp: 80 })],
    rng: noCrit, W: 9, playerPos: 1, enemyPos: 7, mines: [{ cell: 4, kind: "anfu", dmg: 24 }] });
  c2.startRound();
  c2.enemies[0].alt = 1; c2.enemies[0].pos = 4;
  const ehp = c2.enemies[0].hp;
  c2._checkMine(c2.enemies[0]);
  assert(c2.enemies[0].hp === ehp, "凌空不踩地——伏火符不响");
}

console.log("\n=== 16.5 对空压力：悬空耗灵递增 / 兽王凌空扑杀(antiAir) / 符箓灵光锁敌 ===");
{
  // 悬空耗灵·四档曲线（flight-ladder F0）：筑基(档1)陡 3→5→7（悬空是手段不是常态）
  const c = new Combat({ player: mkHan({ canFly: true, mp: 80 }), enemies: [dummy({ name: "恶狼", hp: 200, nature: "beast" })],
    rng: noCrit, W: 9, playerPos: 3, enemyPos: 7 });
  c.startRound();
  c.playerFly();
  let mpB = c.player.mp;
  c.endRound(); c.startRound();
  assert(c.player.mp === mpB - 3, `筑基悬空第1回合燃灵3（${mpB}→${c.player.mp}）`);
  mpB = c.player.mp;
  c.endRound(); c.startRound();
  assert(c.player.mp === mpB - 5, `筑基悬空第2回合燃灵5——陡增（${mpB}→${c.player.mp}）`);
  mpB = c.player.mp;
  c.endRound(); c.startRound();
  assert(c.player.mp === mpB - 7, `筑基悬空第3回合燃灵7（${mpB}→${c.player.mp}）`);
  // 结丹(档2)缓 2→3→4：可长期飞
  const cj = new Combat({ player: mkHan({ canFly: true, airGrade: 2, mp: 80 }), enemies: [dummy({ name: "恶狼", hp: 200, nature: "beast" })],
    rng: noCrit, W: 9, playerPos: 3, enemyPos: 7 });
  cj.startRound(); cj.playerFly();
  let mj = cj.player.mp; cj.endRound(); cj.startRound();
  assert(cj.player.mp === mj - 2, `结丹悬空第1回合燃灵2（缓·${mj}→${cj.player.mp}）`);
  mj = cj.player.mp; cj.endRound(); cj.startRound();
  assert(cj.player.mp === mj - 3, `结丹悬空第2回合燃灵3（缓增）`);
  // 元婴(档3)平 1→1→2：遁光常驻
  const cy = new Combat({ player: mkHan({ canFly: true, airGrade: 3, mp: 80 }), enemies: [dummy({ name: "恶狼", hp: 200, nature: "beast" })],
    rng: noCrit, W: 9, playerPos: 3, enemyPos: 7 });
  cy.startRound(); cy.playerFly();
  let my = cy.player.mp; cy.endRound(); cy.startRound();
  assert(cy.player.mp === my - 1, `元婴悬空第1回合燃灵1（平·${my}→${cy.player.mp}）`);
  my = cy.player.mp; cy.endRound(); cy.startRound();
  assert(cy.player.mp === my - 1, `元婴悬空第2回合仍燃灵1（遁光常驻）`);
  // antiAir：带凌空扑杀的兽王对空中玩家不再"仰首戒备"，而且这一口咬得着
  const wk = dummy({ name: "赤目狼王", hp: 185, nature: "beast", move: 2, attacks: [
    { name: "撕咬", dmg: 22, kind: "normal", weight: 10, range: [1, 1] },
    { name: "凌空扑杀", dmg: 20, kind: "normal", weight: 10, antiAir: true, range: [1, 2] },
  ] });
  const c2 = new Combat({ player: mkHan({ canFly: true, mp: 60, agility: 0 }), enemies: [wk],
    rng: noCrit, W: 9, playerPos: 3, enemyPos: 4 });
  c2.startRound();
  c2.playerFly();
  for (let i = 0; i < 12; i++) { c2._rollOneIntent(c2.enemies[0]); if (c2.enemies[0].intent.name === "凌空扑杀") break; }
  assert(c2.enemies[0].intent.name === "凌空扑杀", `兽王对空选凌空扑杀（${c2.enemies[0].intent.name}）`);
  const php = c2.player.hp;
  c2.enemies[0].intent = { name: "凌空扑杀", dmg: 20, kind: "normal", mp: 0, antiAir: true, range: [1, 2] };
  c2._enemyAct(c2.enemies[0]);
  assert(c2.player.hp < php, `凌空扑杀咬得着半空的你（-${php - c2.player.hp}）`);
  assert(c2.player.alt === 0 && c2.player._knocked, "重咬把你从低空拽落（击落+硬直）");
  // 符箓灵光锁敌：消耗符压低目标闪避 10%（高敏狼王也躲不掉那么勤）
  const agile = dummy({ name: "影狼", hp: 150, nature: "beast", agility: 30 });
  const c3 = new Combat({ player: mkHan({ mp: 99 }), enemies: [agile], rng: () => 0.24, W: 9, playerPos: 3, enemyPos: 6 });
  c3.startRound();
  // rng=0.24：素闪避 0.30 → 0.24<0.30 普通法术被闪；符 0.30-0.10=0.20 → 0.24>0.20 命中
  const hpA = c3.enemies[0].hp;
  c3.cast("huodan", 0);
  const hpB = c3.enemies[0].hp;
  c3.cast("huoshe_fu", 0);
  assert(hpA === hpB, "普通法术被高敏狼闪过（对照组）");
  assert(c3.enemies[0].hp < hpB, `符箓灵光追身——命中（-${hpB - c3.enemies[0].hp}）`);
}

console.log("\n=== 17. 协同 AI：集火黑板/接力抓窗口/简令（攻·撤）/护主挡线 ===");
{
  const mkSide = (extra) => Object.assign({
    id: "nw", name: "南宫婉", kind: "ally", hp: 95, hpMax: 95, guard: 0, move: 1,
    persona: { aggr: 6, prot: 3, kite: 6 },
    moves: [
      { name: "月华绫", dmg: 16, weight: 12, elem: "shui", range: [1, 3] },
      { name: "素女剑光", dmg: 24, weight: 5, elem: "shui", range: [1, 2] },
    ],
  }, extra || {});
  // 集火：玩家打谁（_pFocus），随令侧位跟谁
  const c = new Combat({ player: mkHan(), enemies: [dummy({ name: "甲", hp: 150 }), dummy({ name: "乙", hp: 150 })],
    side: mkSide(), rng: noCrit, W: 11, playerPos: 3, enemyPos: 9, sidePos: 5 });
  c.startRound();
  c.enemies[0].pos = 5; c.enemies[1].pos = 7;   // 甲近乙远
  c.player.pos = 4;
  c.cast("zhayan", 1);   // 故意打远的乙（贴身够不着会失败——换用火弹）
  c.cast("huodan", 1);   // 距3超程仍失败？乙pos7 玩家pos4 距3>2 → 用符
  c.cast("huoshe_fu", 1);   // 程1~4 ✓ —— 黑板记焦点=乙
  assert(c._pFocus === 1, "集火黑板：玩家最近一次出手的目标=乙");
  const bHp = c.enemies[1].hp;
  c.side.pos = 6;   // 离乙1格
  c._sideAct();
  assert(c.enemies[1].hp < bHp, "随令侧位跟打玩家焦点（乙掉血）");
  // 接力：乙定身=破绽窗口，侧位伤害×1.3 且战报喊出来
  const c3 = new Combat({ player: mkHan(), enemies: [dummy({ name: "丙", hp: 200 })],
    side: mkSide(), rng: noCrit, W: 9, playerPos: 2, enemyPos: 4, sidePos: 3 });
  c3.startRound();
  c3.enemies[0].status.dingshen = 1;
  c3._pFocus = 0;
  const preHp = c3.enemies[0].hp;
  c3._sideAct();
  const dealt3 = preHp - c3.enemies[0].hp;
  assert(dealt3 >= Math.round(24 * 1.3) - 1, `接力抓定身窗口：重手+30%（-${dealt3}）`);
  assert(c3.log.some(l => /看准你定住/.test(l)), "战报喊出配合（看准你定住它的那一拍）");
  // 简令·撤：不出手、脱离接触
  const c4 = new Combat({ player: mkHan(), enemies: [dummy({ name: "丁", hp: 100 })],
    side: mkSide(), rng: noCrit, W: 9, playerPos: 2, enemyPos: 5, sidePos: 4 });
  c4.startRound();
  c4.side.stance = "retreat";
  const dHp = c4.enemies[0].hp;
  c4._sideAct();
  assert(c4.enemies[0].hp === dHp, "撤令：不再出手");
  // 护主挡线：玩家血危+近战敌贴近 → 侧位挪进身位间代刀
  const c5 = new Combat({ player: mkHan({ hp: 100 }), enemies: [dummy({ name: "戊", hp: 150, nature: "beast",
      attacks: [{ name: "咬", dmg: 20, kind: "normal", weight: 10, range: [1, 1] }] })],
    side: mkSide({ persona: { aggr: 3, prot: 9, kite: 0 } }), rng: noCrit, W: 9, playerPos: 3, enemyPos: 5, sidePos: 1 });
  c5.startRound();
  c5.player.hp = 20;            // 血危 20%
  c5.side.stance = "guard";
  c5._sideAct();
  assert(c5.side.pos === 4, `护主：侧位挡进玩家与近战敌之间（pos=${c5.side.pos}）`);
  assert(c5.log.some(l => /挡在你/.test(l)), "挡线有词（这一刀我替你接）");
}

console.log("\n=== 18. 分境界多级 AI：宗师读阵 / 本能撞阵 / 客随统帅点将（接应+15%） ===");
{
  // 宗师读阵：境界高 3 层以上的修士不踩你的困足阵
  const c = new Combat({ player: mkHan(), enemies: [dummy({ name: "前辈高人", qiLayer: 15, mp: 80, move: 2,
    attacks: [{ name: "斩", dmg: 18, kind: "normal", weight: 10, range: [1, 1] }] })],
    rng: noCrit, W: 9, playerPos: 1, enemyPos: 7 });
  c.startRound();
  assert(c.enemies[0].mastery === 2, `境界压人自动判宗师（mastery=${c.enemies[0].mastery}）`);
  c.zones.push({ from: 4, to: 5, type: "kunzu", turns: 9, team: "player" });
  c.enemies[0].intent = { name: "逼近", kind: "approach" };
  c._enemyAct(c.enemies[0]);
  assert(c.enemies[0].pos === 6, `宗师收脚停在阵前（pos=${c.enemies[0].pos}）`);
  assert(c.log.some(l => /收住脚步/.test(l)), "战报点出它读了你的布置");
  // 对照：本能层（野兽）一头撞进阵里
  const c2 = new Combat({ player: mkHan(), enemies: [dummy({ name: "蛮兽", nature: "beast", hp: 90, move: 2,
    attacks: [{ name: "咬", dmg: 10, kind: "normal", weight: 10, range: [1, 1] }] })],
    rng: noCrit, W: 9, playerPos: 1, enemyPos: 7 });
  c2.startRound();
  assert(c2.enemies[0].mastery === 0, "野兽=本能层（mastery 0）");
  c2.zones.push({ from: 4, to: 5, type: "kunzu", turns: 9, team: "player" });
  c2.enemies[0].intent = { name: "逼近", kind: "approach" };
  c2._enemyAct(c2.enemies[0]);
  assert(c2.log.some(l => /困足阵/.test(l)), "本能层照样撞阵（对照成立）");

  // 客随统帅：mastery 2 同道开局点将——打它点的目标，接应+15%
  const c3 = new Combat({ player: mkHan(), enemies: [dummy({ name: "妖狼甲", hp: 150 }), dummy({ name: "妖狼乙", hp: 90 })],
    side: { id: "qb", name: "前辈", kind: "ally", hp: 120, hpMax: 120, mastery: 2, guard: 0,
            persona: { aggr: 6, prot: 3, kite: 4 },
            moves: [{ name: "白绫", dmg: 18, weight: 10, elem: "shui", range: [1, 3] }] },
    rng: noCrit, W: 11, playerPos: 3, enemyPos: 9, sidePos: 4 });
  c3.startRound();
  assert(c3._leadPlan && c3._leadPlan.target === 1, "统帅点将：点了血最少的乙（无破绽时的择目标）");
  assert(c3.log.some(l => /交给你收口|接好了/.test(l)), "点将有词——'配合'反过来了（你接它的球）");
  c3.enemies[1].pos = 4; c3.player.pos = 3;
  const hpL = c3.enemies[1].hp;
  c3.cast("zhayan", 1);
  assert(c3.log.some(l => /接住了她递的局/.test(l)), `接应判定生效（乙 -${hpL - c3.enemies[1].hp}）`);
  assert((c3.stats["接应配合"] || 0) >= 1, "接应入账（复盘可见）");
  // 侧位执行自己点的将：行动时优先打点名目标
  c3.enemies[0].pos = 5;   // 甲更近也不改口
  c3._sideAct();
  assert(c3.enemies[1].hp < hpL - 10, "统帅说到做到：自己也缠点名的目标");
}

console.log("\n=== 19. 2.5 排制：僚位不挡路/贴身限排/方阵 depth/简令改排/阵脚补位 ===");
{
  const mkSide19 = () => ({ id: "nw", name: "南宫婉", kind: "ally", hp: 95, hpMax: 95, guard: 0, move: 1,
    persona: { aggr: 6, prot: 3, kite: 6 },
    moves: [{ name: "月华绫", dmg: 16, weight: 12, elem: "shui", range: [1, 3] }] });
  // —— 排数随场景 + 远程同道默认僚位 + 僚位不占格 ——
  const c = new Combat({ player: mkHan(), enemies: [dummy({ name: "恶狼", hp: 160, nature: "beast",
      attacks: [{ name: "撕咬", dmg: 18, kind: "normal", weight: 10, range: [1, 1] }] })],
    side: mkSide19(), rng: noCrit, W: 11, playerPos: 3, enemyPos: 9, sidePos: 4, lanes: 3 });
  c.startRound();
  assert(c.L === 3, "排数随场景（lanes=3——与左右格同源）");
  assert((c.side.lane || 0) === 1, "远程同道默认僚位1");
  const mv = c.playerMove(4);
  assert(mv.ok && c.player.pos === 4, "僚位不占格——她站4格你照样走进4格（挡路根治）");
  // —— 简令即阵型：换令同时换排 ——
  c.setSideStance("attack");  assert((c.side.lane || 0) === 0, "攻令压上战位排");
  c.setSideStance("retreat"); assert((c.side.lane || 0) === c.L - 1, "撤令缩到最深排");
  c.setSideStance("guard");   assert((c.side.lane || 0) === 1, "守令贴身僚位");
  c.setSideStance("follow");  assert((c.side.lane || 0) === 1, "随令回远程天性位");
  // —— 贴身限排：僚位敌贴身够不着，御物法术越排而击 ——
  const c2 = new Combat({ player: mkHan(), enemies: [
    dummy({ name: "压阵狼", hp: 100, nature: "beast" }),
    dummy({ name: "游走狼", hp: 100, nature: "beast", lane: 1 }),
  ], rng: noCrit, W: 9, playerPos: 3, enemyPos: 6, lanes: 3 });
  c2.startRound();
  c2.enemies[1].pos = 4;   // 贴脸、但在僚位
  const r2 = c2.cast("zhayan", 1);
  assert(!r2.ok && /阵后|越排/.test(r2.reason || ""), `贴身打不到僚位敌（${r2.reason}）`);
  const r2b = c2.cast("huodan", 1);
  assert(r2b.ok, "御物法术越排而击（火弹打僚位敌）");
  // —— 僚位敌滤招：贴身招收起来，只用够得着战位排的远手 ——
  const c4 = new Combat({ player: mkHan(), enemies: [
    dummy({ name: "压阵", hp: 100, nature: "beast" }),
    dummy({ name: "游走", hp: 100, nature: "beast", lane: 1, attacks: [
      { name: "撕咬", dmg: 18, kind: "normal", weight: 99, range: [1, 1] },
      { name: "飞扑", dmg: 12, kind: "normal", weight: 1, aim: "cell", lunge: true, range: [1, 3] },
    ] }),
  ], rng: noCrit, W: 9, playerPos: 3, enemyPos: 5, lanes: 3 });
  c4.startRound();
  c4.enemies[1].pos = 4;
  let sawMelee = false;
  for (let i = 0; i < 8; i++) { c4._rollOneIntent(c4.enemies[1]); if (c4.enemies[1].intent.name === "撕咬") sawMelee = true; }
  assert(!sawMelee, "僚位滤招：权重99的撕咬被收起，只剩飞扑策应");
  // —— 方阵 depth：默认"罩"全排；"front"只扫战位排 ——
  const mkZ = (depth) => {
    const cz = new Combat({ player: mkHan(), enemies: [dummy({ name: "煞兽", hp: 150, nature: "beast" })],
      side: mkSide19(), rng: noCrit, W: 9, playerPos: 3, enemyPos: 7, sidePos: 3, lanes: 3 });
    cz.startRound();
    const e = cz.enemies[0];
    e.intent = Object.assign({ name: "震林", dmg: 14, kind: "normal", mp: 0, aim: "zone",
      zoneFrom: 2, zoneTo: 4, range: [1, 6] }, depth ? { depth } : {});
    const sHp = cz.side.hp, pHp = cz.player.hp;
    cz._enemyAct(e);
    return { sd: sHp - cz.side.hp, pd: pHp - cz.player.hp };
  };
  const allHit = mkZ(null);
  assert(allHit.pd > 0 && allHit.sd > 0, `方阵默认"罩"全排（你-${allHit.pd} 僚位她-${allHit.sd}）`);
  const frontHit = mkZ("front");
  assert(frontHit.pd > 0 && frontHit.sd === 0, `"扫"（depth:front）只扫战位排——僚位的她无虞`);
  // —— 阵脚补位：战位排清空，僚位的被逼上前（无敌龟壳不存在）——
  const c5 = new Combat({ player: mkHan(), enemies: [
    dummy({ name: "前狼", hp: 30, nature: "beast" }),
    dummy({ name: "后修", hp: 90, lane: 1, attacks: [{ name: "石击", dmg: 10, kind: "normal", weight: 10, range: [1, 3], mp: 0 }] }),
  ], rng: noCrit, W: 9, playerPos: 3, enemyPos: 5, lanes: 3 });
  c5.startRound();
  c5.enemies[0].hp = 5;
  c5.player.pos = 4;
  c5.cast("zhayan", 0);
  assert(!c5.enemies[0].alive, "前排已破");
  assert((c5.enemies[1].lane || 0) === 0, "阵脚补位：僚位的被逼上战位排");
  assert(c5.log.some(l => /阵脚已破/.test(l)), "补位有词（阵脚已破——被逼上前来）");
}

console.log("\n=== 20. 二次确认（规则层）：阵旗择地——阵随心落，射程量到所点之格 ===");
{
  const c = new Combat({ player: mkHan({ mp: 60,
      spells: ["tuna", "huti", "zhayan", "huodan", "zhenqi_kunzu"],
      pouch: { zhenqi_kunzu: 2 } }),
    enemies: [dummy({ name: "木桩", hp: 120 })], rng: noCrit, W: 9, playerPos: 2, enemyPos: 8 });
  c.startRound();
  const far = c.cast("zhenqi_kunzu", undefined, { cell: 7 });
  assert(!far.ok && /掷不到/.test(far.reason || ""), `射程量到所点之格（距5>4 被拦：${far.reason}）`);
  const ok = c.cast("zhenqi_kunzu", undefined, { cell: 5 });
  assert(ok.ok, "择地落阵成功（距3 在 1~4 内）");
  assert(c.zoneAt(5, "kunzu") && c.zoneAt(4, "kunzu") && c.zoneAt(6, "kunzu"), "阵心落在所点之格，zoneSpan=1 铺开 4~6");
  assert(!c.zoneAt(8, "kunzu"), "敌人站位不再决定阵心（8 格没阵）");
}

console.log("\n=== 21. 同规则消耗战：敌悬空灵竭跌落 / 同道招式耗灵+敛息 / 聚灵阵认主 ===");
{
  // 敌方悬空也烧灵（递增），灵竭=跌落+破绽——拖死它的灵力是正经胜路（以弱胜强）。
  // 场景：你悬空风筝，妖禽腾空追击——它池子小，先竭的是它（消耗战的胜负手）
  const bird = dummy({ name: "妖禽", hp: 200, nature: "beast", canFly: true, mp: 12, mpMax: 12,
    attacks: [{ name: "啄击", dmg: 10, kind: "normal", weight: 10, range: [1, 1] }] });
  const c = new Combat({ player: mkHan({ mp: 99, canFly: true }), enemies: [bird], rng: noCrit, W: 9, playerPos: 2, enemyPos: 7 });
  c.startRound();
  c.playerFly();
  c.enemies[0].alt = 1;   // 妖禽已腾空追击（你在天上，它不会主动俯冲）
  let drops = 0;
  for (let i = 0; i < 6 && (c.enemies[0].alt || 0) === 1; i++) { c.endRound(); c.startRound(); drops = i + 1; }
  assert((c.enemies[0].alt || 0) === 0 && c.enemies[0].exposed, `妖禽悬空${drops}轮后灵竭跌落+破绽（mp=${c.enemies[0].mp}）`);
  assert(c.log.some(l => /灵力不继|遁光溃散/.test(l)), "跌落有词（灵力不继、遁光溃散）");
  // 同道招式耗灵：灵尽自动敛息回元（亮破绽）——同道也会被耗蓝
  const side = { id: "nw", name: "南宫婉", kind: "ally", hp: 95, hpMax: 95, guard: 0, move: 1, mp: 5, mpMax: 40,
    persona: { aggr: 6, prot: 3, kite: 0 },
    moves: [{ name: "素女剑光", dmg: 24, weight: 10, elem: "shui", range: [1, 3], mp: 8 }] };
  const c2 = new Combat({ player: mkHan(), enemies: [dummy({ name: "木桩", hp: 300 })],
    side, rng: noCrit, W: 9, playerPos: 2, enemyPos: 5, sidePos: 3 });
  c2.startRound();
  const mpB = c2.side.mp;
  c2._sideAct();
  assert(c2.side.mp > mpB && c2.side.exposed, `灵力不济出不了招——敛息回元+破绽（${mpB}→${c2.side.mp}）`);
  const hpT = c2.enemies[0].hp;
  c2._sideAct();
  assert(c2.enemies[0].hp < hpT && c2.side.mp < 19, "回过气来出招照常扣灵（素女剑光 mp8）");
  // 聚灵阵认主：我方全体可回，敌方踩进来不回
  const c3 = new Combat({ player: mkHan({ mp: 20, mpMax: 90 }), enemies: [dummy({ name: "散修", hp: 100, mp: 10, mpMax: 50 })],
    side: { id: "x", name: "同道", kind: "ally", hp: 50, hpMax: 50, guard: 0, move: 1, mp: 10, mpMax: 30,
      moves: [{ name: "击", dmg: 8, weight: 10, range: [1, 3], mp: 2 }] },
    rng: noCrit, W: 9, playerPos: 3, enemyPos: 5, sidePos: 4,
    zones: [{ from: 2, to: 5, type: "juling", turns: 9, team: "player" }] });
  const pMp = c3.player.mp, sMp = c3.side.mp, eMp = c3.enemies[0].mp;
  c3.startRound();
  assert(c3.player.mp > pMp && c3.side.mp > sMp, `聚灵阵济我方全体（你${pMp}→${c3.player.mp}，同道${sMp}→${c3.side.mp}）`);
  assert(c3.enemies[0].mp === eMp, "敌方站进我方阵中不回灵（阵认主）");
}

console.log("\n=== 22. sides[] 多侧位（T4）：双同道同场/仇恨分流/挡刀依序/简令各管各 ===");
{
  const two = [
    { id: "a", name: "甲同道", kind: "ally", hp: 60, hpMax: 60, guard: 0, move: 1, mp: 30, mpMax: 30,
      moves: [{ name: "甲击", dmg: 10, weight: 10, range: [1, 3], mp: 2 }] },
    { id: "b", name: "乙同道", kind: "ally", hp: 60, hpMax: 60, guard: 0, move: 1, mp: 30, mpMax: 30,
      moves: [{ name: "乙击", dmg: 10, weight: 10, range: [1, 3], mp: 2 }] },
  ];
  const c = new Combat({ player: mkHan(), enemies: [dummy({ name: "敌甲", hp: 300, atk: 8, atkName: "扑咬" })],
    sides: two, rng: noCrit, W: 11, playerPos: 2, enemyPos: 6, sidesPos: [3, 4] });
  assert(c.sides.length === 2, `双侧位上轴（${c.sides.length}）`);
  assert(c.side === c.sides[0], "c.side 别名=第一侧位（旧路径零破坏）");
  assert(c.sides[0].pos === 3 && c.sides[1].pos === 4, `sidesPos 各就各位（${c.sides[0].pos}/${c.sides[1].pos}）`);
  c.startRound();
  const hp0 = c.enemies[0].hp;
  c._sideAct();
  assert(c.enemies[0].hp <= hp0 - 16, `两位同道各出一手（敌血 ${hp0}→${c.enemies[0].hp}）`);
  // 仇恨分流：乙同道狂打→敌的杀意流向乙
  c.addAggro(c.enemies[0], "side:1", 60);
  assert(c.aggroTarget(c.enemies[0]) === c.sides[1], "仇恨最高者=乙同道（side:1 键分账）");
  // 简令各管各：给乙下守令不动甲
  c.setSideStance("guard", 1);
  assert(c.sides[1].stance === "guard" && c.sides[0].stance !== "guard", "简令按位下达（乙守甲不动）");
  // 多侧位挡刀：甲 guard 拉满必挡
  const c2 = new Combat({ player: mkHan(), enemies: [dummy({ name: "射手", hp: 100, atk: 10, atkName: "冷箭", desiredRange: 2 })],
    sides: [Object.assign({}, two[0], { guard: 1 })], rng: () => 0.0, W: 9, playerPos: 2, enemyPos: 4, sidesPos: [3] });
  c2.startRound();
  const sHp = c2.sides[0].hp;
  c2._enemyAct(c2.enemies[0]);
  assert(c2.sides[0].hp < sHp || c2.player.hp === c2.player.hpMax, "挡刀掷骰仍生效（侧位代受）");
}

console.log("\n=== 23. 拖时布阵战（objective=survive·拖满即胜·败有所得首例·H下）===");
{
  // 不死的木桩（0 攻、海量血），玩家只需撑满 maxRounds=4 回合即「阵成」判胜，不必杀敌
  const c = new Combat({ player: mkHan({ hp: 300, hpMax: 300 }),
    enemies: [dummy({ name: "胥王(测)", hp: 9999, atk: 0 })],
    objective: { kind: "survive", rounds: 4, winLog: "阵成了——！" },
    maxRounds: 4, rng: noCrit, W: 9, playerPos: 2, enemyPos: 6 });
  c.startRound(); c.endRound();          // r1
  assert(c.status === "ongoing", "拖时·未满回合不提前判胜（r1 后仍在死守）");
  c.startRound(); c.endRound();          // r2
  c.startRound(); c.endRound();          // r3
  assert(c.status === "ongoing" && c.round === 3, `拖到第 3 回合仍在打（round=${c.round}）`);
  c.startRound(); c.endRound();          // r4 → round>=maxRounds → survive 胜
  assert(c.status === "win", "拖满 4 回合·阵成判胜（survive 目标·不杀敌也能赢）");
  // 对照：无 survive 目标时拖满回合＝判负（旧规则不破坏）
  const c2 = new Combat({ player: mkHan({ hp: 300, hpMax: 300 }),
    enemies: [dummy({ name: "木桩", hp: 9999, atk: 0 })], maxRounds: 2, rng: noCrit, W: 9, playerPos: 2, enemyPos: 6 });
  c2.startRound(); c2.endRound(); c2.startRound(); c2.endRound();
  assert(c2.status === "lose", "无 survive 目标·回合耗尽仍判负（旧规则不破坏）");
}

console.log("\n=== 24. 真·颠倒五行阵：逐回合相位轮转 + 阵力反噬(穿甲) + 破绽/佐助（H下）===");
{
  const c = new Combat({ player: mkHan({ hp: 200, hpMax: 200 }),
    enemies: [dummy({ name: "胥王(测)", hp: 100, atk: 0, armor: 50 })],
    fieldCycle: [
      { name: "甲相", suppress: 0.1, expose: true },
      { name: "乙相", suppress: 0.2, player: { shield: 20 } },
    ],
    maxRounds: 10, rng: noCrit, W: 9, playerPos: 2, enemyPos: 6 });
  c.startRound();                        // r1 → 甲相
  assert(c._fieldPhase && c._fieldPhase.name === "甲相", "第1回合落「甲相」相位");
  assert(c.enemies[0].hp <= 91 && c.enemies[0].hp >= 89, `阵力穿甲反噬约 10（敌血 ${c.enemies[0].hp}/100·无视护甲50）`);
  assert(c.enemies[0].exposed === true, "expose 相位令敌破绽毕露（受击+30%）");
  c.endRound(); c.startRound();          // r2 → 乙相
  assert(c._fieldPhase.name === "乙相", "第2回合轮转到「乙相」（逐回合切换）");
  assert(c.enemies[0].hp <= 71, `乙相再噬约 20（敌血 ${c.enemies[0].hp}）`);
  assert(c.player.shield >= 20, `佐助相位给玩家护盾（盾 ${c.player.shield}）`);
}

console.log("\n=== 25. 大战场·fronts 声明式战区 + turn 切镜拍 + 跨线赶援（grounded·复用配合系统）===");
{
  const allyMv = (nm, el) => [{ name: nm, dmg: 18, weight: 12, elem: el, range: [1, 2] }];
  const mkSides = () => ([
    { id: "a0", name: "刘靖", kind: "ally", hp: 138, hpMax: 138, guard: 0.28, elem: "jin",
      persona: { aggr: 8, prot: 4, kite: 1 }, moves: allyMv("除魔剑光", "jin") },
    { id: "a1", name: "宋蒙", kind: "ally", hp: 150, hpMax: 150, guard: 0.38, elem: "tu",
      persona: { aggr: 4, prot: 8, kite: 2 }, moves: allyMv("重元珠击", "tu") },
    { id: "a2", name: "钟卫娘", kind: "ally", hp: 108, hpMax: 108, guard: 0.18, elem: "huo",
      persona: { aggr: 8, prot: 2, kite: 3 }, moves: allyMv("烈焰掌", "huo") },
  ]);
  const mkFronts = () => ([
    { ally: "side:0", enemies: [0], at: 4,  name: "左" },
    { ally: "side:1", enemies: [1], at: 15, name: "中" },
    { ally: "side:2", enemies: [2], at: 26, name: "右" },
  ]);
  const enemies3 = () => [dummy({ name: "甲", hp: 90, atk: 12 }),
                          dummy({ name: "乙", hp: 90, atk: 12 }),
                          dummy({ name: "丙", hp: 90, atk: 12 })];

  // 声明式布局：W=30、锚点落位、敌人右贴、锁线、_fronts 元数据、crossSupport 自动开
  const c = new Combat({ player: mkHan({ hp: 200, hpMax: 200 }), enemies: enemies3(),
    rng: noCrit, W: 30, lanes: 2, playerPos: 13, sides: mkSides(), fronts: mkFronts() });
  assert(c.W === 30 && c.player.pos === 13, `大战场 W=30·韩立居中 pos=13（${c.W}/${c.player.pos}）`);
  assert(c.sides[0].pos === 4 && c.sides[1].pos === 15 && c.sides[2].pos === 26,
    `三同袍锚点 4/15/26（${c.sides.map(s => s.pos).join("/")}）`);
  assert(c.enemies[0].pos === 5 && c.enemies[1].pos === 16 && c.enemies[2].pos === 27,
    `三敌右贴 5/16/27（${c.enemies.map(e => e.pos).join("/")}）`);
  assert(c.aggroTarget(c.enemies[0]) === c.sides[0]
    && c.aggroTarget(c.enemies[2]) === c.sides[2], "锁线：本区敌人杀意锁本区同袍");
  assert(c._fronts && c._fronts.length === 3 && c._fronts[2].at === 26, "_fronts 三战区元数据暴露给导演层");
  assert(c.crossSupport === true, "fronts≥2 自动开 crossSupport");

  // W 自适应（不显式给 W）：取最右占格 +2，下限 14
  const cAuto = new Combat({ player: mkHan(), enemies: enemies3(), rng: noCrit,
    sides: mkSides(), fronts: mkFronts() });
  assert(cAuto.W === 29, `W 自适应=29（最右敌 27 +2 留白，实=${cAuto.W}）`);

  // turn 切镜拍：W>13 时每个侧位/敌人行动前发 turn 拍（喂 flushCombatFx 的镜头导演）
  c.startRound(); c.endRound();
  const turns = (c._fx || []).filter(f => f.kind === "turn");
  assert(turns.length >= 3 && turns.every(t => /^(player|side|enemy)/.test(t.ref)),
    `本回合 turn 拍≥3 且 ref 合法（${turns.length}）`);

  // 窄场不发 turn 拍（零回归：旧战斗 W≤13 不受导演层影响）
  const cNarrow = new Combat({ player: mkHan(), enemies: [dummy()], rng: noCrit,
    sides: [mkSides()[0]], W: 11, playerPos: 2, enemyPos: 6, sidesPos: [3] });
  cNarrow.startRound(); cNarrow.endRound();
  assert(!(cNarrow._fx || []).some(f => f.kind === "turn"), "窄场 W≤13 不发 turn 拍（零回归）");

  // 跨场驰援疾遁：同袍清掉当面之敌后，横越缓冲带去救告急战线（非 moveCap 慢爬）
  const c2 = new Combat({ player: mkHan({ hp: 200, hpMax: 200 }), enemies: enemies3(),
    rng: noCrit, W: 30, lanes: 2, playerPos: 13, sides: mkSides(), fronts: mkFronts() });
  c2.enemies[0].hp = 0; c2.enemies[0].alive = false;          // 刘靖那条线已清
  c2.sides[2].hp = Math.floor(c2.sides[2].hpMax * 0.3);       // 钟卫娘告急
  const cap0 = c2.moveCap(c2.sides[0]);
  c2.startRound();
  const from0 = c2.sides[0].pos;
  c2.endRound();
  const moved0 = c2.sides[0].pos - from0;
  assert(moved0 > 0 && moved0 <= cap0, `刘靖朝告急战线逐格赶援（${from0}→${c2.sides[0].pos}，单回合位移 ${moved0}≤moveCap ${cap0}）`);
  assert(!(c2._fx || []).some(f => f.kind === "move" && f.dash), "不再发瞬移/横越 dash 位移拍（grounded·正常脚程）");

  // 日常单挑（无 fronts·零回归基线；后续扫场断言复用 cSolo）
  const cSolo = new Combat({ player: mkHan(), enemies: [dummy()], rng: noCrit, W: 11, playerPos: 2, enemyPos: 6 });

  // 开场扫场标记（B3）：多战线默认开；cfg.openingSweep 可显式开/关；窄场单挑不开
  assert(c._sweepOnOpen === true, "多战线默认开开场扫场（_sweepOnOpen）");
  assert(cSolo._sweepOnOpen === false, "单挑无战线不开场扫场");
  const cNoSweep = new Combat({ player: mkHan(), enemies: enemies3(), rng: noCrit,
    sides: mkSides(), fronts: mkFronts(), openingSweep: false });
  assert(cNoSweep._sweepOnOpen === false, "openingSweep:false 显式关扫场");

  // 塌线重定向（C3）：某战线我方锚点已倒、本区尚有活敌 → 这些"无主"之敌改投最近仍在交火的战线
  const c3 = new Combat({ player: mkHan({ hp: 200, hpMax: 200 }), enemies: enemies3(),
    rng: noCrit, W: 30, lanes: 2, playerPos: 13, sides: mkSides(), fronts: mkFronts() });
  c3.sides[0].hp = 0;   // 刘靖（左线锚点 at=4）已倒，左线之敌「甲」尚活
  c3.startRound();
  assert(c3.aggroTarget(c3.enemies[0]) === c3.sides[1],
    "塌线重定向：左线我方倒，左线之敌改锁最近活线（中·宋蒙）");
  assert(c3.enemies[0]._collapsedTo === "side:1", "塌线一次性改投标记（_collapsedTo=side:1）");
  // 锚点尚在的战线之敌不被重定向（中线宋蒙活着 → 乙仍锁宋蒙·零误伤）
  assert(c3.aggroTarget(c3.enemies[1]) === c3.sides[1] && !c3.enemies[1]._collapsedTo,
    "锚点尚在的战线不塌（中线之敌仍锁本线·不误触发）");
}

console.log(failures === 0 ? "\n全部通过 ✓" : `\n${failures} 项失败 ✗`);
process.exit(failures ? 1 : 0);
