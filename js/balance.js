/* ============================================================
 * balance.js — 全局平衡公式（贯穿整个游戏的"尺子"）
 * 见 docs/attributes-and-balance.md
 *
 * 纯函数集合，无 DOM / 无状态，战斗与大世界共用，便于无头测试与后续章节复用。
 * ============================================================ */

(function (root) {
  const Balance = {
    /* ---- 境界功力基数：每个境界一个台阶（练气分层递增，筑基起跳）---- */
    // tierBase：大境界基数；练气层内线性补足
    realmPower(tier, layer) {
      const tierBase = { qi: 0, foundation: 100, core: 400, nascent: 1200 }[tier] || 0;
      const layerStep = { qi: 6, foundation: 30, core: 100, nascent: 300 }[tier] || 6;
      return tierBase + layer * layerStep;
    },

    /* ---- 功力：实力总刻度 ---- */
    gongli({ tier, layer, culRatio = 0, sense = 0, body = 0 }) {
      return this.realmPower(tier, layer)
        + culRatio * ({ qi: 6, foundation: 30, core: 100, nascent: 300 }[tier] || 6)
        + sense * 1.2
        + body * 0.6;
    },

    /* ---- 神识优势：玩家 vs 对手 ---- */
    senseAdvantage(playerSense, enemySense) {
      const diff = playerSense - enemySense;
      return {
        diff,
        seeIntent: diff >= 3,                              // 看穿对方下回合意图(底牌)
        hitBonus: clamp(diff * 0.02, -0.2, 0.2),           // 命中加成
        critBonus: clamp(diff * 0.015, -0.15, 0.2),        // 暴击加成
      };
    },

    /* ---- 镇魂伤害：对元神(soulOnly)之敌，靠功力而非招式 ---- */
    soulSuppressDamage(gongli, enemyGongli) {
      // 功力越高于对方，镇压越狠；低于对方则收效甚微
      const ratio = gongli / Math.max(1, enemyGongli);
      return Math.max(2, Math.round(8 * ratio));
    },

    /* ---- 遁速 → 大世界赶路耗时系数 ---- */
    travelTimeFactor(playerSpeed, baseSpeed = 10) {
      return clamp(baseSpeed / Math.max(1, playerSpeed), 0.4, 1.5);
    },

    /* ---- 遁速 → 先手：谁先动 / 是否抢额外行动 ---- */
    initiative(playerSpeed, enemySpeed, rng = Math.random) {
      const diff = playerSpeed - enemySpeed;
      const playerFirst = diff >= 0 || rng() < 0.5 + diff * 0.02;
      const extraAction = diff > 8 && rng() < clamp((diff - 8) * 0.03, 0, 0.35);
      return { playerFirst, extraAction };
    },

    /* ---- 悟性 → 突破削瓶颈加成 / 顿悟概率 ---- */
    insightBonus(insight) {
      return {
        bottleneckMul: 1 + clamp(insight * 0.02, 0, 0.6),  // 削瓶颈伤害倍率
        epiphanyChance: clamp(insight * 0.015, 0, 0.3),    // 每回合顿悟(额外灵气/暴击)概率
      };
    },

    /* ---- 难度档：敌人威胁比（敌有效输出 / 玩家可承受）---- */
    threatTier(name) {
      return { common: 0.6, strong: 0.9, boss: 1.3 }[name] || 0.6;
    },

    /* ---- 灵气回合结转上限：只有高阶修士才囤得住灵气 ----
     * 练气(tier0)几乎"用不完即散"，仅能存一两点接续连招；
     * 境界越高，越能蓄养灵气、酝酿大招。
     */
    qiCarryCap(realmTier) {
      return ({ 0: 2, 1: 4, 2: 7, 3: 11, 4: 16 })[realmTier || 0] != null
        ? ({ 0: 2, 1: 4, 2: 7, 3: 11, 4: 16 })[realmTier]
        : 2 + (realmTier || 0) * 3;
    },

    /* ---- 小境界突破：心魔低于此阈值则可水到渠成；高于则须先闯「心战」 ---- */
    demonTrialThreshold() { return 35; },

    /* ---- 功法/技能 槽位（随境界增长，越高阶越能自由组合）----
     * 主修恒为 1 个；辅修槽与技能(法术)槽随大境界序放宽。
     */
    secondaryTechniqueSlots(realmTier) {
      return ({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 })[realmTier] != null
        ? ({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 })[realmTier]
        : 1 + (realmTier || 0);
    },
    // 出战技能槽收紧（用户裁决：界面不膨胀，取舍才有 build）。底牌(毒/暗器)不占槽。
    skillSlots(realmTier) {
      return ({ 0: 5, 1: 6, 2: 7, 3: 8, 4: 9 })[realmTier] != null
        ? ({ 0: 5, 1: 6, 2: 7, 3: 8, 4: 9 })[realmTier]
        : 5 + (realmTier || 0);
    },
    // 辅修功法所授技能的强度折扣（主修全效，辅修打折）
    auxiliaryMul() { return 0.7; },

    /* ---- 招式有效强度：来源(武学/法术) × 功法品阶 × 境界 ---- */
    // source: "martial"|"art"；grade: 主修功法品阶(1黄~4天)；realmTier: 大境界序(0练气,1筑基,...)
    sourceMul(source) { return source === "martial" ? 0.8 : 1.0; },
    gradeMul(grade) { return ({ 0: 0.85, 1: 1.0, 2: 1.15, 3: 1.35, 4: 1.6 })[grade || 1] || 1.0; },
    realmScale(source, realmTier) {
      // 武学几乎不随境界成长；法术随境界成长
      if (source === "martial") return 1 + (realmTier || 0) * 0.05;
      return 1 + (realmTier || 0) * 0.35;
    },
    spellPower(base, source, grade, realmTier) {
      let mul = this.sourceMul(source) * this.realmScale(source, realmTier);
      // 品阶加成只作用于功法法术，不作用于凡人武学
      if (source !== "martial") mul *= this.gradeMul(grade);
      return Math.max(1, Math.round(base * mul));
    },
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  root.Balance = Balance;
  if (typeof module !== "undefined" && module.exports) module.exports = Balance;
})(typeof window !== "undefined" ? window : globalThis);
