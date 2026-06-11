/* ============================================================
 * NPC 命途模拟 / 主动交互 无头测试：node test/world.test.js
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
for (const f of ["js/data.js", "js/state.js", "js/chapters.js", "js/balance.js", "js/world.js", "js/npcsim.js", "js/interactions.js", "js/combat.js", "js/explore.js", "js/loadout.js", "js/dialogue.js", "js/fortunes.js", "js/quests.js", "js/story.js", "js/engine.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
}
const { State, Engine, NPCSIM, INTERACTIONS, WORLD, STORY, Chapters, Balance, DATA } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }
function seqRng(seq) { let i = 0; return () => seq[(i++) % seq.length]; }

console.log("\n=== NPC 命途模拟（世界不会停）===");
State.create("韩立", "si");
assert(State.data.npcFates.length > 0, "建号即初始化世间修士命途");

// 推进很长时间（几百年），世界应发生显著变化：有人筑基、有人身死
{
  State.create("韩立", "si");
  const news = NPCSIM.tick(State.data, 12 * 300, Math.random); // 300 年
  const deaths = news.filter(n => n.kind === "death").length;
  const ascends = news.filter(n => n.kind === "ascend").length;
  assert(news.length > 0, `三百年间，世间风云变幻（共 ${news.length} 桩事）`);
  assert(deaths > 0, `有修士寿尽身死（${deaths} 人）——大道无情`);
  const sum = NPCSIM.summary(State.data);
  assert(sum.dead.length + sum.alive.length + sum.ascended.length >= 0, "命途统计可用");
  console.log(`    · 三百年：身死 ${deaths}，筑基/超脱 ${ascends}`);
}

// 寿元将尽且无法突破者，会进入"求丹闯秘境"的孤注一掷（desperate）
{
  State.create("韩立", "si");
  // 造一个低资质、寿元将尽的修士
  State.data.npcFates = [{ id: "t1", name: "测试散修", apt: 0.5, realm: 6, cul: 0, age: 118, lifespan: 120, status: "alive", desperate: false }];
  const news = NPCSIM.tick(State.data, 24, seqRng([0.5, 0.9, 0.3, 0.5, 0.5]));
  const f = State.data.npcFates[0];
  assert(f.desperate || f.status === "dead", "寿元将尽者会孤注一掷求丹闯秘境，或终告身死");
}

console.log("\n=== NPC 主动交互（参考鬼谷八荒）===");
{
  State.create("韩立", "si");
  State.setFlag("is_modafu");
  // 强制构造一个求丹交互并结算
  const inter = { kind: "buy_pill", npcId: State.data.npcFates[0].id, npcName: State.data.npcFates[0].name };
  State.data._pendingInteraction = inter;
  State.give("qingyuan_dan", 1);
  const stones0 = State.count("lingshi");
  const built = INTERACTIONS.build(inter, State.data);
  assert(built && built.choices.length >= 1, "可构造求丹交互内容");
  Engine.chooseInteraction(0); // 卖丹
  assert(State.count("lingshi") === stones0 + 1, "卖丹换得灵石");
  assert(INTERACTIONS.relationOf(State.data, inter.npcId) > 0, "交互后好感上升（关系系统）");
  assert(!State.data._pendingInteraction, "交互结算后清空");
}

// 垂死求丹：赠药积德 + 续命
{
  State.create("韩立", "si");
  State.setFlag("is_modafu");
  const fate = State.data.npcFates[0];
  fate.desperate = true; fate.realm = 6;
  const inter = { kind: "beg_pill", npcId: fate.id, npcName: fate.name };
  State.data._pendingInteraction = inter;
  State.give("lingyao_dan", 1);
  const life0 = fate.lifespan;
  Engine.chooseInteraction(0); // 赠药
  assert(fate.lifespan > life0, "赠予救命灵药，续其寿元");
  assert(INTERACTIONS.relationOf(State.data, fate.id) >= 20, "救命之恩，结深厚善缘");
}

// 主线人物不进入命途模拟（厉飞雨等忠于动漫，不被模拟写死）
{
  const simIds = NPCSIM.roster.map(r => r.id);
  const storyNpcIds = WORLD.npcs.map(n => n.id);
  const overlap = simIds.filter(id => storyNpcIds.includes(id));
  assert(overlap.length === 0, "命途模拟名册与主线人物名册无重叠（主线人物不被模拟杀死）");
}

console.log("\n=== 人物结识：忠于剧情时机 + 渐进解锁 ===");
{
  // 全新一局，从头按剧情推进，校验结识时机
  const store2 = {};
  // 用同进程的 State/Engine 重新建号并手动走剧情
  State.create("韩立", "si");
  Engine.checkStory();                       // village
  assert(!(State.data.metNpcs || []).includes("zhangtie"), "开局尚未结识张铁");
  // 第一幕：village -> journey(结识张铁) -> exam -> intro(结识墨大夫)
  let guard = 0;
  while (State.data.storyStage < 4 && guard++ < 20) {
    const stage = STORY[State.data.storyStage];
    if (State.data.pendingEvent === stage.id) Engine.chooseStory(stage, 0);
    else Engine.checkStory();
  }
  assert((State.data.metNpcs || []).includes("zhangtie"), "赴考途中即结识张铁（A1）");
  assert((State.data.metNpcs || []).includes("modafu"), "拜师时结识墨大夫（A3）");
  assert(!(State.data.metNpcs || []).includes("mocaihuan"), "此时尚未结识墨彩环（不再过早解锁）");
  assert(!(State.data.metNpcs || []).includes("jinguang"), "此时尚未结识金光上人");
}

// 结识有反馈（meetNpc 返回首次=true，重复=false）
{
  State.create("韩立", "si");
  assert(Engine.meetNpc("lifeiyu") === true, "首次结识返回 true（触发反馈）");
  assert(Engine.meetNpc("lifeiyu") === false, "重复结识返回 false（不再重复提示）");
}

// 金光上人有图鉴词条（出场即可录入）
{
  assert(!!WORLD.npcById("jinguang"), "金光上人已纳入人物图鉴名册");
}

console.log("\n=== 据点在场人物 + 移动速度 ===");
{
  State.create("韩立", "si");
  const s = State.data;
  s.flags.met_modafu = true;
  const localsYaolu = WORLD.localsAt("yaolu", s).map(n => n.id);
  assert(localsYaolu.includes("modafu"), "药庐在场可见墨大夫（剧情条件满足后）");
  // 墨大夫死后不再在场
  s.flags.modafu_dead = true;
  assert(!WORLD.localsAt("yaolu", s).map(n => n.id).includes("modafu"), "墨大夫身死后不再在场（随剧情变化）");
  // 墨彩环属于嘉源城线（七玄门篇之后），本篇不得出现
  assert(!WORLD.npcById("mocaihuan"), "墨彩环不在七玄门篇名册（嘉源城线，剧情勘误）");
}

// 移动速度：多来源叠加（境界/身法/飞行法宝），飞行法宝大幅提速
{
  State.create("韩立", "si");
  const base = State.effectiveSpeed();
  assert(base >= State.data.speed, "有效遁速含基础遁速（可叠加身法/境界增益）");
  // 眨眼身法：习眨眼剑法即有随身身法加成
  assert(State.movementArtBonus() > 0, "眨眼身法提供遁速加成（功法影响移动）");
  // 装上风雷翅
  State.data.flightId = "feng_lei_chi";
  const flying = State.effectiveSpeed();
  assert(flying > base, `风雷翅大幅提速（${base} → ${flying}）`);
  assert(Balance.travelTimeFactor(flying) < Balance.travelTimeFactor(base), "遁速越高赶路耗时系数越小（移动速度可视化）");
  // 飞行法宝分级（动漫考据修正）：御风车乃元婴期重返天南至宝 > 风雷翅（乱星海）> 神风舟（筑基脚力）
  assert(DATA.flightTreasures.yu_feng_che.speedBonus > DATA.flightTreasures.feng_lei_chi.speedBonus, "飞行法宝分级：御风车(元婴至宝) > 风雷翅");
  assert(DATA.flightTreasures.feng_lei_chi.speedBonus > DATA.flightTreasures.shen_feng_zhou.speedBonus, "飞行法宝分级：风雷翅 > 神风舟");
  assert(DATA.flightTreasures.yu_feng_che.arc === "tiannan_return", "御风车归属重返天南篇（获取时序考据）");
  // 风雷翅只是其一：存在多种飞行法宝
  assert(Object.keys(DATA.flightTreasures).length >= 4, "存在多种飞行法宝（风雷翅只是其一）");
}

console.log(`\n========== 大世界系统：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
