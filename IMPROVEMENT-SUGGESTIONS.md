# 麻将游戏架构改进建议

本文档整理了当前项目比另一个项目更优秀的设计模式，包含代码示例，供改进参考。

---

## 1. 模块分离架构

### 问题

另一个项目将游戏循环、AI逻辑、UI渲染全部放在 `game.js` 一个文件中（约1500行），职责混乱，难以维护。

### 改进方案

采用清晰的模块分离：

```
js/
├── mahjong.js  → 核心数据结构（Tile, TileSet, Hand）
├── game.js     → 游戏逻辑引擎（MahjongGame）
├── ai.js       → AI决策（MahjongAI）
└── ui.js       → UI渲染（MahjongUI）
```

### 代码示例

```javascript
// ai.js - 独立的AI模块
class MahjongAI {
    constructor(playerIndex) {
        this.playerIndex = playerIndex;
    }

    // AI出牌决策
    decideDiscard(hand) {
        const tiles = hand.getTiles();
        // ... 决策逻辑
        return selectedTile;
    }

    // AI碰牌决策
    decidePeng(hand, discardedTile) {
        return hand.canPeng(discardedTile.suit, discardedTile.value);
    }

    // AI杠牌决策
    decideGang(hand, discardedTile) {
        return hand.canMingGang(discardedTile.suit, discardedTile.value);
    }
}
```

```javascript
// ui.js - 独立的UI模块
class MahjongUI {
    constructor() {
        this.gameContainer = document.querySelector('.game-container');
        this.playerHandElement = document.getElementById('player-hand');
        // ... 初始化DOM引用
    }

    renderPlayerHand(hand) { /* ... */ }
    renderAIHands(aiHands) { /* ... */ }
    playSound(soundType) { /* ... */ }
    showGameOver(message) { /* ... */ }
}
```

**优点**：
- 单一职责原则
- 便于单元测试
- 易于扩展和维护

---

## 2. Hand 类封装

### 问题

另一个项目使用简单对象存储玩家状态：

```javascript
// 另一个项目的做法
Player: {
    id: number,
    hand: Tile[],
    pool: Tile[],
    melds: Meld[],
    isTenpai: boolean,
    isHu: boolean
}
```

缺乏方法封装，操作逻辑散落在各处。

### 改进方案

使用 `Hand` 类封装手牌操作：

```javascript
class Hand {
    constructor() {
        this.tiles = new TileSet();
        this.exposed = []; // 已碰/杠的牌组
    }

    // 摸牌
    drawTile(tile) {
        this.tiles.addTile(tile);
    }

    // 打牌
    discardTile(suit, value) {
        return this.tiles.removeTile(suit, value);
    }

    // 碰牌 - 封装了完整逻辑
    pengTile(suit, value) {
        if (this.tiles.countTile(suit, value) >= 2) {
            const pengSet = new TileSet();
            pengSet.addTile(new Tile(suit, value));
            pengSet.addTile(new Tile(suit, value));
            pengSet.addTile(new Tile(suit, value));

            this.exposed.push({
                type: 'peng',
                tiles: pengSet.getAllTiles()
            });

            // 移除两张牌
            this.tiles.removeTile(suit, value);
            this.tiles.removeTile(suit, value);

            return true;
        }
        return false;
    }

    // 杠牌 - 支持明杠和暗杠
    gangTile(suit, value) {
        // 暗杠：手中有四张相同的牌
        if (this.tiles.countTile(suit, value) >= 4) {
            const gangSet = new TileSet();
            for (let i = 0; i < 4; i++) {
                gangSet.addTile(new Tile(suit, value));
                this.tiles.removeTile(suit, value);
            }
            this.exposed.push({
                type: 'angang',
                tiles: gangSet.getAllTiles()
            });
            return true;
        }

        // 明杠：已碰过再摸到一张
        const pengIndex = this.exposed.findIndex(group =>
            group.type === 'peng' &&
            group.tiles[0].suit === suit &&
            group.tiles[0].value === value
        );

        if (pengIndex !== -1) {
            this.exposed[pengIndex].type = 'minggang';
            this.exposed[pengIndex].tiles.push(new Tile(suit, value));
            this.tiles.removeTile(suit, value);
            return true;
        }

        return false;
    }

    // 检查是否可以碰
    canPeng(suit, value) {
        return this.tiles.countTile(suit, value) >= 2;
    }

    // 检查是否可以明杠
    canMingGang(suit, value) {
        return this.tiles.countTile(suit, value) >= 3;
    }

    // 检查是否可以暗杠
    canAnGang(suit, value) {
        return this.tiles.countTile(suit, value) >= 4;
    }

    // 检查是否胡牌
    canWin() {
        const tiles = this.tiles.getAllTiles();
        return checkWinSimple(tiles);
    }

    getTiles() { return this.tiles.getAllTiles(); }
    getExposed() { return [...this.exposed]; }
    getCount() { return this.tiles.getCount(); }
    sortTiles() { this.tiles.sort(); }
}
```

