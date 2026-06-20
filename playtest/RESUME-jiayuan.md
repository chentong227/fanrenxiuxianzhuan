# Playtest Report: 嘉元城 (Jiayuan City) Chapter

**Date**: 2026-06-20  
**Branch**: `devin/1781943174-v149-bugfix`  
**Viewport**: iPhone 14 Pro Max (430x932)  
**Save file**: `playtest/save-jiayuan.json`

---

## Summary

Played through the 嘉元城 chapter from storyStage 15 (七玄篇 arc_end at 演武厅) to storyStage 18 (嘉元城 complete, ready for 太南谷). All P0/P1 issues from the previous bug report have been resolved.

## Story Progression

| Stage | Event | Description |
|-------|-------|-------------|
| 15 | 启程 | Departed from 演武厅 via map, traveled 3 months to 嘉元城 |
| 15→16 | 墨府投信 | Arrived at 墨府, delivered Mo Dafu's letter, met 墨彩环 |
| 16 | 墨府 · 暗流 | 1 month cultivation triggered night intruders event; gained reputation +8 |
| 17 | 暖阳宝玉 · 嫁妆 | Resolved cold poison (han_du_cured=true), chose to bring 曲魂 along |
| 18 | 南下太南谷 | Main quest updated: travel to 太南谷 for cultivator market |

## Game State at Checkpoint

- **storyStage**: 18
- **Location**: jiayuan_city (ready to depart for tainan_fair)
- **Month/Year**: 6 / 1
- **Cultivation**: 144/640 (练气5层)
- **HP**: 100/100
- **Spirit**: 386/400
- **Mood**: 97/100
- **Reputation**: 60
- **曲魂**: 48/70 (随行)

## Issues Found

### Rendering / Visuals

| Severity | Issue | Details |
|----------|-------|---------|
| OK | Scene backgrounds | All scene backgrounds rendered correctly (嘉元城 streets, 墨府 courtyard, 墨府 night) - no black screens |
| OK | NPC portraits | 墨彩环 portrait loaded correctly (mocaihuan.png) |
| OK | Scene transitions | Cutscene transitions smooth, no flicker or blank frames |

### Gameplay / Logic

| Severity | Issue | Details |
|----------|-------|---------|
| P2 | Travel buttons still show old locations | After arriving at 嘉元城, the sidebar still shows 墨大夫药庐/七玄门后山/演武厅/山下集镇 as travel destinations — these are 七玄篇 locations, not 嘉元城 local spots. Cosmetic but slightly confusing. |
| P3 | "山雨欲来" task timer | The timed task "山雨欲来" (reach 练气6层 in 8 months) remains active despite leaving七玄门. May be intentional game design (lingering threat). |

### UI / UX (iPhone 14 Pro Max)

| Severity | Issue | Details |
|----------|-------|---------|
| OK | Layout | All UI elements fit within 430px width correctly |
| OK | Touch targets | Buttons are appropriately sized for mobile touch |
| OK | Cutscene text | Readable font size on mobile viewport |
| OK | Map navigation | Map pins are clickable and responsive |

## No-Issue Confirmations

- All generated scene art (嘉元城 scenes) rendered without black screens
- NPC speaker names displayed correctly in dialogue (墨彩环, etc.)
- Story choices registered and advanced the plot as expected
- Cultivation system worked correctly (+14 修为 per month)
- Save/load system preserved all game state

## Next Steps

- Navigate to 太南谷 (Tainan Valley) via map
- Play through the cultivator market arc (太南小会)
- Continue documentation of any issues
