/* ============================================================
 * combat.js — 五行灵气回合制战斗引擎（纯逻辑，无 DOM 依赖）
 *
 * 设计见 docs/combat-design.md 与 docs/attributes-and-balance.md
 * 同一套引擎用于：普通战斗 / 决战墨大夫 / 突破（与瓶颈心魔对战）
 *
 * 平衡要点（贯穿全局）：
 *  - 灵气DPS 有天花板（受灵根总量约束）；底牌(毒/暗器)提供灵气预算之外的额外DPS → 准备决定胜负
 *  - 神识：比较型，非独立攻击。高于对手→看穿其意图(底牌)+命中暴击加成
 *  - 遁速：决定先手 / 抢额外行动
 *  - 元神之敌：肉身招式无效，唯「运功镇魂」(功力换算伤害)可伤 → 靠功力胜余子童
 *  - 续航受限：回血弱且耗灵气，无法靠它耗死强敌
 * ============================================================ */

(function (root) {

  const Balance = (typeof require !== "undefined") ? require("./balance.js") : root.Balance;

  const ELEMENTS = ["jin", "mu", "shui", "huo", "tu"];
  const ELEM_NAME = { jin: "金", mu: "木", shui: "水", huo: "火", tu: "土" };

  /* ---------- 法术 / 招式库（严格限于七玄门篇韩立真实手段）----------
   * 长春功一系(吐纳/护体/凝神)、眨眼剑法、喂毒、暗器飞针、运功镇魂(对元神)。
   * 无火球御剑等杜撰法术。神识不在此列——它是被动比较属性。
   *
   * consume：施放需消耗一份底牌(平时准备的毒、暗器)。准备越足，能打出的底牌越多。
   */
  const SPELLS = {
    // 《长春功》一系（功法法术·木属性，受主修长春功品阶增益）
    tuna:     { name: "长春吐纳", cost: { mu: 3 },          type: "heal", heal: 9, school: "mu", source: "art",
                desc: "运转《长春功》吐纳调息，固本回元。修长春功者，回元更多。" },
    huti:     { name: "长春护体", cost: { mu: 3 },          type: "def", shield: 14, school: "mu", source: "art",
                desc: "以木灵之力护住周身。修长春功者，护体更坚。" },
    ningshen: { name: "凝神静气", cost: { mu: 1 },          type: "buff", nextQiBonus: 3, source: "art",
                desc: "凝神定志，蓄养下回合灵气。" },

    // 眨眼剑法：凡人武学，快、诡、廉价；施放积累「剑势」
    zhayan:   { name: "眨眼剑法", cost: { jin: 2 },         type: "atk", dmg: 8, dodgeSelf: 0.15, buildMomentum: 1, source: "martial",
                desc: "凡人剑术，身形快如眨眼，欺身一剑。每施一剑积累「剑势」。" },
    zhayan_lian:{ name: "眨眼连击", cost: { jin: 5 },       type: "atk", dmg: 13, dodgeSelf: 0.1, spendMomentum: true, momentumDmg: 5, source: "martial",
                desc: "凡人剑术，倾尽剑势连环爆发。每点「剑势」额外+5伤害，施后剑势清零。" },

    // 喂毒：凡人手段（淬毒），消耗毒草，叠加中毒
    weidu:    { name: "喂毒一击", cost: { jin: 1 },         type: "debuff", poison: { dmg: 7, turns: 4 }, source: "martial",
                consume: "duyao_cao",
                desc: "剑尖淬毒，令敌持续中毒。消耗一份毒草。" },

    // 暗器飞针：凡人武学（暗器），消耗暗器，破甲
    feizhen:  { name: "暗器飞针", cost: { jin: 1 },         type: "atk", dmg: 14, pierce: true, source: "martial",
                consume: "anqi",
                desc: "凡人暗器，激射飞针，例不虚发，破甲。消耗一支暗器。" },

    // 运功镇魂：功法法术，对元神之敌，伤害由「功力」换算
    zhenhun:  { name: "运功镇魂", cost: { mu: 2, shui: 2 }, type: "soul", source: "art",
                desc: "凝聚周身功力镇压神魂。唯对元神之敌有效，伤害取决于你的功力。" },
  };

  /* ---------- 灵气产出档案 ---------- */
  const PROFILES = {
    // 韩立四灵根：缺「土」，木最旺（《长春功》木属性），总量偏低
    hanli_si: { total: 10, weights: { jin: 3, mu: 4, shui: 2, huo: 1, tu: 0 } },
    common:   { total: 10, weights: { jin: 2, mu: 2, shui: 2, huo: 2, tu: 2 } },
    modafu:   { total: 11, weights: { jin: 1, mu: 3, shui: 3, huo: 2, tu: 2 } },
  };

  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------- 战斗者 ---------- */
  class Fighter {
    constructor(cfg) {
      this.name = cfg.name;
      this.hp = cfg.hp;
      this.hpMax = cfg.hp;
      this.shield = 0;
      this.sense = cfg.sense || 5;       // 神识（比较型）
      this.speed = cfg.speed || 10;      // 遁速（先手）
      this.insight = cfg.insight || 5;   // 悟性
      this.gongli = cfg.gongli || 20;    // 功力（镇魂/强弱刻度）
      this.agility = cfg.agility || 0;   // 身法（基础闪避，0~)
      this.profile = cfg.profile || "common";
      this.spells = cfg.spells || [];
      this.pouch = cfg.pouch || {};      // 底牌 { duyao_cao, anqi }
      this.status = {};
      this.immunePoison = cfg.immunePoison || false;
      this.soulOnly = cfg.soulOnly || false;
      this.dodgeBuff = 0;
      this.nextQiBonus = 0;
      this.momentum = 0;                 // 剑势（眨眼剑法积累，眨眼连击消耗）
      this.technique = cfg.technique || null;  // 主修功法 id（影响同系招式）
      this.grade = cfg.grade || 1;       // 主修功法品阶（1黄~4天）
      this.realmTier = cfg.realmTier || 0;     // 大境界序（0练气...）影响法术成长
      // 敌人意图：本回合预定的攻击（供神识看穿）
      this.intent = null;
      this.attacks = cfg.attacks || null;
      this.atk = cfg.atk; this.atkName = cfg.atkName; this.soulAtk = cfg.soulAtk; this.pierceAtk = cfg.pierce;
    }
    get alive() { return this.hp > 0; }
    hasConsumable(id) { return (this.pouch[id] || 0) > 0; }
    takeDamage(dmg, opts = {}) {
      if (this.soulOnly && !opts.soul) return { blocked: true, dealt: 0 };
      let remaining = dmg;
      if (this.shield > 0 && !opts.pierce) {
        const absorbed = Math.min(this.shield, remaining);
        this.shield -= absorbed;
        remaining -= absorbed;
      }
      this.hp = clampNum(this.hp - remaining, 0, this.hpMax);
      return { blocked: false, dealt: remaining };
    }
  }

  /* ---------- 战斗主体 ---------- */
  class Combat {
    constructor(cfg) {
      this.player = cfg.player instanceof Fighter ? cfg.player : new Fighter(cfg.player);
      this.enemies = (cfg.enemies || []).map(e => e instanceof Fighter ? e : new Fighter(e));
      this.maxRounds = cfg.maxRounds || 30;
      this.round = 0;
      this.qi = { jin: 0, mu: 0, shui: 0, huo: 0, tu: 0 };
      this.status = "ongoing";
      this.log = [];
      this.rng = cfg.rng || Math.random;
      this.mode = cfg.mode || "battle";
      this._pendingEnemyWaves = cfg.waves || null;
      this._rollEnemyIntents();
    }

    _log(msg) { this.log.push(msg); }

    /* ----- 神识优势（玩家 vs 当前首要敌人）----- */
    senseVs(enemy) {
      if (!enemy) return { diff: 0, seeIntent: false, hitBonus: 0, critBonus: 0 };
      return Balance.senseAdvantage(this.player.sense, enemy.sense || 5);
    }

    /* ----- 敌人意图：决定本回合敌人会用哪招（供神识看穿）-----
     * 意图带 kind：normal(普通,护体可挡) / pierce(破甲,须闪避) / charge(蓄力,本回合不攻击，下回合重创) */
    _rollEnemyIntents() {
      this.enemies.forEach(e => {
        // 蓄力中的敌人：本回合意图固定为"释放蓄力一击"
        if (e._charging) {
          e.intent = { name: e._charging.name + "·爆发", dmg: e._charging.dmg, kind: "release", pierce: e._charging.pierce };
          return;
        }
        const attacks = e.attacks && e.attacks.length ? e.attacks
          : [{ name: e.atkName || "攻击", dmg: e.atk || 8, soul: e.soulAtk, pierce: e.pierceAtk, kind: e.pierceAtk ? "pierce" : "normal" }];
        const pick = attacks[Math.floor(this.rng() * attacks.length)];
        if (!pick.kind) pick.kind = pick.pierce ? "pierce" : "normal";
        e.intent = pick;
      });
    }

    /* ----- 生成本回合灵气 ----- */
    startRound() {
      if (this.status !== "ongoing") return;
      this.round++;
      const prof = PROFILES[this.player.profile] || PROFILES.common;
      let total = prof.total + (this.player.nextQiBonus || 0);
      this.player.nextQiBonus = 0;
      if (this.player.status.fengling > 0) total = Math.floor(total * 0.7);

      // 悟性顿悟：小概率额外灵气
      const ins = Balance.insightBonus(this.player.insight);
      if (this.rng() < ins.epiphanyChance) { total += 2; this._epiphany = true; }
      else this._epiphany = false;

      this.qi = { jin: 0, mu: 0, shui: 0, huo: 0, tu: 0 };
      const w = prof.weights;
      const wsum = ELEMENTS.reduce((a, e) => a + w[e], 0) || 1;
      let assigned = 0;
      ELEMENTS.forEach(e => {
        if (w[e] <= 0) return;
        const base = Math.floor(total * (w[e] / wsum));
        this.qi[e] = base; assigned += base;
      });
      let leftover = total - assigned;
      const pool = ELEMENTS.filter(e => w[e] > 0);
      while (leftover > 0 && pool.length) {
        const e = pool[Math.floor(this.rng() * pool.length)];
        this.qi[e]++; leftover--;
      }
      this.player.dodgeBuff = 0;
      this._rollEnemyIntents();
      this._log(`【第${this.round}回合】灵气：` + this._qiText() + (this._epiphany ? "（顿悟！灵气+2）" : ""));
    }

    _qiText() {
      return ELEMENTS.filter(e => this.qi[e] > 0)
        .map(e => `${ELEM_NAME[e]}${this.qi[e]}`).join(" ") || "（无）";
    }

    canAfford(spellId) {
      const sp = SPELLS[spellId];
      if (!sp) return false;
      const qiOk = Object.entries(sp.cost).every(([e, n]) => this.qi[e] >= n);
      const consumeOk = !sp.consume || this.player.hasConsumable(sp.consume);
      return qiOk && consumeOk;
    }

    affordableSpells() {
      return this.player.spells.filter(id => this.canAfford(id));
    }

    /* ----- 施放法术（玩家）----- */
    cast(spellId, targetIndex = this._firstAliveEnemy()) {
      if (this.status !== "ongoing") return { ok: false, reason: "战斗已结束" };
      if (!this.player.spells.includes(spellId)) return { ok: false, reason: "未习得此法术" };
      const sp = SPELLS[spellId];
      if (sp.consume && !this.player.hasConsumable(sp.consume)) return { ok: false, reason: "底牌已用尽" };
      if (!this.canAfford(spellId)) return { ok: false, reason: "灵气不足" };
      Object.entries(sp.cost).forEach(([e, n]) => { this.qi[e] -= n; });
      if (sp.consume) this.player.pouch[sp.consume]--;

      const target = this.enemies[targetIndex];
      this._applySpell(this.player, sp, target);
      this._checkEnd();
      return { ok: true };
    }

    _emitFx(targetRef, kind, text) {
      // 记录一次战斗特效（供 UI 弹飘字）。targetRef: "enemy:i" | "player"
      (this._fx || (this._fx = [])).push({ ref: targetRef, kind, text });
    }

    _applySpell(caster, sp, target) {
      // 神识优势 → 命中/暴击加成
      const adv = (caster === this.player) ? this.senseVs(target) : { hitBonus: 0, critBonus: 0 };
      const tref = (caster === this.player) ? `enemy:${this.enemies.indexOf(target)}` : "player";

      if (sp.type === "atk" && target) {
        let dodge = (target.dodgeBuff || 0) + (target.agility || 0) / 100;
        if (sp.pierce) dodge *= 0.3;
        dodge = clampNum(dodge - adv.hitBonus, 0, 0.45);
        // 剑势：基础伤害 + 消耗剑势的额外伤害
        let baseDmg = sp.dmg;
        if (sp.spendMomentum) { baseDmg += (caster.momentum || 0) * (sp.momentumDmg || 0); }
        // 来源(武学/法术) × 功法品阶 × 境界 的强度换算
        baseDmg = Balance.spellPower(baseDmg, sp.source, caster.grade, caster.realmTier);
        if (this.rng() < dodge) {
          this._log(`${caster.name} 施「${sp.name}」，被 ${target.name} 闪避！`);
          this._emitFx(tref, "miss", "闪避");
        } else {
          let dmg = baseDmg, crit = false;
          if (this.rng() < clampNum(0.05 + adv.critBonus, 0, 0.4)) { dmg = Math.round(dmg * 1.6); crit = true; this._log(`（神识料敌于先，一击中的！）`); }
          const r = target.takeDamage(dmg, { pierce: sp.pierce });
          this._log(`${caster.name} 施「${sp.name}」，对 ${target.name} 造成 ${r.dealt} 伤害` + (target.shield > 0 ? `（余护体${target.shield}）` : ""));
          this._emitFx(tref, crit ? "crit" : (sp.pierce ? "pierce" : "dmg"), (crit ? "暴击 " : sp.pierce ? "破甲 " : "") + r.dealt);
        }
        if (sp.dodgeSelf) caster.dodgeBuff = (caster.dodgeBuff || 0) + sp.dodgeSelf;
        // 剑势结算：积累 / 消耗
        if (sp.buildMomentum) { caster.momentum = Math.min(5, (caster.momentum || 0) + sp.buildMomentum); }
        if (sp.spendMomentum) { caster.momentum = 0; }

      } else if (sp.type === "soul" && target) {
        if (!target.soulOnly) { this._log(`${caster.name} 运功镇魂，但 ${target.name} 乃血肉之躯，此法无用！`); this._emitFx(tref, "miss", "无效"); return; }
        const dmg = Balance.soulSuppressDamage(caster.gongli, target.gongli || 20);
        const r = target.takeDamage(dmg, { soul: true });
        this._log(`${caster.name} 运功镇魂，以功力冲击 ${target.name} 的神魂，造成 ${r.dealt} 伤害（${Math.max(0, Math.round(target.hp))}/${target.hpMax}）`);
        this._emitFx(tref, "soul", "镇魂 " + r.dealt);

      } else if (sp.type === "debuff" && target) {
        if (sp.poison) {
          if (target.immunePoison) { this._log(`${caster.name} 对 ${target.name} 用毒，但对方百毒不侵（死物）！`); this._emitFx(tref, "miss", "百毒不侵"); }
          else {
            const p = target.status.poison;
            if (p) { p.dmg += sp.poison.dmg; p.turns = Math.max(p.turns, sp.poison.turns); }
            else target.status.poison = { dmg: sp.poison.dmg, turns: sp.poison.turns };
            this._log(`${caster.name} 喂毒，${target.name} 中毒叠加至 ${target.status.poison.dmg}/回合`);
            this._emitFx(tref, "poison", "中毒 " + target.status.poison.dmg);
          }
        }
      } else if (sp.type === "heal") {
        // 主修长春功者，木系吐纳回元更多；并随功法品阶/境界成长
        const boost = (caster.technique === "changchun" && sp.school === "mu") ? 1.4 : 1;
        const heal = Balance.spellPower(Math.round(sp.heal * boost), sp.source, caster.grade, caster.realmTier);
        caster.hp = clampNum(caster.hp + heal, 0, caster.hpMax);
        this._log(`${caster.name} 施「${sp.name}」，回气血 ${heal}（${Math.round(caster.hp)}/${caster.hpMax}）`);
      } else if (sp.type === "def") {
        const boost = (caster.technique === "changchun" && sp.school === "mu") ? 1.4 : 1;
        const shield = Balance.spellPower(Math.round(sp.shield * boost), sp.source, caster.grade, caster.realmTier);
        caster.shield += shield;
        this._log(`${caster.name} 施「${sp.name}」，护体 +${shield}（共${caster.shield}）`);
      } else if (sp.type === "buff") {
        if (sp.nextQiBonus) caster.nextQiBonus = (caster.nextQiBonus || 0) + sp.nextQiBonus;
        this._log(`${caster.name} 施「${sp.name}」，凝神蓄力（下回合灵气+${sp.nextQiBonus || 0}）`);
      }
    }

    _firstAliveEnemy() { return this.enemies.findIndex(e => e.alive); }

    /* ----- 结束回合 ----- */
    endRound() {
      if (this.status !== "ongoing") return;
      this._tickStatus(this.player);

      this.enemies.forEach(e => {
        if (!e.alive) return;
        this._tickStatus(e);
        if (!e.alive) return;
        if (e.status.dingshen > 0) { e.status.dingshen--; this._log(`${e.name} 被定身，无法行动`); return; }
        this._enemyAct(e);
      });

      this._checkEnd();
      if (this.status === "ongoing") {
        this._maybeSpawnWave();
        if (this.round >= this.maxRounds) { this.status = "lose"; this._log(`回合耗尽，未能取胜。`); }
      }
    }

    _tickStatus(f) {
      if (f.status.poison && f.status.poison.turns > 0) {
        const dmg = f.status.poison.dmg;
        f.hp = clampNum(f.hp - dmg, 0, f.hpMax);
        f.status.poison.turns--;
        this._log(`${f.name} 毒发，气血-${dmg}（${Math.max(0, Math.round(f.hp))}/${f.hpMax}）`);
        const ref = f === this.player ? "player" : `enemy:${this.enemies.indexOf(f)}`;
        this._emitFx(ref, "poison", "毒 " + dmg);
        if (f.status.poison.turns <= 0) delete f.status.poison;
      }
      if (f.status.fengling > 0) { f.status.fengling--; if (f.status.fengling <= 0) delete f.status.fengling; }
    }

    _enemyAct(e) {
      const a = e.intent || { name: e.atkName || "攻击", dmg: e.atk || 8, soul: e.soulAtk, pierce: e.pierceAtk, kind: "normal" };
      // 蓄力意图：本回合不攻击，标记蓄力，下回合释放重击（看穿者可趁机爆发/打断）
      if (a.kind === "charge") {
        e._charging = { name: a.name, dmg: Math.round((a.dmg || 8) * 2), pierce: a.pierce };
        this._log(`${e.name} 周身气势暴涨，正在蓄力「${a.name}」——下回合将有雷霆一击！`);
        this._emitFx(`enemy:${this.enemies.indexOf(e)}`, "miss", "蓄力");
        return;
      }
      if (a.kind === "release") e._charging = null; // 释放完毕
      let dodge = (this.player.dodgeBuff || 0) + (this.player.agility || 0) / 100;
      const enemyAdv = Balance.senseAdvantage(e.sense || 5, this.player.sense);
      dodge = clampNum(dodge - enemyAdv.hitBonus, 0, 0.6);
      if (this.rng() < dodge) { this._log(`${e.name} 使「${a.name}」，被 ${this.player.name} 闪避！`); this._emitFx("player", "miss", "闪避"); return; }
      const r = this.player.takeDamage(a.dmg || 8, { soul: a.soul, pierce: a.pierce });
      if (r.blocked) { this._log(`${e.name} 的「${a.name}」对你无效`); this._emitFx("player", "miss", "无效"); }
      else { this._log(`${e.name} 使「${a.name}」，你受到 ${r.dealt} 伤害（${Math.max(0, Math.round(this.player.hp))}/${this.player.hpMax}）`); this._emitFx("player", "hurt", r.dealt); }
    }

    _maybeSpawnWave() {
      if (!this._pendingEnemyWaves || !this._pendingEnemyWaves.length) return;
      if (this.enemies.every(e => !e.alive)) {
        const wave = this._pendingEnemyWaves.shift();
        this.enemies = wave.map(e => new Fighter(e));
        this._rollEnemyIntents();
        this._log(`—— 新的敌人现身！——`);
        this.status = "ongoing";
      }
    }

    _checkEnd() {
      if (this.player.hp <= 0) { this.status = "lose"; this._log(`${this.player.name} 气血耗尽，败。`); return; }
      const allDead = this.enemies.every(e => !e.alive);
      if (allDead && (!this._pendingEnemyWaves || this._pendingEnemyWaves.length === 0)) {
        this.status = "win"; this._log(`敌人尽灭，胜！`);
      }
    }
  }

  const CombatAPI = { Combat, Fighter, SPELLS, PROFILES, ELEMENTS, ELEM_NAME };
  root.Combat = Combat;
  root.CombatAPI = CombatAPI;
  if (typeof module !== "undefined" && module.exports) module.exports = CombatAPI;

})(typeof window !== "undefined" ? window : globalThis);