**优点**：
- 操作逻辑内聚
- 防止外部直接修改数据
- 代码复用性高

---

## 3. pendingActions 队列机制

### 问题

多人同时可操作时（如多人都能碰/胡），需要优先级处理。另一个项目缺少明确的机制。

### 改进方案

使用 `pendingActions` 队列管理等待响应的操作：

```javascript
class MahjongGame {
    constructor() {
        this.pendingActions = []; // 等待响应的操作队列
        // ...
    }

    // 检查其他玩家是否可以碰、杠、胡
    checkOtherPlayersActions(playerIndex, discardedTile) {
        this.pendingActions = [];

        // 按优先级检查：胡 > 杠 > 碰
        const winActions = this.checkWin(playerIndex, discardedTile);
        this.pendingActions.push(...winActions);

        const gangActions = this.checkGang(playerIndex, discardedTile);
        this.pendingActions.push(...gangActions);

        const pengActions = this.checkPeng(playerIndex, discardedTile);
        this.pendingActions.push(...pengActions);

        return this.pendingActions;
    }

    // 检查胡牌
    checkWin(playerIndex, discardedTile) {
        const results = [];
        for (let i = 0; i < 4; i++) {
            if (i !== playerIndex) {
                // 临时添加打出的牌检查是否能胡
                this.players[i].drawTile(discardedTile);
                if (this.players[i].canWin()) {
                    results.push({
                        playerIndex: i,
                        action: 'hu',
                        tile: discardedTile
                    });
                }
                this.players[i].discardTile(discardedTile.suit, discardedTile.value);
            }
        }
        return results;
    }

    // 处理等待的操作
    handlePendingAction(action, playerIndex, tile) {
        switch (action) {
            case 'peng':
                return this.pengTile(playerIndex, tile.suit, tile.value);
            case 'gang':
                return this.gangTile(playerIndex, tile.suit, tile.value);
            case 'hu':
            case 'zimo':
                this.endGame();
                return true;
            default:
                return false;
        }
    }

    getPendingActions() { return [...this.pendingActions]; }
    clearPendingActions() { this.pendingActions = []; }
}
```

**UI层处理示例**：

```javascript
// 处理等待操作时的UI响应
function handlePendingActionsUI() {
    const actions = game.getPendingActions();

    if (actions.length === 0) {
        // 无操作，轮换到下一玩家
        game.nextPlayer();
        return;
    }

    // 提取玩家可执行的操作
    const playerActions = actions.filter(a => a.playerIndex === 0);

    if (playerActions.length > 0) {
        // 显示操作按钮
        const actionTypes = playerActions.map(a => a.action);
        ui.enableActions(actionTypes);
    } else {
        // 玩家无操作，让AI处理
        for (let i = 1; i < 4; i++) {
            aiPlayers[i].handlePendingActions(game);
        }
    }
}
```

**优点**：
- 清晰的操作优先级
- 支持多人同时可操作的复杂场景
- 解耦游戏逻辑与UI响应

---

## 4. TileSet 工具类

### 问题

直接操作数组 `Tile[]` 缺少便利方法，代码重复。

### 改进方案

封装 `TileSet` 类提供丰富的操作方法：

```javascript
class TileSet {
    constructor() {
        this.tiles = [];
    }

    addTile(tile) {
        this.tiles.push(tile.clone());
    }

    addTiles(tiles) {
        tiles.forEach(tile => this.addTile(tile));
    }

    removeTile(suit, value) {
        const index = this.tiles.findIndex(
            tile => tile.suit === suit && tile.value === value
        );
        if (index !== -1) {
            return this.tiles.splice(index, 1)[0];
        }
        return null;
    }

    hasTile(suit, value) {
        return this.tiles.some(tile => tile.suit === suit && tile.value === value);
    }

    countTile(suit, value) {
        return this.tiles.filter(
            tile => tile.suit === suit && tile.value === value
        ).length;
    }

    getAllTiles() { return [...this.tiles]; }
    getCount() { return this.tiles.length; }

    // Fisher-Yates 洗牌
    shuffle() {
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
    }

    // 按花色和数值排序
    sort() {
        this.tiles.sort((a, b) => {
            if (a.suit !== b.suit) {
                return a.suit.localeCompare(b.suit);
            }
            return a.value - b.value;
        });
    }

    clear() { this.tiles = []; }

    clone() {
        const newSet = new TileSet();
        this.tiles.forEach(tile => newSet.addTile(tile));
        return newSet;
    }
}
```

