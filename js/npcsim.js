/* ============================================================
 * npcsim.js — NPC 命途模拟（活着的、残酷的大世界）
 *
 * 觅长生式真实：你离开，世界不会停。世间修士各有命数——
 * 随光阴流逝，他们修炼、突破；突破不了的，求丹、闯秘境，
 * 一旦寿元将尽仍未能更进一步，便坐化身死。真实世界就是这么残酷。
 *
 * 红线：本模块只模拟"背景修士"（非主线人物）。
 * 主线人物（厉飞雨等）命运忠于动漫，绝不在此被写死。
 *
 * 纯逻辑、可注入 rng，便于无头测试。
 * ============================================================ */

const NPCSIM = {
  // 背景修士名册（世间众生，可生可死，独立于主线人物）
  roster: [
    { id: "s_li",   name: "散修·李恒",   apt: 1.05, realm: 3 },
    { id: "s_wang", name: "散修·王矮子", apt: 0.7,  realm: 5 },
    { id: "s_zhao", name: "游方·赵越",   apt: 0.85, realm: 2 },
    { id: "d_qian", name: "七玄弟子·钱通", apt: 0.95, realm: 4 },
    { id: "d_sun",  name: "七玄弟子·孙礼", apt: 0.6,  realm: 6 },
    { id: "e_zhou", name: "黄枫散人·周牧", apt: 1.25, realm: 8 },
    { id: "s_feng", name: "散修·冯婆婆",  apt: 0.5,  realm: 7 },
    { id: "s_chen", name: "散修·陈九",    apt: 0.9,  realm: 1 },
  ],

  realmName(r) {
    if (r <= 13) return "练气" + ["一","二","三","四","五","六","七","八","九","十","十一","十二","十三"][r - 1] + "层";
    if (r === 14) return "筑基期";
    return "筑基期以上";
  },
  // 该境界对应的寿元上限（练气凡躯有限；筑基大增）
  lifespanFor(r) { return r <= 13 ? 100 + (r - 1) * 4 : 200 + (r - 14) * 50; },
  // 突破到下一境界所需的"积累"
  threshold(r) { return 60 + r * 30; },

  // 初始化命途记录（写入存档）
  init(s) {
    if (s.npcFates && s.npcFates.length) return;
    s.npcFates = this.roster.map(n => ({
      id: n.id, name: n.name, apt: n.apt,
      realm: n.realm, cul: 0,
      age: 20 + Math.floor((n.realm) * 6),     // 境界越高一般年岁越长
      lifespan: this.lifespanFor(n.realm),
      status: "alive",                          // alive | dead | ascended
      desperate: false,
    }));
  },

  /* ----- 推进 months 个月，返回新闻数组（供叙事/风云录展示）----- */
  tick(s, months, rng) {
    rng = rng || Math.random;
    if (!s.npcFates) this.init(s);
    const news = [];
    // 以月为粒度推进（按月累计年龄与修炼）
    for (let m = 0; m < months; m++) {
      for (const f of s.npcFates) {
        if (f.status !== "alive") continue;
        this._stepMonth(f, news, rng);
      }
    }
    return news;
  },

  _stepMonth(f, news, rng) {
    // 年龄按月增长
    f.age += 1 / 12;

    // 修炼积累
    f.cul += f.apt * (4 + rng() * 4);

    // 寿元将尽且未能更进 → 进入"求丹/闯秘境"的孤注一掷
    const yearsLeft = f.lifespan - f.age;
    if (yearsLeft <= 8 && !f.desperate && f.realm <= 13) {
      f.desperate = true;
      news.push({ kind: "desperate", text: `${f.name}（${this.realmName(f.realm)}）寿元将尽，仍未能突破，开始四处求丹、欲闯秘境搏一线生机。` });
    }

    // 孤注一掷阶段：每月小概率发生一桩险事
    if (f.desperate && f.status === "alive") {
      if (rng() < 0.06) {
        const roll = rng();
        if (roll < 0.45) {
          // 闯秘境身死
          f.status = "dead";
          news.push({ kind: "death", text: `噩耗：${f.name} 闯秘境搏命，终究未能筑基，殒于其中。一缕修行，化作尘土。` });
          return;
        } else if (roll < 0.7) {
          // 求得丹药，续命并大进
          f.cul += this.threshold(f.realm) * 0.6;
          f.lifespan += 6;
          news.push({ kind: "fortune", text: `传闻：${f.name} 寻得一枚续命灵丹，寿元稍延，闭死关冲击${this.realmName(f.realm + 1)}。` });
        } else {
          // 徒劳无功
          news.push({ kind: "sys", text: `听闻：${f.name} 苦求丹药而不得，徒叹奈何。` });
        }
      }
    }

    // 突破判定
    if (f.cul >= this.threshold(f.realm)) {
      const wall = f.realm >= 13; // 练气十三层→筑基，是巨大鸿沟
      let rate = 0.35 + (f.apt - 0.8) * 0.4 - (wall ? 0.25 : 0);
      rate = Math.max(0.04, Math.min(0.9, rate));
      if (rng() < rate) {
        f.realm += 1;
        f.cul = 0;
        f.lifespan = Math.max(f.lifespan, this.lifespanFor(f.realm));
        f.desperate = false;
        const kind = f.realm === 14 ? "ascend" : "breakthrough";
        const txt = f.realm === 14
          ? `喜讯：${f.name} 历尽艰辛，竟成功筑基！自此寿元大增，超脱凡俗之列。`
          : `传闻：${f.name} 突破至${this.realmName(f.realm)}。`;
        news.push({ kind, text: txt });
      } else {
        // 突破失败，积累折损，伤身
        f.cul *= 0.5;
        if (rng() < 0.15 && f.desperate) {
          f.status = "dead";
          news.push({ kind: "death", text: `噩耗：${f.name} 强冲${this.realmName(f.realm + 1)}失败，反噬之下油尽灯枯，就此坐化。` });
          return;
        }
      }
    }

    // 寿元耗尽：未能突破者，坐化身死
    if (f.age >= f.lifespan && f.status === "alive") {
      f.status = "dead";
      news.push({ kind: "death", text: `${f.name}（${this.realmName(f.realm)}）寿元耗尽，未能更进一步，无疾而终。凡修一生，止步于此。` });
    }
  },

  // 统计（供风云录展示）
  summary(s) {
    if (!s.npcFates) return { alive: [], dead: [], ascended: [] };
    return {
      alive: s.npcFates.filter(f => f.status === "alive"),
      dead: s.npcFates.filter(f => f.status === "dead"),
      ascended: s.npcFates.filter(f => f.status === "ascended" || f.realm >= 14),
    };
  },
};

if (typeof window !== "undefined") window.NPCSIM = NPCSIM;
if (typeof module !== "undefined" && module.exports) module.exports = NPCSIM;
