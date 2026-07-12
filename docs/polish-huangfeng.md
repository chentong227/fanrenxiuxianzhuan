# 黄枫谷篇 · 打磨清单（双审合并版 · 2026-07-12）

> 巡礼第 2 站（厚度十问首跑）。Fable 5 审戏 + GPT 5.6 审机器，结论互补零冲突：
> **锚厚帆薄，账本漏水，外加一把 bug**——主线锚链（夺丹恨→名额会→血色箱庭→炼丹→渡劫→赠剑→报应）与
> 血色禁地箱庭是全作标杆（"一根手指都不要动"）；但三年帆期没接受七玄门 A 系任何治疗、本章最重的三笔情感账
> 烂尾、若干系统是"一次性剧情装置"而非循环。
> 时长现状：裸奔 ≈1.5~2.5h / 自然 ≈2.5~5.5h（其中 ≈1h 低质量点击）。
> **新系统节拍判定（厚度十问 #9）**：通过——血色箱庭（优）/三段式渡劫（良）/法器装备+万宝楼（优）/代工链（良），
> 与七玄门（小绿瓶+尸傀）间隔 1 章。问题不是新系统不够，是**新系统的账面与余韵没跟上**。

---

## ✅ Bug 批（客观缺陷·已即时修复 2026-07-12）

| # | 项 | 修法 | 出处 |
|---|---|------|------|
| B① | **三个自由探索入口全接错**——乌龙潭/谷外山林/太南野林全被路由到七玄门后山（银甲角蟒/山林妖王/寒烟草不可达） | explore 行动按 loc.exploreSite 路由 enterExplore()，仅后山走 enterHoushan() | GPT P0-3 |
| B② | **制符零耗月刷条**——0 个月白拿制符+2×N 直到 30 级永久闭关×1.08（违"时间唯一货币"） | makeFulu 耗 1 月 | GPT P0-4 |
| B③ | **临行闭关双倍耗月**——passTime(3)+cultivate(3) 实耗 6 月，与另两路 3 月不等价 | 只调 cultivate(3) | GPT P0-6 |
| B④ | **ye_grudge 死结算**——ye_finale settle 一笔从未 write 的账，叶师叔报应拍永不触发 | hf_duodan 补 write（丹账人账分立）；顺手 settle zhangmen_no_justice（"掌门不给的公道世界补给你"） | Fable P1-1 |
| B⑤ | **nangongwan_bond 死读**——名额大会读一个必在其后才置位的 flag（时序死分支） | 删死分支 | Fable P0-3 |
| B⑥ | **mojiao_oath 哑账**——正宫线之根全仓零 settle | 金鼓原炒栗子节点 settle 点名（"立碑的立，她果然记到了今日"） | Fable P0-3 |
| B⑦ | **乌龙夺到手零演出**——妖材→法宝链首件落地是文字墙 | 炉火三拍（castHuo+橙闪+震屏→pushIn+剑鸣→success） | Fable P1-4 |

## A · 帆段重建（七玄门 A 系移植·双审同锚）