**使用示例**：

```javascript
// 统计某张牌的数量
const wan5Count = hand.tiles.countTile('万', 5);

// 检查是否有某张牌
if (hand.tiles.hasTile('条', 7)) {
    // ...
}

// 洗牌和排序
tileSet.shuffle();
hand.sortTiles();
```

---

## 5. Tile 类封装

### 改进方案

```javascript
class Tile {
    constructor(suit, value) {
        this.suit = suit;  // 花色: '万', '条', '筒'
        this.value = value; // 数值: 1-9
    }

    // 获取牌的唯一标识
    getId() {
        return `${this.suit}${this.value}`;  // 如: '万5'
    }

    // 获取牌的显示名称
    getName() {
        return `${this.value}${this.suit}`;  // 如: '5万'
    }

    // 获取牌的图片文件名
    getImageName() {
        const suitMap = { '万': 'Man', '条': 'Sou', '筒': 'Pin' };
        return `${suitMap[this.suit]}${this.value}.png`;
    }

    clone() {
        return new Tile(this.suit, this.value);
    }
}
```

**优点**：
- 统一的ID生成规则
- 支持多种显示格式
- 便于图片资源管理

---

## 6. 递归式胡牌检测

### 改进方案

使用递归回溯检测胡牌，代码更清晰：

```javascript
function checkWinSimple(tiles) {
    if (tiles.length !== 14 && tiles.length !== 13) {
        return false;
    }

    // 统计每张牌的数量
    const tileCounts = {};
    tiles.forEach(tile => {
        const id = tile.getId();
        tileCounts[id] = (tileCounts[id] || 0) + 1;
    });

    // 寻找对子作为将牌
    for (let i = 0; i < Object.keys(tileCounts).length; i++) {
        const [id, count] = Object.entries(tileCounts)[i];
        if (count >= 2) {
            const testCounts = {...tileCounts};
            testCounts[id] -= 2;

            if (checkMelds(testCounts)) {
                return true;
            }
        }
    }

    return false;
}

// 递归检查是否能组成面子
function checkMelds(counts) {
    // 移除数量为0的牌
    const nonZeroCounts = {};
    Object.entries(counts).forEach(([id, count]) => {
        if (count > 0) {
            nonZeroCounts[id] = count;
        }
    });

    // 没有牌了，说明匹配成功
    if (Object.keys(nonZeroCounts).length === 0) {
        return true;
    }

    const [firstId, firstCount] = Object.entries(nonZeroCounts)[0];
    const suit = firstId.charAt(0);
    const value = parseInt(firstId.slice(1));

    // 尝试组成刻子
    if (firstCount >= 3) {
        const testCounts = {...nonZeroCounts};
        testCounts[firstId] -= 3;
        if (testCounts[firstId] === 0) delete testCounts[firstId];

        if (checkMelds(testCounts)) return true;
    }

    // 尝试组成顺子
    if (['万', '条', '筒'].includes(suit) && value <= 7) {
        const next1Id = `${suit}${value + 1}`;
        const next2Id = `${suit}${value + 2}`;

        if (nonZeroCounts[next1Id] && nonZeroCounts[next2Id]) {
            const testCounts = {...nonZeroCounts};
            testCounts[firstId] -= 1;
            testCounts[next1Id] -= 1;
            testCounts[next2Id] -= 1;

            if (testCounts[firstId] === 0) delete testCounts[firstId];
            if (testCounts[next1Id] === 0) delete testCounts[next1Id];
            if (testCounts[next2Id] === 0) delete testCounts[next2Id];

            if (checkMelds(testCounts)) return true;
        }
    }

    return false;
}
```

---

## 总结对比

| 方面 | 另一个项目 | 当前项目改进 |
|------|-----------|-------------|
| 模块分离 | 单文件1500行 | 4个独立模块 |
| 手牌管理 | 简单对象 | Hand类封装 |
| 操作队列 | 无 | pendingActions机制 |
| 牌组操作 | 数组直接操作 | TileSet工具类 |
| 胡牌检测 | 未知实现 | 递归回溯法 |

建议优先采纳：
1. **Hand类封装** - 核心数据结构改进
2. **pendingActions机制** - 解决多人同时操作的复杂场景
3. **模块分离** - 提高代码可维护性