/* ============================================================
 * 再别天南时间窗审计：node test/zaibie-time.audit.js
 * polish-zaibie A4/B1（GPT P0-2 + Fable P0-4）——守"帆窗不再是没有门的房间"：
 *   a) 两个 due 等待窗（zaibie_a3_due +2月 @jinguyuan / zaibie_kuangdong_due +1月 @yuekuang）
 *      所在地点必须有可耗月行动（actions 非空且含 rest 或专属月行动）——旧版 scene:true+actions:[]
 *      唯一耗月手段是出门云游=行动层软锁；
 *   b) 两地点不得挂 scene:true（UI 对 scene 强制清空行动——ui.js renderActions）；
 *   c) due 节点声明 where（旧版 a4_kuangdong 无 where=任何地方弹卡瞬移）；
 *   d) rest/月行动真耗月（passTime 走真日历——防"补阵纹"退化成零耗月点按）。
 * 真引擎加载（_loadgame 同源），静态+动态双查。
 * ============================================================ */
const G = require("./_loadgame.js");
const { State, Engine, WORLD } = G;

let failures = 0;
function assert(c, m) { if (c) console.log("  \u2713 " + m); else { console.log("  \u2717 \u5931\u8d25: " + m); failures++; } }

console.log("\n=== 再别天南·帆窗时间审计（due 窗必须有可耗月行动） ===\n");

const STORY = global.STORY;

/* —— a/b) 两个帆窗地点：actions 非空 + 含耗月行动 + 非 scene —— */
for (const [locId, dueFlag, wantAct] of [
  ["jinguyuan", "zaibie_a3_due", ["rest"]],
  ["yuekuang", "zaibie_kuangdong_due", ["rest", "xiuzhen"]],
]) {
  const loc = (WORLD.locations || []).find(l => l.id === locId);
  assert(!!loc, `${locId} 地点存在`);
  if (!loc) continue;
  assert(Array.isArray(loc.actions) && loc.actions.length > 0,
    `${locId}·actions 非空（${JSON.stringify(loc.actions)}）——${dueFlag} 等待窗有门可出`);
  assert(wantAct.some(a => (loc.actions || []).includes(a)),
    `${locId}·含可耗月行动 ${wantAct.join("/")}（实际 ${JSON.stringify(loc.actions)}）`);
  assert(!loc.scene,
    `${locId}·未挂 scene:true（scene 会让 UI 强制清空行动=软锁）`);
}

/* —— c) due 节点锚定核查：kuangdong 窗须锁矿洞（B1③——objHint 说"你在矿洞补阵纹"，人就得在矿洞）；
 *      a3_yuanwu 是"亡命奔逃"节点（onArrive 自带迁移=旅程叙事），按 B1 规格不要求 where —— */
{
  const kd = STORY.find(n => n.id === "zaibie_a4_kuangdong");
  assert(kd && kd.where === "yuekuang",
    `zaibie_a4_kuangdong 声明 where=yuekuang（${kd ? kd.where : "?"}）——修阵纹的人就在矿洞`);
  const lhy = STORY.find(n => n.id === "zaibie_a2_lihuayuan");
  assert(lhy && /zaibie_a3_due/.test(String(lhy.onArrive || "")),
    `zaibie_a2_lihuayuan 落 zaibie_a3_due 时锚（+2月帆窗真存在）`);
  const ls = STORY.find(n => n.id === "zaibie_a4_lingshi");
  assert(ls && /zaibie_kuangdong_due/.test(String(ls.onArrive || "")),
    `zaibie_a4_lingshi 落 zaibie_kuangdong_due 时锚（+1月帆窗真存在）`);
}

/* —— d) 月行动真耗月（动态查：xiuzhen 走真日历） —— */
{
  State.create({ name: "韩立", rootId: "si_ling" });
  const s = State.data;
  s.activeChapter = "zaibie";
  s.unlockedChapters = ["qixuan", "huangfeng", "modao", "zaibie"];
  s.realmIndex = 13; s.hp = s.hpMax = 190;
  s.location = "yuekuang";
  s.pendingEvent = null;
  const m0 = State.absMonth();
  if (typeof Engine.repairZhenwen === "function") {
    Engine.repairZhenwen();
    assert(State.absMonth() === m0 + 1,
      `「修补阵纹」真耗 1 月（${m0}→${State.absMonth()}）——承诺兑现且不是零耗月点按`);
  } else {
    assert(false, "Engine.repairZhenwen 存在（yuekuang 专属月行动·B1 帆窗组件）");
  }
  const m1 = State.absMonth();
  Engine.rest();
  assert(State.absMonth() === m1 + 1, `「调息」真耗 1 月（${m1}→${State.absMonth()}）`);
}

console.log(`\n========== 再别天南帆窗审计：${failures === 0 ? "全部通过 \u2713" : failures + " 项失败 \u2717"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