| # | 项 | 改法 | 出处 | 工程 |
|---|---|------|------|------|
| A1 ✅v318 | **时间预算失真**（本章最大结构病）：名额会不查日期、修为墙 7→11 层≈9330 修为=乐观十余年、长闭关 36 月只 tick 一拍世界 | 已做四刀：①jindi_meeting 改「大比时节（xueshi_due 日历锚）＋练气十一层」双门槛（xianhui_due 同构·currentObjective/天命栏倒计时双态文案·journey.test 适配）；②cultivate() 内 passTime 按 ≤3 月分段循环——ambient/涟漪/NPC 命途逐段真跑（36 月=12+ 拍·_checkSchedule 自带防重入·时间总量不变）；③修为曲线一把尺：Balance.culGainMul=1.62^clamp(idx−5,0,7)（修炼+修为类丹药同吃·练气1~6 恒 1.0 零扰动）＋仙门灵地 ×1.5（非七玄门章）＋七层起修为墙 ×0.75 重锚（645/855/1125/1465/1875/2400/3000——七层墙只在黄枫谷消耗，不属七玄门已校准段）＋lingyao_dan cul 60→80；实测勤奋玩家 7→11 层从 ≈15 年压到中位 43 月（七种子 33~53）；④test/huangfeng-time.audit.js（真引擎+种子化 RNG：中位 30~48 月带/最坏 ≤72/分段 tick ≥月数÷3/闭关期间风云录仍在涨/日历锚门禁） | GPT P0-1 | 中~大 |
| A2 ✅v318 | **药园差事升级**：本分/私种假取舍（私种严格占优、巡查只有文案）+ 全零事件 | 已做：①第三选项「照看参苗」——4 条小事件池（虫害急救/同门求药/马师伯考校辨药/移栽老参），产出药理+1~2/偶发灵草/信任；②巡查真后果——撞破记 flags.yaoyuan_caught，30% 当批没收（灵草归零），≥2 次停种 3 月（yaoyuan_ban_until·禁令期私种入口消失+文案报剩余月）；③本分/考校积 flags.ma_trust，≥6 一次性赠《百草谱》批注（药理+3·入年表·与 ma_approval 账呼应，其 settle 仍在 lianZhujiDan 未动）；三路=稳+信任／高产+风险／药理+人情，无严格占优 | GPT P1-1 + Fable P0-2 | 中 |
| A3 ✅v318 | **切磋断供**：本章无任何切磋行动（剑意轴唯一主动源=闭关兼修） | 已做：huangfeng_gate 加 spar 行动；spar() 黄枫谷分支=谷中同门合成对手（四人池·层数贴玩家±1·startSparFight 加 inter.foe 直供），应战剑意+6/独练+3 | Fable P0-2 | 小 |
| A4 ✅v318 | **涟漪独苗**：本章仅 1 条链（七玄门 3 条） | 已做：补 2 条链（engine._RIPPLES）——①wanbao_favor：名望≥25 或坊市交易≥5 后起链→「万宝楼二层法器八折」限时 3 月窗（wanbaoBuy/openWanbao 双侧计价·成交一件即收窗）；②jindi_rivalry：接 xueshi_due 日历锚→「坊市茶棚钻研禁地旧闻」花 1 月窗（writeLedger→enterJindiMap 时中环三节点预亮 visited="seen"+settleLedger 点名兑现，与钟吾舆图同管线）。两条均天命栏可见（obj-task 风声行+whereTxt）+坊市限时按钮（renderActions/dock 双路径）+过期自动消失 | Fable P0-2 | 小~中 |

## B · 筑基闭环（本章新系统的数值病）

