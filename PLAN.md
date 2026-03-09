# 🀄 网页麻将游戏开发计划

## 项目概述

- **项目名称**: 网页麻将 (Mahjong Web)
- **类型**: 单人网页游戏
- **技术栈**: 纯 HTML/CSS/JS (轻量)
- **规则**: 中国麻将简化版
- **模式**: 四人局 (玩家 + 3 AI)
- **风格**: 古典中国风

---

## 技术架构

```
mahjong/
├── index.html          # 主页面
├── css/
│   └── style.css       # 古典风格样式
├── js/
│   ├── game.js         # 游戏主逻辑
│   ├── tile.js         # 牌操作
│   ├── ai.js           # AI 逻辑
│   ├── judge.js        # 胡牌判定
│   └── sound.js        # 音效合成
└── assets/
    └── tiles/          # 牌面图片 (34x4=136张, 含背面)
```

---

## Phase 1: 数据结构与核心逻辑

### 1.1 牌定义

```javascript
const TILES = {
  // 万子 1-9 (characters): wan1-wan9
  // 索子 1-9 (bamboos): sou1-sou9  
  // 筒子 1-9 (circles): pin1-pin9
  // 风牌 (winds): east, south, west, north
  // 箭牌 (dragons): red, green, white
}
// 共 34 种牌，每种 4 张 = 136 张
// 牌背 1 张
```

### 1.2 玩家状态

```javascript
class Player {
  id: 0-3           // 0=玩家, 1-3=AI
  hand: []         // 手牌 (13/14张)
  pool: []         // 牌池 (打出的牌)
  melds: []        // 副露 [碰碰/杠子]
Ready: false    is // 是否听牌
  isHu: false      // 是否已胡
  score: 0         // 当前得分
}
```

### 1.3 核心函数清单

| 模块 | 函数 | 功能 |
|------|------|------|
| tile.js | `initTiles()` | 初始化牌堆 |
| tile.js | `shuffle()` | 洗牌 |
| tile.js | `deal()` | 发牌 (每人13张) |
| tile.js | `drawTile(player)` | 摸牌 |
| tile.js | `discardTile(player, tile)` | 打牌 |
| judge.js | `canChow(player, tile)` | 判断能否吃 |
| judge.js | `canPong(player, tile)` | 判断能否碰 |
| judge.js | `canKong(player, tile)` | 判断能否杠 |
| judge.js | `canWin(player, tile)` | 判断能否胡 |
| judge.js | `checkTenpai(hand)` | 听牌检测 |
| judge.js | `checkWin(hand)` | 胡牌判定 (简化版) |
| judge.js | `calcScore(hand, mode)` | 番数计算 |

### 1.4 简化版番型 (MVP)

| 番型 | 番数 | 条件 |
|------|------|------|
| 屁胡 | 1 | 基本胡牌 |
| 碰碰胡 | 2 | 全部为刻子/杠 |
| 混一色 | 3 | 字牌 + 一种花色 |
| 清一色 | 4 | 同一种花色 |
| 七对子 | 4 | 7个对子 |
| 杠上开花 | 2 | 杠后摸牌胡 |
| 海底捞月 | 1 | 摸最后一张胡 |

---

## Phase 2: AI 逻辑

### 2.1 AI 决策优先级

```
回合开始 (手牌14张)
  │
  ├─ [最高] 检查自摸 ← 胡
  ├─ [高] 检查杠    ← 杠 (可暗杠/加杠)
  ├─ [中] 检查胡    ← 抢杠胡/点炮
  ├─ [中] 检查碰    ← 碰 (评估是否有利)
  └─ [基础] 打牌
        ├─ 初期: 拆搭子/弃孤张
        └─ 中后期: 防御 (避免放铳)
```

### 2.2 难度: 中等

评估函数权重:
- 听牌速度 (最重要)
- 番数潜力
- 防御指数 (牌池危险度)
- AI 间配合 (避免给下家喂牌)

---

## Phase 3: UI/UX

### 3.1 布局

```
┌──────────────────────────────────────────┐
│  电脑C [ID:2]          电脑B [ID:1]      │
│   牌山: xx              牌山: xx          │
├────────────────┬─────────────────────────┤
│                │                         │
│  电脑D [ID:3]  │      牌池区域           │
│   牌山: xx     │  (4家打出的牌矩阵)     │
│                │                         │
├────────────────┼─────────────────────────┤
│  副露区        │  玩家 [ID:0]            │
│  [碰][杠]      │  [🀐][🀑][🀒]...[🀨]    │
│                │   [吃] [碰] [杠] [胡]   │
└────────────────┴─────────────────────────┘
        牌山余量: xx | 庄家: 玩家
```

### 3.2 交互

- **点击手牌**: 选中 (高亮) → 再次点击/按确认 → 打牌
- **操作按钮**: 碰/杠/胡 (有牌可碰时亮起)
- **吃牌选择**: 弹出组合让玩家选

### 3.3 古典风格 CSS

```css
:root {
  --bg-color: #1a1a2e;        /* 深蓝黑 */
  --table-color: #2d4a3e;      /* 墨绿 */
  --border-color: #8b4513;     /* 棕色木框 */
  --accent-gold: #d4af37;      /* 金色 */
  --accent-red: #c41e3a;       /* 中国红 */
  --text-color: #f5e6d3;       /* 浅米色 */
}

/* 牌 */
.tile {
  width: 50px;
  height: 70px;
  background: linear-gradient(145deg, #fff8e7, #e8dcc8);
  border-radius: 4px;
  box-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

/* 背景纹理 */
body {
  background: 
    radial-gradient(ellipse at center, var(--table-color) 0%, #1a2a1e 100%);
}
```

### 3.4 资源

- **牌面**: 使用开源 Mahjong Tangram 或类似资源
- **音效**: Web Audio API 合成

---

## Phase 4: 音效

### 4.1 合成方案

使用 Web Audio API 生成:
- 摸牌: 短促"嗒"声
- 打牌: 较轻"啪"声
- 碰: 两声短促
- 杠: 三声 (或低沉"杠"音)
- 胡: 上升音阶/和弦

---

## 里程碑

| 阶段 | 目标 | 输出 |
|------|------|------|
| M1 | 核心逻辑跑通 | game.js, tile.js, judge.js |
| M2 | 加入AI对战 | ai.js |
| M3 | UI完成 | index.html, style.css |
| M4 | 音效+打磨 | sound.js |

---

## 待完成

- [ ] 牌面图片资源获取
- [ ] 音效素材/合成代码
- [ ] 完整测试

---

*最后更新: 2026-02-22*
