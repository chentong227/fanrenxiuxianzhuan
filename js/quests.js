/* ============================================================
 * quests.js — 任务系统 与 时间线（预定事件）
 *
 * 两类机制：
 *  1) 时间线事件 events：在未来某月必定发生（如"墨大夫出门五月，归来日张铁身死"）。
 *  2) 限期任务 tasks：给定期限内达成条件则成功(赏)，到期未成则失败(罚/强制事件，甚至强制战斗)。
 *
 * 状态里只存 { id, dueAbs }（可序列化）；逻辑挂在此注册表（含函数）。
 * 时间以"绝对月"计：absMonth = year*12 + month。
 * ============================================================ */

const QUESTS = {
  /* ---------- 限期任务 ---------- */
  tasks: {
    // 墨大夫按层给银，限期验功（达成→赏银；逾期→失欢心）
    modafu_deadline: {
      title: "墨大夫的期许",
      desc: "墨大夫限你修《长春功》至练气三层，届时验功重赏。莫要懈怠。",
      progress: (s) => `练气${s.realmIndex + 1}层 / 需练气三层`,
      cond: (s) => s.realmIndex >= 2,                 // 练气三层
      onSuccess(s) {
        s.silver += 40;
        Engine.log("【任务达成·墨大夫的期许】你如期修至练气三层，墨大夫大悦，重赏纹银四十两。", "good");
        Engine.toast("任务达成：墨大夫的期许（+40两）");
      },
      onFail(s) {
        s.mood = Math.max(0, s.mood - 12);
        s.demon = Math.min(100, s.demon + 6);
        Engine.log("【任务失败·墨大夫的期许】期限已到，你修为未及练气三层。墨大夫面色阴沉，对你颇为失望，赏银也停了。", "bad");
        Engine.toast("任务失败：未能如期修至练气三层", true);
      },
    },

    // 野狼帮挑衅：限期内修为未成，则喽啰夜袭药庐（强制战斗），并继续施压
    wolf_raid: {
      title: "山雨欲来",
      desc: "野狼帮气焰嚣张，时有喽啰袭扰。趁早修炼精进（练气六层），方有底气应对将来的大祸。",
      progress: (s) => `练气${s.realmIndex + 1}层 / 需练气六层`,
      cond: (s) => s.realmIndex >= 6,
      onFail(s) {
        Engine.log("【任务·山雨欲来】你迟迟未能精进，野狼帮喽啰摸进药庐寻衅——被迫迎战！", "bad");
        Engine.toast("野狼帮夜袭！", true);
        // 强制战斗（到期触发的强制事件）
        Engine.startEncounterFight("wolf_gang_thug");
        // 未达标则继续施压：再给一段期限
        Engine.assignTask("wolf_raid", 5);
      },
    },
  },

  /* ---------- 时间线预定事件 ---------- */
  events: {
    // 墨大夫派张铁外出，约定数月；归期之日，张铁身死的真相浮现
    zhangtie_death: {
      onFire(s) {
        State.setFlag("zhangtie_fated");
        Engine.log("【时间线】张铁外出已逾归期，却音讯全无……一种不祥的预感涌上你心头。", "bad");
      },
    },
  },
};

window.QUESTS = QUESTS;