| # | 项 | 改法 | 出处 | 工程 |
|---|---|------|------|------|
| B1 ✅v318 | **筑基准备收益反向**：地火一炉产 12~22 颗、秘仪只耗 1 颗、余丹无去处；三阶段敌血=道心 HP×3.6（心境越高敌越硬，准备优势被抵消）；失败损 90% 修为+耗一丹；安全路线两败即死档（禁地不可重进+lianZhujiDan 绑 mojiao_resolved） | 已做四刀：①三阶段敌血改吃 rite.trialHp 固定基数（trialBase=trialHp−修为火候−连败保底−余丹加持，只减不增）；②DATA.bigRealmRites.foundation.extra——每关必耗 1 外自动叠服至多 3 颗余丹（瓶颈−7/颗+道心+5/颗+成功 poolGain+至多2·openBreakthrough 面板可见）；③大境界失败修为损失 60%+30%→15%（败有所得·屡败弥坚明账）；④lianZhujiDan/UI 双侧解绑 mojiao_resolved（≥4 主药即开炉） | GPT P0-2 | 中 |
| B2 ✅v318 | **筑基后仍按练气档**：黄枫谷 realmTier 静态 0——筑基了法力池/驱动档/青元剑诀层 3~5 全锁死（层 4 提示"须筑基"却已筑基） | 已做：Chapters.realmTier()=max(章配置, 玩家真实大境界序)（重返天南 S0 同刀提前落地）；xinghaifeichi realmCapIndex 22→18 拆雷；yanjia_summon 延后 3 月=篇终"安家修行"帆段（objTitle/objHint 动态双态·currentObjective 支持函数 objTitle） | GPT P0-5 | 中 |
| B3 ✅v318 | **收官段天命栏黑洞**：出禁地→炼丹→嗑丹→渡劫全段显示"静待时机" | 已做：qingyuan_gift 加 objTitle「筑基之路」+动态 objHint(s)（主药≥4→"回洞府地火炼丹"；不足→"凑足四株"；已炼→"筑基丹×N 满匣——洞府『尝试突破』"·N=实时 count） | Fable P1-6 | 极小 |
| B4 ✅v318 | **地火炼丹=一次性装置**：只点一次、吃掉全部主药（撞 22 上限也白烧） | 已做：lianZhujiDan 反解产量公式——usedZhuyao=min(库存, max(4, ceil((22−6−药理项)/1.5)))，只扣参与产量的主药，余株保留并在开炉 log 明说「余下 X 株收好——将来另有用处」；（短炼丹局改造仍后置） | GPT P1-2 | 小~中 |

## C · 选择与账本

