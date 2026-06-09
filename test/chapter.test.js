/* ============================================================
 * 篇章系统结构校验：node test/chapter.test.js
 * 守住"地基"——保证篇章抽象层完整、引擎不再硬编码篇章假设、新章可扩展。
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
const { State, Chapters, WORLD, DATA, Engine } = sandbox;

let failures = 0;
function assert(c, m) { if (c) console.log("  ✓ " + m); else { console.log("  ✗ 失败: " + m); failures++; } }

console.log("\n=== 篇章系统 · 结构校验 ===");
State.create("韩立", "si");

// 1) 篇章配置字段完整
const required = ["id", "name", "order", "realmTier", "realmCapIndex", "completeFlag"];
let fieldOk = true;
for (const c of Chapters.list) for (const f of required) if (c[f] === undefined) { fieldOk = false; console.log(`    缺字段 ${c.id}.${f}`); }
assert(fieldOk, "每个篇章配置字段完整");

// 2) 当前篇章 = 七玄门
assert(Chapters.active().id === "qixuan", "起始当前篇章为七玄门篇");
assert(Chapters.realmCap() === 6, "境界上限由篇章配置提供（练气七层）");
assert(Chapters.realmTier() === 0, "大境界序由篇章配置提供（练气=0）");

// 3) 引擎不再硬编码：atRealmCap 跟随篇章配置
State.data.realmIndex = 6;
assert(Engine.atRealmCap() === true, "atRealmCap 读篇章上限（已达上限）");
State.data.realmIndex = 3;
assert(Engine.atRealmCap() === false, "未达上限时可继续突破");

// 4) 篇章解锁：初始只解锁七玄门，黄枫谷锁定
assert(Chapters.isUnlocked("qixuan"), "七玄门篇初始已解锁");
assert(!Chapters.isUnlocked("huangfeng"), "黄枫谷篇初始锁定");
Chapters.unlock("huangfeng");
assert(Chapters.isUnlocked("huangfeng"), "解锁后黄枫谷篇可进入");

// 5) 地点都标注了 arc（地图按篇章过滤的前提）
const noArc = WORLD.locations.filter(l => !l.arc);
assert(noArc.length === 0, `所有地点都标注 arc（缺失：${noArc.map(l => l.id).join(",") || "无"}）`);
assert(WORLD.locations.every(l => Chapters.get(l.arc)), "每个地点的 arc 都对应一个已定义篇章");

// 6) 老存档迁移：缺字段的旧档不崩
{
  const legacy = { name: "韩立", rootId: "si", realmIndex: 0, cultivation: 0, spirit: 60,
    sense: 5, body: 8, hp: 100, hpMax: 100, mood: 100, moodMax: 100, demon: 0,
    lifespan: 100, age: 13, year: 1, month: 1, stones: 0, location: "yaolu",
    inventory: {}, spells: ["zhayan"], storyStage: 0, bottle: { unlocked: false, plots: [] }, log: [] };
  store["frxxz_save_v1"] = JSON.stringify(legacy);
  const ok = State.load();
  assert(ok && State.data.activeChapter === "qixuan", "老存档迁移补全 activeChapter");
  assert(Array.isArray(State.data.unlockedChapters), "老存档迁移补全 unlockedChapters");
  assert(State.data.technique === DATA.startingTechnique, "老存档迁移补全主修功法");
}

// 7) 收尾解锁契约：剧情收尾 stage 设置 completeFlag 并解锁下一章（静态检查脚本）
const storySrc = fs.readFileSync(path.join(__dirname, "..", "js/story.js"), "utf8");
assert(/Chapters\.unlock\(/.test(storySrc), "剧情收尾调用 Chapters.unlock 解锁下一章");

console.log(`\n========== 篇章系统：${failures === 0 ? "全部通过 ✓" : failures + " 项失败 ✗"} ==========\n`);
process.exit(failures === 0 ? 0 : 1);
