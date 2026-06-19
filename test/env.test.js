/* 昼夜·天气骨架 env.js · 无头测试（resolve/ambientFor 纯函数 + apply 用假 DOM 验证写属性）
 * 跑：node test/env.test.js —— 不依赖真实 DOM；解析须确定、未打 env 的地点零回归。 */
const Env = require("../js/env.js");

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.log(`  ✗ 失: ${msg}`); }
}

console.log("== 1. 未打 env 的地点：昼·晴·无床（零回归）==");
{
  Env.clear();
  const loc = { id: "plain" };
  assert(Env.phaseFor(loc) === "day", "缺省时辰=昼");
  assert(Env.weatherFor(loc, { month: 1 }) === "clear", "缺省天气=晴（非户外不随季）");
  assert(Env.ambientFor(loc, { month: 1 }) === null, "缺省不放环境床（照常 BGM）");
  const r = Env.resolve(loc, { month: 1 });
  assert(r.phase === "day" && r.weather === "clear", "resolve=昼·晴");
}

console.log("== 2. 地点配置：药庐夜·夜虫 / 密室夜·雾·诡谧静默 ==");
{
  Env.clear();
  const yaolu = { id: "yaolu", env: { phase: "night", amb: "night" } };
  assert(Env.phaseFor(yaolu) === "night", "药庐时辰=夜");
  assert(Env.ambientFor(yaolu, { month: 6 }) === "night", "药庐环境床=夜虫（不被夏季雨覆盖：amb 显式优先）");

  const miju = { id: "miju", env: { phase: "night", weather: "fog", amb: null } };
  const r = Env.resolve(miju, { month: 6 });
  assert(r.phase === "night" && r.weather === "fog", "密室=夜·雾");
  assert(Env.ambientFor(miju, { month: 6 }) === null, "密室 amb 显式 null=诡谧静默（不放床，保留 tense BGM）");
}

console.log("== 3. 户外随季：冬→雪 / 夏→雨（带檐滴床）/ 余→晴 ==");
{
  Env.clear();
  const houshan = { id: "houshan", env: { outdoor: true } };
  assert(Env.weatherFor(houshan, { month: 1 }) === "snow", "冬(1月)→雪");
  assert(Env.weatherFor(houshan, { month: 12 }) === "snow", "冬(12月)→雪");
  assert(Env.weatherFor(houshan, { month: 7 }) === "rain", "夏(7月)→雨");
  assert(Env.weatherFor(houshan, { month: 4 }) === "clear", "春(4月)→晴");
  assert(Env.ambientFor(houshan, { month: 7 }) === "rain", "夏雨→檐滴床");
  assert(Env.ambientFor(houshan, { month: 1 }) === null, "冬雪→无床（雪静，只视觉+BGM）");
  assert(Env.ambientFor(houshan, { month: 4 }) === null, "春昼晴→无床");
}

console.log("== 4. 演出/调试覆盖 > 地点 ==");
{
  const yaolu = { id: "yaolu", env: { phase: "night", amb: "night" } };
  Env.set("day", "rain");
  const r = Env.resolve(yaolu, { month: 1 });
  assert(r.phase === "day" && r.weather === "rain", "覆盖压过地点配置");
  assert(Env.ambientFor(yaolu, { month: 1 }) === "night", "amb 仍取地点显式（覆盖只动 phase/weather 视觉）");
  Env.clear();
  assert(Env.resolve(yaolu, { month: 1 }).phase === "night", "clear 后回到地点配置");
}

console.log("== 5. 非法值回退 + 季节边界 ==");
{
  Env.clear();
  assert(Env.phaseFor({ env: { phase: "正午" } }) === "day", "非法时辰→回退昼");
  assert(Env.weatherFor({ env: { weather: "冰雹" } }, { month: 1 }) === "clear", "非法天气→回退晴（非户外）");
  assert(Env.seasonalWeather({ month: 2 }) === "snow" && Env.seasonalWeather({ month: 6 }) === "rain", "季节边界 2月雪/6月雨");
}

console.log("== 6. apply 写 data-phase/data-weather + 建两层（假 DOM）==");
{
  Env.clear();
  // 极简假 DOM：querySelector 命中已建层；createElement/insert 记账
  function makeStage() {
    const children = [{ className: "scene-veil", nextSibling: null }];
    const doc = {
      createElement: (tag) => ({ tag, className: "", ownerDocument: null }),
    };
    return {
      dataset: {},
      ownerDocument: doc,
      _children: children,
      querySelector(sel) {
        const cls = sel.replace(".", "");
        return this._children.find(c => c.className === cls) || null;
      },
      insertBefore(el) { this._children.push(el); },
      appendChild(el) { this._children.push(el); },
    };
  }
  const stage = makeStage();
  const r = Env.apply(stage, { id: "yaolu", env: { phase: "night", amb: "night" } }, { month: 1 });
  assert(stage.dataset.phase === "night" && stage.dataset.weather === "clear", "apply 写入 data-phase=night/weather=clear");
  assert(r && r.phase === "night", "apply 返回解析结果");
  assert(stage.querySelector(".scene-tint") && stage.querySelector(".scene-weather"), "apply 建出 .scene-tint/.scene-weather 两层");
  // 幂等：再调不重复建层
  const n = stage._children.length;
  Env.apply(stage, { id: "houshan", env: { outdoor: true } }, { month: 1 });
  assert(stage._children.length === n, "层已存在则不重复建（幂等）");
  assert(stage.dataset.weather === "snow", "再 apply 切到 houshan 冬→雪");
  assert(Env.apply(null, {}) === null, "缺 stageEl→null 不抛");
}

console.log(`\n========== env.js: ${fail === 0 ? "全部通过 ✓" : fail + " 项失败 ✗"}（${pass} 过）==========\n`);
process.exit(fail === 0 ? 0 : 1);