| # | 项 | 改法 | 出处 | 工程 |
|---|---|------|------|------|
| C1 ✅v318 | **厉飞雨回访兑现窗违约**：上一站种的三笔账（dabi_dan/dabi_watch/farewell_fang）指名本章兑现，本章无窗 | 已做：lify_revisit 节点（where=wuting·篇终后 6 月窗·objHint 倒计时）——执法堂首座"韩立！陪我过两招"，真切磋走 _mortalFighter 凡人相搏（藏拙+老本行·点到即止胜负皆结账）或叙旧路；_settleLifyLedgers 三账点名；错过窗=调令日捎酒兜底结算（账不赖）；journey.test 已适配 | Fable P0-1 | 中 |
| C2 ✅v318 | 入谷四连单选+四个死 flag（hanli_formal_bow/wulong_test/qingyuan_settle_first/yanjia_recon 无人读） | 已做：四个死 flag 全改 Engine.recordTemperament（拱手不跪=stoic／当场试爪=sentiment／先安顿=stoic／打探燕家堡=stoic），hint 统一「——铸入心性」不再空许诺；hf_duodan 尾部无双选（松手拍是叙事段），无处理项 | Fable P1-2 | 小 |
| C3 ✅v318 | **大件图鉴对本章三件头牌谎报**（筑基丹链/青元剑诀/神风舟永远"未闻"） | 已做：三条 stat 改动态分段+去 far 标记（入"可得"计数）——zhujidan=六段账面「筑基筹备 X/6」（辱→修为11层→名额→主药→自炼→破境·prog 进度条+下一步指路）；qingyuanjian=按 qingyuan_given/筑基/血色一战分段；shenfengzhou=按 flightId/mojiao_pi 在手/mojiao_slain 分段（含 daigong_fine_zhou 精工注记） | Fable P1-3 | 小 |
| C4 ✅v318 | 忘尘丹之择后果纯文本 | 已做：两条路 choice.effect 各配一拍——服丹=冷色 Fx.flash(#8fa4bd) + Sfx.ambientStop 静默拍（记忆被抹的留白）；不服=Sfx.play("chime") + 暖光微漾 Fx.flash(#ffe9c8)（直调既有原语·不新增资产名） | Fable P1-5 | 小 |
| C5 ✅v318 | 洞府半假选择：僻静谷无机制读点、灵泉严格占优 | 已做：读 flags.dongfu_type==="pijing"（实际 flag 名·非 yinbi）——cultivate() 走火 demonChance ×0.85 ＋ _seclusionInterlude 走火插曲带宽 0.24→0.204（让出的概率归心魔幻象）；dongfu_pick 两选项 hint 写实（灵泉「闭关修为+15%」/僻静谷「走火概率-15%」）、结果文案同步 | Fable P1-7 + GPT P1-3 | 小 |
| C6 ✅v318 | 代工不诚实：缺料仍锁 daigong_done；精工舟+2 速度实际无感（travelTimeFactor 已卡下限） | 已做：①daigongForge 三件全齐才锁 daigong_done（齐云霄明说缺什么·置 daigong_partial→元武国常驻「补炼缺件」行动 Engine.daigongRevisit·幂等补炉·耗 1 月）；②算账证实无感（舟 speedBonus=30→factor 恒卡 0.4 下限，+2 恒零效）——承诺改写实+真读点：精工舟改「旅途独立乘区」＝_journeyActionTravel 平安月 35% 一月并作两月路程（j.leg+1·御 shen_feng_zhou 限定），选项 hint/精工文案同步改 | GPT P1-4 | 小~中 |
| C7 ✅v318 | jindi_prep 三账只记不结 | 已做：cultivate/stock 两账在 finishExmap 出禁地时 settle 点名（"带进禁地的三个月准备在哪一刻救了你"）；alchemy 账在 lianZhujiDan 开炉时 settle 点名（既有 jindi_seat/ma_approval/yaoyuan_overharvest 三 settle 未动） | Fable P2-1 | 小 |

## D · 战斗与经济

| # | 项 | 改法 | 出处 | 工程 |
|---|---|------|------|------|
| D1 ✅v318 | 墨蛟同道代打风险（实测南宫婉贡献 208 伤 vs 玩家 23%） | **已实装**：南宫婉主手改「月华绫·缚」（低伤+缚敌气机=破绽一拍·combat 侧位 moves 新钩 `mv.expose`，窗口=一个玩家回合）、素女剑光 24→18、aggr 6→4；她的输出约 -40/场→墨蛟 hp 270→220 等量回吐（胜率带：改前 68.5%/玩家占比 42% → 改后 ~64%/49%）；combat `dealtBy` 玩家/侧位分账 + climax.bal 加"墨蛟玩家伤害占比 ≥35%"门禁 | GPT P1-5 | 中 |
| D2 ✅v318 | 禁地缺普通层战斗（血煞兽 130HP 已定义但地图不可遇） | **已实装**：xueshi_l1 加「血煞兽巡场」danger 节点（岩穴↔花圃岔线 1+1 钟=与直边 2 钟等价——在"路边"而非"路上"，可绕开）；exmapHunt 支持节点级 `huntEnemy` 指定+非 fog 图 f.hunted 记账（胜后可搜刮·不可重复刷·败原地留守不押回裂口）；掉落沿用 jindi_beast 既有 namedLoot（血煞结晶）+节点 loot（主药/灵石） | GPT P1-5 | 小 |
| D3 ✅v318 | 经济饱和：千年草双格一批=44 灵石、两批超三件顶阶法器总价；黄枫谷无悬赏板 | 已做（悬赏板半边）：fangshi 加「坊市告示·请托」行动（Engine.fangshiBoard·_pendingFortune 管线零新系统）——按绝对月号轮换 1 条急单（灵草×6→灵石9／火蛇符×2→灵石5／妖兽骨×2→灵石8，出价≈基准上浮两成），交货即结、每月一单（fangshi_order_done_abs 记账）；千年草价格校准依 A1 时间预算落地后另批 | GPT P1-6 | 小~中 |
| D4 ✅v318 | 丹道 40→60 白肝段（20 点换期望+0.063 丹/炉） | 已做：「丹火纯青」改乘性双读点——①alchemy() 炼养元丹一炉稳得双丹（原 0.35 封顶概率→必双·偶得三丹不变，期望 ≈1.4→2.2/炉）；②lianZhujiDan 药理项封顶 8→10（筑基丹品质读点）；里程碑 log 写明两处 | GPT P2-2 | 小 |
| D5 ✅v318 | build.bal 只测剑道 | **已实装**：build.bal.js 重写=layerMul 不变量（Part A 保留）+ 真实存档三档蒙特卡洛（Part B·_loadgame 真引擎）：等效 30 月投入（剑=剑意圆满悟剑大成／丹=药理+60+丹药底牌+秘仪余丹3／阵=制符+60+符箓阵旗满袋），各跑封岳/墨蛟/筑基劫。断言=擅长场景 ≥零投入基线 + 无一档全场垫底。实测：阵法封岳 89%（基线 0%）、丹道筑基劫 100%（基线 0%）、剑道墨蛟 75%（基线 64%）——**发现：剑道 30 月战力回报最薄（+11pt），后续可给 swordMastery 加战力线** | GPT P1-7 | 中 |

## E · P2 池（顺手做）

结算文案谎报掉落（布尔先存后写）｜私种撞破拍复读换短文案｜药园 flavor 7→12 条分池｜大比倒计时补"修为为凭不必等足月"｜谷外山林妖王占位名给诨名（"林祖宗"式·明示非考据）｜mojiao_neidan 下游（与再别天南验丹点名合并）。

**E 池清账（v318）**：③药园 flavor 7→12 ✅（本分路专池扩至 12 条；照看参苗已由 A2 的 _YAOYUAN_TEND_EVENTS 独立成池=天然分池）｜④大比倒计时 ✅（天命栏 ready 态改「修为为凭·不必等足月」）｜⑤妖王诨名 ✅（guwai_yaowang 定名「林祖宗」——enemies.introNote/beastRumors/yiwen 三处同步明示浑号非考据正名）｜⑥mojiao_neidan 下游 ✅（yiwen 墨蛟词条注「再别天南（掩月宗验丹）点名兑现·远线」）｜②私种撞破复读 ✅（已由 A2 巡查重做顺带解决：按撞破次数/没收与否三变体）｜①结算谎报掉落 ✗ 未复现——扫描 finishCombat/结算卡（namedLoot/namedBeast/走脱分支）与全库「先置 flag 后读同 flag」「先 give 后 count」模式，未找到与描述相符的实例（结算卡战利预览与 _finishCombat 发放同源一致），疑已被 Bug 批顺带修掉，留待下轮实测抓现行。

---

## 拍板项（其余默认按清单实装）

1. **A1 时间预算**——修为曲线校准会让本章"自然时长"从可能的十余年游戏内时间压到 30~48 月：**这是数值手术**（要动 cultivate 收益或修为墙），跑全套 bal。做不做、这轮做还是单开一批做？
2. **B1 筑基闭环重做**——"额外筑基丹入秘仪乘法+失败保留修为+敌血脱钩道心"三刀：改变本章最高潮的难度手感。建议做（这是"准备越足越稳"承诺的兑现），确认？
3. **B2 realmTier 动态档**——与重返天南篇 S0 的同一把手术刀，提前到本批做（黄枫谷/星海 cap 一起拆雷），确认？
4. **C1 厉飞雨回访**——上一站种的账在本章兑现（中等工程：一个节点+一场切磋+三账结算）。要不要这轮做？
5. **D1 墨蛟代打**——动同道数值（南宫婉改控场），跑 climax.bal。确认？
6. Bug 批七项已修（客观缺陷不占拍板）；其余 A2~A4/B3~B4/C2~C7/D2~D4/E 默认全做，有不要的点名。

*实装完成后：全量回归 + 新增 huangfeng-time.audit + climax/encounter/build bal + 430×932 实测，然后巡礼下一站魔道争锋。*
