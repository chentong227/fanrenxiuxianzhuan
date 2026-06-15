/* ============================================================
 * loadout.js — 功法 / 技能 配装系统
 *
 * 真实修仙的"自由组合"：
 *  - 功法是背包里的「典籍」道具，须在闭关时静心研习方能习得。
 *  - 习得后可设为「主修」(×1) 或「辅修」(随境界增多)。主修全效，辅修打折。
 *  - 各功法授予若干「技能(法术)」；连同凡人武学，组成你的技能池。
 *  - 出战技能受「技能槽」上限约束（随境界放宽）——格子有限，方有取舍。
 *  - 强度随境界成长（见 balance.spellPower）。
 *
 * 状态字段（state.js）：
 *   technique            主修功法 id（沿用旧字段）
 *   auxTechniques[]      辅修功法 id
 *   learnedTechniques[]  已习得功法 id
 *   knownSkills[]        已掌握技能(法术) id 池
 *   spells[]             已「装备」出战的技能（战斗实际可用，受槽位上限约束）
 *
 * 纯逻辑、可无头测试。
 * ============================================================ */

(function (root) {

  const Balance = (typeof require !== "undefined") ? require("./balance.js") : root.Balance;

  const Loadout = {
    // 凡人武学「标记表」：仅用于战斗折算判定（武学不吃辅修折扣），不参与技能授予。
    // 可用招式一律以 s.spells（已装备）为准——此表不会把招式塞进技能池。
    // 眨眼连击(zhayan_lian) 刻意不列此：正常进程不可得——眨眼剑法本体(zhayan)经「剑意」
    // 大成直接进化为连环眨眼(lianhuan)，无独立"连击"中间档（详见 docs/retention-design.md 剑意修行链）。
    INNATE_MARTIAL: ["zhayan", "weidu", "feizhen"],
    // 底牌（消耗性手段）：独立体系，不占技能槽。
    // 符箓/符宝/丹药/阵旗也是底牌（combat-arsenal-design.md 轴3）：有实物即可用，无需研习。
    TRUMPS: ["weidu", "feizhen", "huoshe_fu", "hanbing_fu", "jinguang_zhuan",
             "jinchuang_yao", "huiyuan_dan", "dingshen_fu", "zhenqi_kunzu", "zhenqi_juling"],
    // 实物类底牌：背包里有货即自动入战（买来就能用——符与丹是修仙界的通货）
    TALISMANS: { huoshe_fu: "huoshe_fu", hanbing_fu: "hanbing_fu", jinguang_zhuan: "jinguang_zhuan_charge",
                 jinchuang_yao: "huixue_dan", huiyuan_dan: "huiyuan_dan", dingshen_fu: "dingshen_fu",
                 zhenqi_kunzu: "zhenqi_kunzu", zhenqi_juling: "zhenqi_juling" },

    isTrump(skillId) { return this.TRUMPS.includes(skillId); },

    // —— 槽位上限（随境界） ——
    skillCap(s) {
      const tier = (typeof Chapters !== "undefined") ? Chapters.realmTier() : (s._realmTier || 0);
      return Balance.skillSlots(tier);
    },
    // 占槽的出战法术数（底牌不计；法宝法器技不计——法宝走主/御/悬浮三位制，gear 注入）
    equippedCount(s) {
      const SP = (typeof CombatAPI !== "undefined") ? CombatAPI.SPELLS : null;
      return (s.spells || []).filter(id => !this.isTrump(id)
        && !(SP && SP[id] && SP[id].source === "treasure")).length;
    },
    auxCap(s) {
      const tier = (typeof Chapters !== "undefined") ? Chapters.realmTier() : (s._realmTier || 0);
      return Balance.secondaryTechniqueSlots(tier);
    },

    // —— 功法：习得 / 主修 / 辅修 ——
    isLearned(s, techId) { return (s.learnedTechniques || []).includes(techId); },

    // —— 功法层数轴（technique-tiers §5）——
    // 每门功法有自己的最高层数与逐层解锁表；习得=入门(第1层)，靠肝升层逐步解锁更高层战技。
    _def(techId) { return (typeof DATA !== "undefined") ? DATA.techniques[techId] : null; },
    maxLayer(techId) { const d = this._def(techId); return (d && d.maxLayers) || 1; },
    // 当前层（惰性：未记录但已习得=入门第1层；未习得=0）
    techLayer(s, techId) {
      if (s.techLayers && s.techLayers[techId]) return s.techLayers[techId];
      return this.isLearned(s, techId) ? 1 : 0;
    },
    // 某功法在「指定层」实际授予的技能 = 基础内功(grantSpells) + 已达层的 layerUnlocks
    _techGrants(def, layer) {
      if (!def) return [];
      const out = (def.grantSpells || []).slice();
      const lu = def.layerUnlocks;
      if (lu) Object.keys(lu).forEach(k => {
        if ((+k) <= (layer || 1)) (lu[k] || []).forEach(sk => { if (!out.includes(sk)) out.push(sk); });
      });
      return out;
    },
    // 把「当前层可用」的技能补进已掌握池（升层/习得后调用）
    _layerSync(s, techId) {
      const def = this._def(techId);
      this._techGrants(def, this.techLayer(s, techId)).forEach(sk => this.addKnownSkill(s, sk));
    },
    // 主修功法当前层所授的全部技能 id（供战斗按层加成 layerMul）
    mainScaledSpells(s) {
      const def = this._def(s.technique);
      if (!def || !def.maxLayers) return [];
      return this._techGrants(def, this.techLayer(s, s.technique));
    },
    // 升一层：达标即把新层战技纳入技能池。返回 { ok, layer, max, newSkills }
    raiseLayer(s, techId) {
      if (!this.isLearned(s, techId)) return { ok: false, reason: "尚未习得此功法" };
      const def = this._def(techId);
      const max = this.maxLayer(techId);
      const cur = this.techLayer(s, techId) || 1;
      if (cur >= max) return { ok: false, reason: "已至此版功法顶层" };
      const before = new Set(this._techGrants(def, cur));
      s.techLayers = s.techLayers || {};
      s.techLayers[techId] = cur + 1;
      this._layerSync(s, techId);
      const newSkills = this._techGrants(def, cur + 1).filter(sk => !before.has(sk));
      return { ok: true, layer: cur + 1, max, newSkills };
    },

    // 研习一卷功法典籍（闭关时调用）。opts.layer 可指定起始层（剧情特授，如李化元赠九层版起手即三层）。返回 { ok, reason }
    learnTechnique(s, techId, opts) {
      const def = (typeof DATA !== "undefined") ? DATA.techniques[techId] : null;
      if (!def) return { ok: false, reason: "无此功法" };
      if (def.locked) return { ok: false, reason: "此功法机缘未到，暂不可习" };
      if (this.isLearned(s, techId)) return { ok: false, reason: "已习得此功法" };
      if (!s.learnedTechniques) s.learnedTechniques = [];
      s.learnedTechniques.push(techId);
      // 习得=入门(第1层)；剧情可指定更高起始层
      s.techLayers = s.techLayers || {};
      const startLayer = (opts && opts.layer) ? Math.min(opts.layer, def.maxLayers || 1) : 1;
      s.techLayers[techId] = Math.max(s.techLayers[techId] || 0, def.maxLayers ? startLayer : 1);
      // 习得即把「当前层可用」技能纳入技能池（基础内功 + 已达层 layerUnlocks）
      this._layerSync(s, techId);
      return { ok: true };
    },

    setMain(s, techId) {
      if (!this.isLearned(s, techId)) return { ok: false, reason: "尚未习得此功法" };
      // 旧主修转入辅修池（若有空位）；新主修从辅修中移除
      const old = s.technique;
      s.auxTechniques = (s.auxTechniques || []).filter(t => t !== techId);
      if (old && old !== techId && this.auxCap(s) > (s.auxTechniques || []).length) {
        s.auxTechniques.push(old);
      }
      s.technique = techId;
      this._resyncKnown(s);
      return { ok: true };
    },

    addAux(s, techId) {
      if (!this.isLearned(s, techId)) return { ok: false, reason: "尚未习得此功法" };
      if (techId === s.technique) return { ok: false, reason: "主修不可同时为辅修" };
      if (!s.auxTechniques) s.auxTechniques = [];
      if (s.auxTechniques.includes(techId)) return { ok: false, reason: "已是辅修" };
      if (s.auxTechniques.length >= this.auxCap(s)) return { ok: false, reason: "辅修槽位已满（随境界增多）" };
      s.auxTechniques.push(techId);
      this._resyncKnown(s);
      return { ok: true };
    },

    removeAux(s, techId) {
      s.auxTechniques = (s.auxTechniques || []).filter(t => t !== techId);
      this._resyncKnown(s);
      return { ok: true };
    },

    // 当前生效的功法（主修 + 辅修）
    activeTechniques(s) {
      const out = [];
      if (s.technique) out.push(s.technique);
      (s.auxTechniques || []).forEach(t => out.push(t));
      return out;
    },

    // 某技能是否来自辅修功法（用于战斗打折）
    isAuxSkill(s, skillId) {
      if (this.INNATE_MARTIAL.includes(skillId)) return false;
      const mainDef = this._def(s.technique);
      if (mainDef && this._techGrants(mainDef, this.techLayer(s, s.technique)).includes(skillId)) return false; // 主修授予=全效
      // 来自辅修功法
      return (s.auxTechniques || []).some(t => {
        const d = this._def(t);
        return d && this._techGrants(d, this.techLayer(s, t)).includes(skillId);
      });
    },

    // 辅修技能 id 集合（供战斗折算）
    auxSkillSet(s) {
      const set = [];
      (s.spells || []).forEach(sk => { if (this.isAuxSkill(s, sk)) set.push(sk); });
      return set;
    },

    // —— 技能：习得池 / 装备 ——
    addKnownSkill(s, skillId) {
      if (!s.knownSkills) s.knownSkills = [];
      if (!s.knownSkills.includes(skillId)) s.knownSkills.push(skillId);
    },

    // 技能池：已习得功法「当前层」所授 + 凡人武学（限已掌握的）+ 剧情特授
    // 注意：高层战技未升到对应层则不入池（学会功法≠会放高层剑术）。
    knownPool(s) {
      const pool = new Set(s.knownSkills || []);
      this.activeTechniques(s).forEach(t => {
        const d = this._def(t);
        if (d) this._techGrants(d, this.techLayer(s, t)).forEach(sk => pool.add(sk));
      });
      return [...pool];
    },

    isEquipped(s, skillId) { return (s.spells || []).includes(skillId); },

    equipSkill(s, skillId) {
      if (!this.knownPool(s).includes(skillId)) return { ok: false, reason: "尚未掌握此技能" };
      if (this.isEquipped(s, skillId)) return { ok: false, reason: "已装备" };
      // 底牌不占技能槽（独立体系）
      if (!this.isTrump(skillId) && this.equippedCount(s) >= this.skillCap(s)) return { ok: false, reason: "技能槽已满（随境界增多）" };
      if (!s.spells) s.spells = [];
      s.spells.push(skillId);
      return { ok: true };
    },

    unequipSkill(s, skillId) {
      s.spells = (s.spells || []).filter(x => x !== skillId);
      return { ok: true };
    },

    // 主修/辅修变更后，把失去来源、又未单独掌握的技能从出战栏剔除（保持自洽）
    _resyncKnown(s) {
      const pool = this.knownPool(s);
      s.spells = (s.spells || []).filter(sk => pool.includes(sk));
    },

    // 老存档迁移：把旧 spells 当作"已掌握且已装备"，主修沿用 technique
    migrate(s) {
      if (!s.learnedTechniques) s.learnedTechniques = [s.technique].filter(Boolean);
      if (!s.auxTechniques) s.auxTechniques = [];
      if (!s.knownSkills) s.knownSkills = (s.spells || []).slice();
      // 功法层数轴惰性兜底（§5.5）：未记录的已习功法默认入门(1)；
      // 若其高层 layerUnlocks 战技已在掌握/出战池，则回填到能保留这些技能的最低达标层——保证老存档不退化（已装备招式不丢）。
      s.techLayers = s.techLayers || {};
      const have = new Set([...(s.knownSkills || []), ...(s.spells || [])]);
      (s.learnedTechniques || []).forEach(tid => {
        if (s.techLayers[tid]) return;
        const def = this._def(tid);
        if (!def) return;
        let layer = 1;
        if (def.layerUnlocks) Object.keys(def.layerUnlocks).forEach(k => {
          if ((def.layerUnlocks[k] || []).some(sk => have.has(sk))) layer = Math.max(layer, +k);
        });
        s.techLayers[tid] = layer;
      });
      // 确保主修当前层所授技能在已掌握池
      const md = this._def(s.technique);
      if (md) this._techGrants(md, this.techLayer(s, s.technique)).forEach(sk => this.addKnownSkill(s, sk));
    },
  };

  root.Loadout = Loadout;
  if (typeof module !== "undefined" && module.exports) module.exports = Loadout;

})(typeof window !== "undefined" ? window : globalThis);
