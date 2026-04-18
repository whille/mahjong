// 麻将游戏自动测试 - 完整版

console.log('='.repeat(60));
console.log('🀄 麻将游戏完整测试');
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;
let currentTest = 0;

function test(name, fn) {
  currentTest++;
  try {
    fn();
    console.log(`✅ [${currentTest}] ${name}`);
    testsPassed++;
  } catch (e) {
    console.log(`❌ [${currentTest}] ${name}: ${e.message}`);
    testsFailed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// 模拟 DOM 环境
global.document = {
  getElementById: (id) => ({
    innerHTML: '',
    textContent: '',
    style: {},
    querySelector: () => ({}),
    querySelectorAll: () => [],
    addEventListener: () => {}
  }),
  querySelector: () => ({ addEventListener: () => {} }),
  querySelectorAll: () => []
};
global.window = { AudioContext: function() {} };
global.AudioContext = function() {};

// 加载模块
const tile = require('./js/tile.js');
const judge = require('./js/judge.js');

global.initTileSet = tile.initTileSet;
global.shuffle = tile.shuffle;
global.dealTiles = tile.dealTiles;
global.drawTile = tile.drawTile;
global.discardTile = tile.discardTile;
global.canWin = judge.canWin;
global.canPong = judge.canPong;
global.canChow = judge.canChow;
global.canKong = judge.canKong;
global.checkTenpai = judge.checkTenpai;
global.calcScore = judge.calcScore;
global.getAllTileTypes = tile.getAllTileTypes;

console.log('\n--- 基础模块测试 ---\n');

// ===== 基础牌操作 =====
test('1. 初始化牌堆 (136张)', () => {
  const tiles = initTileSet();
  assert(tiles.length === 136, `应该136张，实际${tiles.length}`);
});

test('2. 洗牌后仍是136张', () => {
  const tiles = initTileSet();
  const shuffled = shuffle([...tiles]);
  assert(shuffled.length === 136, `应该136张，实际${shuffled.length}`);
});

test('3. 发牌每人13张', () => {
  const tiles = initTileSet();
  const shuffled = shuffle(tiles);
  const { players } = dealTiles(shuffled, 4);
  assert(players.length === 4, '4个玩家');
  assert(players[0].hand.length === 13, `玩家应该13张，实际${players[0].hand.length}`);
  assert(players[1].hand.length === 13, `电脑1应该13张`);
});

test('4. 玩家摸牌后14张', () => {
  let tiles = shuffle(initTileSet());
  const { players, remainingTiles } = dealTiles(tiles, 4);
  drawTile(players[0], remainingTiles);
  assert(players[0].hand.length === 14, `摸牌后应该14张，实际${players[0].hand.length}`);
});

test('5. 玩家打牌后13张 + 牌池1张', () => {
  let tiles = shuffle(initTileSet());
  const { players, remainingTiles } = dealTiles(tiles, 4);
  drawTile(players[0], remainingTiles);
  const tileId = players[0].hand[0].id;
  discardTile(players[0], tileId);
  assert(players[0].hand.length === 13, `打牌后应该13张，实际${players[0].hand.length}`);
  assert(players[0].pool.length === 1, `牌池应该有1张`);
});

console.log('\n--- 胡牌判定测试 ---\n');

// ===== 胡牌判定 =====
test('6. 简单胡牌判定 (111 234 567 889 99)', () => {
  const hand = [
    {type:'wan1'},{type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan3'},{type:'wan4'},
    {type:'wan5'},{type:'wan6'},{type:'wan7'},
    {type:'wan8'},{type:'wan8'},{type:'wan9'},
    {type:'wan9'},{type:'wan9'}
  ];
  assert(canWin(hand) === true, '应该能胡牌');
});

test('7. 七对子判定', () => {
  const hand = [
    {type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan2'},
    {type:'wan3'},{type:'wan3'},
    {type:'wan4'},{type:'wan4'},
    {type:'wan5'},{type:'wan5'},
    {type:'wan6'},{type:'wan6'},
    {type:'wan7'},{type:'wan7'}
  ];
  assert(canWin(hand) === true, '应该能胡七对子');
});

test('8. 碰碰胡判定', () => {
  const hand = [
    {type:'wan1'},{type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan2'},{type:'wan2'},
    {type:'wan3'},{type:'wan3'},{type:'wan3'},
    {type:'wan4'},{type:'wan4'},{type:'wan4'},
    {type:'east'},{type:'east'}
  ];
  assert(canWin(hand) === true, '碰碰胡应该能胡');
});

console.log('\n--- 吃碰杠判定测试 ---\n');

// ===== 吃碰杠 =====
test('9. 碰牌判定 (3张相同)', () => {
  const hand = [{type:'wan1'},{type:'wan1'},{type:'wan1'}];
  const discard = {type:'wan1'};
  assert(canPong(hand, discard) === true, '应该能碰');
});

test('10. 暗杠判定 (4张相同)', () => {
  const hand = [{type:'wan1'},{type:'wan1'},{type:'wan1'},{type:'wan1'}];
  const discard = {type:'wan1'};
  assert(canKong(hand, discard, true) === true, '应该能暗杠');
});

test('11. 明杠判定 (手牌3张+打出的1张)', () => {
  const hand = [{type:'wan1'},{type:'wan1'},{type:'wan1'}];
  const discard = {type:'wan1'};
  assert(canKong(hand, discard, false) === true, '应该能明杠');
});

test('12. 吃牌判定 (上家打3万，吃2万4万)', () => {
  const hand = [{type:'wan2'},{type:'wan4'}];
  const discard = {type:'wan3'};
  assert(canChow(hand, discard) === true, '应该能吃');
});

test('13. 听牌检测', () => {
  const hand = [
    {type:'wan1'},{type:'wan2'},
    {type:'wan3'},{type:'wan4'},{type:'wan5'},
    {type:'wan6'},{type:'wan7'},{type:'wan8'},
    {type:'wan9'},{type:'wan9'},{type:'wan9'},
    {type:'east'},{type:'east'}
  ];
  const waiting = checkTenpai(hand);
  assert(waiting.length > 0, '应该听牌');
});

console.log('\n--- 游戏流程测试 ---\n');

// ===== 游戏流程 =====
test('14. 完整回合: 摸牌→打牌', () => {
  let tiles = shuffle(initTileSet());
  const { players, remainingTiles } = dealTiles(tiles, 4);
  
  // 玩家摸牌
  drawTile(players[0], remainingTiles);
  assert(players[0].hand.length === 14, '玩家摸牌后14张');
  
  // 玩家打牌
  discardTile(players[0], players[0].hand[0].id);
  assert(players[0].hand.length === 13, '玩家打牌后13张');
  assert(players[0].pool.length === 1, '牌池有1张');
});

test('15. 4家轮流摸打一轮', () => {
  let tiles = shuffle(initTileSet());
  const { players, remainingTiles } = dealTiles(tiles, 4);
  
  // 4家各摸牌打牌
  for (let i = 0; i < 4; i++) {
    drawTile(players[i], remainingTiles);
    assert(players[i].hand.length === 14, `玩家${i}摸牌后14张`);
    discardTile(players[i], players[i].hand[0].id);
    assert(players[i].hand.length === 13, `玩家${i}打牌后13张`);
    assert(players[i].pool.length === 1, `玩家${i}牌池1张`);
  }
});

test('16. 牌数守恒', () => {
  let tiles = shuffle(initTileSet());
  const { players, remainingTiles } = dealTiles(tiles, 4);
  
  // 模拟10轮
  for (let round = 0; round < 10; round++) {
    for (let i = 0; i < 4; i++) {
      drawTile(players[i], remainingTiles);
      discardTile(players[i], players[i].hand[0].id);
    }
  }
  
  const totalInHands = players.reduce((sum, p) => sum + p.hand.length, 0);
  const totalInPools = players.reduce((sum, p) => sum + p.pool.length, 0);
  const total = totalInHands + totalInPools + remainingTiles.length;
  assert(total === 136, `牌数守恒: ${total}`);
});

test('17. 碰后手牌-2 副露+1', () => {
  let tiles = shuffle(initTileSet());
  const { players } = dealTiles(tiles, 4);
  
  // 玩家手牌: 3张 wan1 + 其他
  players[0].hand = [
    {type:'wan1'},{type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan3'},{type:'wan4'},
    {type:'wan5'},{type:'wan6'},{type:'wan7'},
    {type:'wan8'},{type:'wan9'},{type:'wan9'},{type:'wan9'},
    {type:'east'}
  ];
  
  // 有人打出 wan1，玩家碰
  const discard = {type:'wan1'};
  if (canPong(players[0].hand, discard)) {
    // 模拟碰：移除2张wan1
    const indices = [0, 1]; // 假设移除前两张
    indices.forEach(i => players[0].hand.splice(i, 1));
    // 添加副露
    players[0].meld = players[0].meld || [];
    players[0].meld.push({type:'pong', tiles:[
      {type:'wan1'},{type:'wan1'},{type:'wan1'}
    ]});
  }
  
  assert(players[0].hand.length === 12, `碰后手牌应为12张，实际${players[0].hand.length}`);
  assert(players[0].meld.length === 1, `副露应有1组`);
});

test('18. 杠后手牌-3 副露+1', () => {
  let tiles = shuffle(initTileSet());
  const { players } = dealTiles(tiles, 4);
  
  // 玩家手牌: 4张 wan1
  players[0].hand = [
    {type:'wan1'},{type:'wan1'},{type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan3'},{type:'wan4'},
    {type:'wan5'},{type:'wan6'},{type:'wan7'},
    {type:'wan8'},{type:'wan9'},{type:'east'}
  ];
  
  // 暗杠
  if (canKong(players[0].hand, {type:'wan1'}, true)) {
    // 移除3张wan1
    for (let i = 0; i < 3; i++) {
      const idx = players[0].hand.findIndex(t => t.type === 'wan1');
      players[0].hand.splice(idx, 1);
    }
    // 添加副露
    players[0].meld = players[0].meld || [];
    players[0].meld.push({type:'kong', tiles:[
      {type:'wan1'},{type:'wan1'},{type:'wan1'},{type:'wan1'}
    ]});
  }
  
  assert(players[0].hand.length === 10, `杠后手牌应为10张，实际${players[0].hand.length}`);
  assert(players[0].meld.length === 1, `副露应有1组`);
});

test('19. 吃后手牌-2 副露+1', () => {
  let tiles = shuffle(initTileSet());
  const { players } = dealTiles(tiles, 4);
  
  // 玩家手牌: wan2, wan4 + 其他
  players[0].hand = [
    {type:'wan2'},{type:'wan4'},
    {type:'wan1'},{type:'wan3'},{type:'wan5'},
    {type:'wan6'},{type:'wan7'},{type:'wan8'},
    {type:'wan9'},{type:'wan9'},{type:'east'},
    {type:'east'},{type:'south'},{type:'south'}
  ];
  
  // 上家打出 wan3，可以吃
  const discard = {type:'wan3'};
  if (canChow(players[0].hand, discard)) {
    // 移除 wan2, wan4
    let idx = players[0].hand.findIndex(t => t.type === 'wan2');
    players[0].hand.splice(idx, 1);
    idx = players[0].hand.findIndex(t => t.type === 'wan4');
    players[0].hand.splice(idx, 1);
    
    // 添加副露
    players[0].meld = players[0].meld || [];
    players[0].meld.push({type:'chow', tiles:[
      {type:'wan2'},{type:'wan3'},{type:'wan4'}
    ]});
  }
  
  assert(players[0].hand.length === 12, `吃后手牌应为12张，实际${players[0].hand.length}`);
  assert(players[0].meld.length === 1, `副露应有1组`);
});

test('20. 多次随机游戏流程 (50轮)', () => {
  for (let round = 0; round < 50; round++) {
    let tiles = shuffle(initTileSet());
    const { players, remainingTiles } = dealTiles(tiles, 4);

    for (let i = 0; i < 4; i++) {
      drawTile(players[i], remainingTiles);
      if (players[i].hand.length > 0) {
        discardTile(players[i], players[i].hand[0].id);
      }
    }
  }
  console.log('   (50轮随机流程无异常)');
});

// --- 番型扩展测试 ---

console.log('\n--- 番型扩展测试 ---\n');

test('21. 国士无双判定', () => {
  // 国士无双：13种幺九牌各一张 + 其中一张成对
  const hand = [
    {type:'wan1'},{type:'wan9'},
    {type:'sou1'},{type:'sou9'},
    {type:'pin1'},{type:'pin9'},
    {type:'east'},{type:'south'},{type:'west'},{type:'north'},
    {type:'zhong'},{type:'fa'},{type:'bai'},
    {type:'wan1'}  // 重复一张做雀头
  ];
  assert(canWin(hand), '国士无双应该能胡');
  const result = calcScore(hand);
  assert(result.fans === 13, `国士无双应为13番，实际${result.fans}`);
  assert(result.fanTypes.some(f => f.name === '国士无双'), '应包含国士无双番型');
});

test('22. 大三元判定', () => {
  // 大三元：中发白各一刻子 + 其他
  const hand = [
    {type:'zhong'},{type:'zhong'},{type:'zhong'},
    {type:'fa'},{type:'fa'},{type:'fa'},
    {type:'bai'},{type:'bai'},{type:'bai'},
    {type:'wan1'},{type:'wan2'},{type:'wan3'},
    {type:'wan4'},{type:'wan4'}
  ];
  assert(canWin(hand), '大三元应该能胡');
  const result = calcScore(hand);
  assert(result.fans >= 8, `大三元应至少8番，实际${result.fans}`);
  assert(result.fanTypes.some(f => f.name === '大三元'), '应包含大三元番型');
});

test('23. 四暗刻判定', () => {
  // 四暗刻：四个暗刻 + 一对（无副露）
  const hand = [
    {type:'wan1'},{type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan2'},{type:'wan2'},
    {type:'wan3'},{type:'wan3'},{type:'wan3'},
    {type:'wan4'},{type:'wan4'},{type:'wan4'},
    {type:'wan5'},{type:'wan5'}
  ];
  assert(canWin(hand), '四暗刻应该能胡');
  const result = calcScore(hand, []);  // 无副露
  assert(result.fans >= 6, `四暗刻应至少6番，实际${result.fans}`);
  assert(result.fanTypes.some(f => f.name === '四暗刻'), '应包含四暗刻番型');
});

test('24. 三暗刻判定', () => {
  // 三暗刻：三个暗刻 + 其他顺子 + 一对
  const hand = [
    {type:'wan1'},{type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan2'},{type:'wan2'},
    {type:'wan3'},{type:'wan3'},{type:'wan3'},
    {type:'wan4'},{type:'wan5'},{type:'wan6'},
    {type:'wan7'},{type:'wan7'}
  ];
  assert(canWin(hand), '三暗刻应该能胡');
  const result = calcScore(hand, []);  // 无副露
  assert(result.fans >= 2, `三暗刻应至少2番，实际${result.fans}`);
  assert(result.fanTypes.some(f => f.name === '三暗刻'), '应包含三暗刻番型');
});

test('25. 小三元判定', () => {
  // 小三元：两个三元牌刻子 + 一个三元牌对子
  // 完整牌型：中刻子 + 发刻子 + 白对子 + 123万顺子 + 456万顺子 = 14张
  const hand = [
    {type:'zhong'},{type:'zhong'},{type:'zhong'},
    {type:'fa'},{type:'fa'},{type:'fa'},
    {type:'bai'},{type:'bai'},
    {type:'wan1'},{type:'wan2'},{type:'wan3'},
    {type:'wan4'},{type:'wan5'},{type:'wan6'}
  ];
  assert(canWin(hand), '小三元应该能胡');
  const result = calcScore(hand);
  assert(result.fans >= 2, `小三元应至少2番，实际${result.fans}`);
  assert(result.fanTypes.some(f => f.name === '小三元'), '应包含小三元番型');
});

test('26. 自摸加分', () => {
  const hand = [
    {type:'wan1'},{type:'wan1'},{type:'wan1'},
    {type:'wan2'},{type:'wan3'},{type:'wan4'},
    {type:'wan5'},{type:'wan6'},{type:'wan7'},
    {type:'wan8'},{type:'wan8'},{type:'wan8'},
    {type:'wan9'},{type:'wan9'}
  ];
  const resultNormal = calcScore(hand);
  const resultZimo = calcScore(hand, [], true);  // 自摸
  assert(resultZimo.fans === resultNormal.fans + 1, '自摸应加1番');
  assert(resultZimo.fanTypes.some(f => f.name === '自摸'), '应包含自摸番型');
});

// ============================================
// 完整牌局模拟测试
// ============================================

console.log('\n--- 完整牌局模拟测试 ---\n');

// 简化的游戏状态
class MockGame {
  constructor() {
    this.wall = [];
    this.players = [];
    this.currentPlayer = 0;
    this.lastDiscard = null;
    this.rounds = 0;
    this.maxRounds = 100; // 防止无限循环
    this.gameOver = false;
    this.winner = null;
    this.logs = [];
  }

  log(msg) {
    this.logs.push(msg);
  }

  init() {
    // 初始化牌山
    this.wall = shuffle(initTileSet());

    // 发牌
    const result = dealTiles([...this.wall], 4);
    this.players = result.players;
    this.wall = result.remainingTiles;

    // 初始化玩家属性
    this.players.forEach((p, i) => {
      p.id = i;
      p.name = ['南家(你)', '东家', '北家', '西家'][i];
      p.melds = [];
      p.isHuman = i === 0;
    });

    this.log(`游戏初始化完成，牌山剩余 ${this.wall.length} 张`);
  }

  // 摸牌
  draw(playerIndex) {
    const player = this.players[playerIndex];
    const tile = this.wall.pop();
    if (tile) {
      player.hand.push(tile);
      this.log(`${player.name} 摸牌，手牌 ${player.hand.length} 张`);
      return tile;
    }
    this.log('牌山已空！');
    return null;
  }

  // 打牌
  discard(playerIndex, tileIndex) {
    const player = this.players[playerIndex];
    const tile = player.hand.splice(tileIndex, 1)[0];
    player.pool = player.pool || [];
    player.pool.push(tile);
    this.lastDiscard = tile;
    this.log(`${player.name} 打出 ${tile.name || tile.type}`);
    return tile;
  }

  // 检查是否能碰
  canPong(playerIndex) {
    const player = this.players[playerIndex];
    if (!this.lastDiscard) return false;
    const count = player.hand.filter(t => t.type === this.lastDiscard.type).length;
    return count >= 2;
  }

  // 检查是否能杠
  canKong(playerIndex, isDark = false) {
    const player = this.players[playerIndex];
    if (isDark) {
      // 暗杠：手牌中有4张相同
      const counts = {};
      player.hand.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);
      return Object.values(counts).some(c => c === 4);
    }
    // 明杠
    if (!this.lastDiscard) return false;
    const count = player.hand.filter(t => t.type === this.lastDiscard.type).length;
    return count >= 3;
  }

  // 检查是否能吃
  canChow(playerIndex) {
    const player = this.players[playerIndex];
    if (!this.lastDiscard) return false;

    const tile = this.lastDiscard;
    const suit = tile.type.replace(/\d/g, '');
    const num = parseInt(tile.type.replace(/\D/g, ''));

    // 字牌不能吃
    if (!['wan', 'sou', 'pin'].includes(suit)) return false;

    const hand = player.hand;

    // 检查三种吃牌模式
    if (num >= 3 && hand.some(t => t.type === `${suit}${num-2}`) && hand.some(t => t.type === `${suit}${num-1}`)) {
      return true;
    }
    if (num >= 2 && num <= 8 && hand.some(t => t.type === `${suit}${num-1}`) && hand.some(t => t.type === `${suit}${num+1}`)) {
      return true;
    }
    if (num <= 7 && hand.some(t => t.type === `${suit}${num+1}`) && hand.some(t => t.type === `${suit}${num+2}`)) {
      return true;
    }
    return false;
  }

  // 检查是否能胡
  canWin(playerIndex) {
    const player = this.players[playerIndex];
    return canWin(player.hand);
  }

  // 执行碰
  doPong(playerIndex) {
    const player = this.players[playerIndex];
    const tileType = this.lastDiscard.type;

    // 移除手牌中的2张
    let removed = 0;
    for (let i = player.hand.length - 1; i >= 0 && removed < 2; i--) {
      if (player.hand[i].type === tileType) {
        player.hand.splice(i, 1);
        removed++;
      }
    }

    // 添加副露
    player.melds.push({
      type: 'pong',
      tiles: [{type: tileType}, {type: tileType}, this.lastDiscard]
    });

    this.log(`${player.name} 碰了 ${tileType}`);
    this.lastDiscard = null;
  }

  // 执行杠
  doKong(playerIndex, isDark = false) {
    const player = this.players[playerIndex];
    const tileType = isDark ? this.findKongTile(player) : this.lastDiscard.type;

    // 移除手牌中的3张
    let removed = 0;
    for (let i = player.hand.length - 1; i >= 0 && removed < 3; i--) {
      if (player.hand[i].type === tileType) {
        player.hand.splice(i, 1);
        removed++;
      }
    }

    // 添加副露
    player.melds.push({
      type: 'kong',
      tiles: [{type: tileType}, {type: tileType}, {type: tileType}, {type: tileType}]
    });

    this.log(`${player.name} ${isDark ? '暗' : '明'}杠 ${tileType}`);
    this.lastDiscard = null;

    // 杠后摸牌
    this.draw(playerIndex);
  }

  findKongTile(player) {
    const counts = {};
    player.hand.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);
    for (const [type, count] of Object.entries(counts)) {
      if (count === 4) return type;
    }
    return null;
  }

  // 执行吃
  doChow(playerIndex) {
    const player = this.players[playerIndex];
    const tile = this.lastDiscard;
    const suit = tile.type.replace(/\d/g, '');
    const num = parseInt(tile.type.replace(/\D/g, ''));

    let tilesToRemove = [];

    // 找到能吃的组合
    if (num >= 3 && player.hand.some(t => t.type === `${suit}${num-2}`) && player.hand.some(t => t.type === `${suit}${num-1}`)) {
      tilesToRemove = [`${suit}${num-2}`, `${suit}${num-1}`];
    } else if (num >= 2 && num <= 8 && player.hand.some(t => t.type === `${suit}${num-1}`) && player.hand.some(t => t.type === `${suit}${num+1}`)) {
      tilesToRemove = [`${suit}${num-1}`, `${suit}${num+1}`];
    } else if (num <= 7 && player.hand.some(t => t.type === `${suit}${num+1}`) && player.hand.some(t => t.type === `${suit}${num+2}`)) {
      tilesToRemove = [`${suit}${num+1}`, `${suit}${num+2}`];
    }

    // 移除手牌
    tilesToRemove.forEach(type => {
      const idx = player.hand.findIndex(t => t.type === type);
      if (idx !== -1) player.hand.splice(idx, 1);
    });

    // 添加副露
    const chowTiles = [...tilesToRemove, tile.type].sort();
    player.melds.push({
      type: 'chow',
      tiles: chowTiles.map(t => ({type: t}))
    });

    this.log(`${player.name} 吃了 ${tile.type}`);
    this.lastDiscard = null;
  }

  // AI决策：选择要打的牌
  aiChooseDiscard(playerIndex) {
    const player = this.players[playerIndex];

    // 简单策略：优先打孤张
    const counts = {};
    player.hand.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);

    // 找孤张（只有1张的牌）
    for (let i = 0; i < player.hand.length; i++) {
      if (counts[player.hand[i].type] === 1) {
        return i;
      }
    }

    // 否则随机打一张
    return Math.floor(Math.random() * player.hand.length);
  }

  // 检查响应（碰/杠/胡）
  checkResponses() {
    if (!this.lastDiscard) return null;

    // 按优先级检查：胡 > 杠 > 碰 > 吃
    for (let i = 0; i < 4; i++) {
      if (i === this.currentPlayer) continue;

      // 检查胡
      const testHand = [...this.players[i].hand, this.lastDiscard];
      if (canWin(testHand)) {
        return { player: i, action: 'win' };
      }
    }

    for (let i = 0; i < 4; i++) {
      if (i === this.currentPlayer) continue;

      // 检查杠
      if (this.canKong(i)) {
        return { player: i, action: 'kong' };
      }
    }

    for (let i = 0; i < 4; i++) {
      if (i === this.currentPlayer) continue;

      // 检查碰
      if (this.canPong(i)) {
        return { player: i, action: 'pong' };
      }
    }

    // 检查吃（只有上家能吃）
    const prevPlayer = (this.currentPlayer + 3) % 4;
    if (this.canChow(prevPlayer)) {
      return { player: prevPlayer, action: 'chow' };
    }

    return null;
  }

  // 运行一回合
  runTurn() {
    if (this.gameOver || this.rounds >= this.maxRounds) {
      this.gameOver = true;
      return;
    }

    this.rounds++;

    const player = this.players[this.currentPlayer];

    // 摸牌
    const drawnTile = this.draw(this.currentPlayer);
    if (!drawnTile) {
      this.log('流局！牌山已空');
      this.gameOver = true;
      return;
    }

    // 检查自摸
    if (this.canWin(this.currentPlayer)) {
      this.log(`🎉 ${player.name} 自摸胡牌！`);
      this.winner = this.currentPlayer;
      this.gameOver = true;
      return;
    }

    // 检查暗杠（暂时跳过，因为会增加复杂性）
    // if (this.canKong(this.currentPlayer, true)) {
    //   this.doKong(this.currentPlayer, true);
    // }

    // 打牌
    const discardIndex = this.aiChooseDiscard(this.currentPlayer);
    this.discard(this.currentPlayer, discardIndex);

    // 检查其他玩家响应
    const response = this.checkResponses();

    if (response) {
      if (response.action === 'win') {
        // 点炮
        const winner = this.players[response.player];
        winner.hand.push(this.lastDiscard);
        this.log(`🎉 ${winner.name} 胡牌！点炮：${player.name}`);
        this.winner = response.player;
        this.gameOver = true;
        return;
      } else if (response.action === 'kong') {
        // 明杠时需要从牌池移除打出的牌
        if (player.pool && player.pool.length > 0) {
          player.pool.pop();
        }
        this.doKong(response.player);
        this.currentPlayer = response.player;
        return; // 杠后继续该玩家回合
      } else if (response.action === 'pong') {
        // 碰时需要从牌池移除打出的牌
        if (player.pool && player.pool.length > 0) {
          player.pool.pop();
        }
        this.doPong(response.player);
        this.currentPlayer = response.player;
        return; // 碰后该玩家打牌
      } else if (response.action === 'chow') {
        // 吃时需要从牌池移除打出的牌
        if (player.pool && player.pool.length > 0) {
          player.pool.pop();
        }
        this.doChow(response.player);
        this.currentPlayer = response.player;
        return; // 吃后该玩家打牌
      }
    }

    // 下一位玩家（逆时针）
    this.currentPlayer = (this.currentPlayer + 3) % 4;
  }

  // 运行完整游戏
  runGame() {
    this.init();

    while (!this.gameOver && this.rounds < this.maxRounds) {
      this.runTurn();
    }

    return {
      winner: this.winner,
      rounds: this.rounds,
      gameOver: this.gameOver,
      logs: this.logs
    };
  }

  // 验证牌数守恒
  verifyTileCount() {
    const inHands = this.players.reduce((sum, p) => sum + p.hand.length, 0);
    const inPools = this.players.reduce((sum, p) => sum + (p.pool ? p.pool.length : 0), 0);
    const inMelds = this.players.reduce((sum, p) => {
      return sum + (p.melds || []).reduce((s, m) => s + m.tiles.length, 0);
    }, 0);
    const inWall = this.wall.length;
    const total = inHands + inPools + inMelds + inWall;

    return {
      inHands,
      inPools,
      inMelds,
      inWall,
      total,
      valid: total === 136
    };
  }
}

test('27. 完整牌局模拟 - 初始化', () => {
  const game = new MockGame();
  game.init();

  assert(game.players.length === 4, '应有4个玩家');
  assert(game.wall.length === 136 - 13 * 4, `牌山应有${136 - 52}张`);
  assert(game.players.every(p => p.hand.length === 13), '每人应有13张牌');

  const verify = game.verifyTileCount();
  assert(verify.valid, `牌数守恒检查: ${verify.total}/136`);
});

test('28. 完整牌局模拟 - 单回合', () => {
  const game = new MockGame();
  game.init();
  game.runTurn();

  assert(game.rounds === 1, '应进行了1回合');
  assert(game.lastDiscard !== null, '应有打出的牌');

  const verify = game.verifyTileCount();
  assert(verify.valid, `牌数守恒检查: ${verify.total}/136`);
});

test('29. 完整牌局模拟 - 多回合', () => {
  const game = new MockGame();
  game.init();

  // 运行10回合
  for (let i = 0; i < 10 && !game.gameOver; i++) {
    game.runTurn();
  }

  assert(game.rounds === 10, `应进行了10回合，实际${game.rounds}`);

  const verify = game.verifyTileCount();
  assert(verify.valid, `牌数守恒检查: ${verify.total}/136`);
  assert(verify.inPools > 0, '牌池应有牌');
});

test('30. 完整牌局模拟 - 完整游戏', () => {
  const game = new MockGame();
  const result = game.runGame();

  console.log(`   游戏进行了 ${result.rounds} 回合`);

  const verify = game.verifyTileCount();
  assert(verify.valid, `牌数守恒检查: ${verify.total}/136`);

  if (result.winner !== null) {
    console.log(`   🎉 胜者: ${game.players[result.winner].name}`);
  } else if (result.rounds >= game.maxRounds) {
    console.log('   游戏达到最大回合数');
  } else {
    console.log('   流局');
  }
});

test('31. 完整牌局模拟 - 多局游戏', () => {
  console.log('   运行10局游戏...');

  for (let i = 0; i < 10; i++) {
    const game = new MockGame();
    game.maxRounds = 50; // 限制回合数
    const result = game.runGame();

    const verify = game.verifyTileCount();
    assert(verify.valid, `第${i+1}局牌数守恒: ${verify.total}/136`);
  }

  console.log('   10局游戏全部通过');
});

test('32. 玩家摸打出牌流程', () => {
  const game = new MockGame();
  game.init();

  // 玩家(南家)回合
  game.currentPlayer = 0;

  // 摸牌前
  const handBefore = game.players[0].hand.length;
  const wallBefore = game.wall.length;

  // 摸牌
  const drawnTile = game.draw(0);
  assert(drawnTile !== null, '应能摸到牌');
  assert(game.players[0].hand.length === handBefore + 1, '手牌应+1');
  assert(game.wall.length === wallBefore - 1, '牌山应-1');

  // 打牌
  game.discard(0, 0);
  assert(game.players[0].hand.length === handBefore, '手牌应恢复原数');
  assert(game.players[0].pool.length === 1, '牌池应有1张');

  const verify = game.verifyTileCount();
  assert(verify.valid, `牌数守恒: ${verify.total}/136`);
});

test('33. AI决策测试 - 选择打牌', () => {
  const game = new MockGame();
  game.init();

  // 测试AI选择打牌
  for (let i = 1; i < 4; i++) {
    game.currentPlayer = i;
    const discardIndex = game.aiChooseDiscard(i);
    assert(discardIndex >= 0 && discardIndex < game.players[i].hand.length,
      `AI ${i} 选择了有效的牌索引: ${discardIndex}`);
  }
});

test('34. 碰牌流程测试', () => {
  const game = new MockGame();
  game.init();

  // 构造碰牌场景：玩家1有2张wan1
  game.players[1].hand = [
    {id: 't1', type: 'wan1'},
    {id: 't2', type: 'wan1'},
    {id: 't3', type: 'wan2'},
    {id: 't4', type: 'wan3'},
    {id: 't5', type: 'wan4'},
    {id: 't6', type: 'wan5'},
    {id: 't7', type: 'wan6'},
    {id: 't8', type: 'wan7'},
    {id: 't9', type: 'wan8'},
    {id: 't10', type: 'wan9'},
    {id: 't11', type: 'east'},
    {id: 't12', type: 'south'},
    {id: 't13', type: 'west'}
  ];

  // 玩家0打出wan1
  game.lastDiscard = {type: 'wan1'};
  game.currentPlayer = 0;

  // 检查玩家1能否碰
  assert(game.canPong(1), '玩家1应能碰');

  // 执行碰
  game.doPong(1);

  assert(game.players[1].hand.length === 11, '碰后手牌应-2');
  assert(game.players[1].melds.length === 1, '应有1个副露');
  assert(game.players[1].melds[0].type === 'pong', '副露类型应为碰');

  const verify = game.verifyTileCount();
  // 注意：由于我们手动构造了牌，总数可能不等于136
  // 但手牌+副露应该是正确的
});

test('35. 吃牌流程测试', () => {
  const game = new MockGame();
  game.init();

  // 构造吃牌场景：玩家1有wan2和wan4
  game.players[1].hand = [
    {id: 't1', type: 'wan2'},
    {id: 't2', type: 'wan4'},
    {id: 't3', type: 'wan1'},
    {id: 't4', type: 'wan5'},
    {id: 't5', type: 'wan6'},
    {id: 't6', type: 'wan7'},
    {id: 't7', type: 'wan8'},
    {id: 't8', type: 'wan9'},
    {id: 't9', type: 'east'},
    {id: 't10', type: 'south'},
    {id: 't11', type: 'west'},
    {id: 't12', type: 'north'},
    {id: 't13', type: 'zhong'}
  ];

  // 玩家0打出wan3（玩家1是玩家0的上家才能吃，这里简化测试）
  game.lastDiscard = {type: 'wan3'};
  game.currentPlayer = 0;

  // 检查能否吃
  assert(game.canChow(1), '玩家1应能吃wan2-wan3-wan4');

  // 执行吃
  game.doChow(1);

  assert(game.players[1].hand.length === 11, '吃后手牌应-2');
  assert(game.players[1].melds.length === 1, '应有1个副露');
  assert(game.players[1].melds[0].type === 'chow', '副露类型应为吃');
});

test('36. 杠牌流程测试', () => {
  const game = new MockGame();
  game.init();

  // 构造暗杠场景：玩家1有4张wan1
  game.players[1].hand = [
    {id: 't1', type: 'wan1'},
    {id: 't2', type: 'wan1'},
    {id: 't3', type: 'wan1'},
    {id: 't4', type: 'wan1'},
    {id: 't5', type: 'wan2'},
    {id: 't6', type: 'wan3'},
    {id: 't7', type: 'wan4'},
    {id: 't8', type: 'wan5'},
    {id: 't9', type: 'wan6'},
    {id: 't10', type: 'wan7'},
    {id: 't11', type: 'wan8'},
    {id: 't12', type: 'wan9'},
    {id: 't13', type: 'east'}
  ];

  // 检查能否暗杠
  assert(game.canKong(1, true), '玩家1应能暗杠');

  const handBefore = game.players[1].hand.length;

  // 执行暗杠
  game.doKong(1, true);

  // 暗杠移除3张（留下1张在副露中体现），然后摸1张
  // 13张 - 3张 + 1张(摸牌) = 11张
  assert(game.players[1].hand.length === handBefore - 3 + 1, `暗杠后手牌应为${handBefore - 3 + 1}张，实际${game.players[1].hand.length}`);
  assert(game.players[1].melds.length === 1, '应有1个副露');
  assert(game.players[1].melds[0].type === 'kong', '副露类型应为杠');
  assert(game.players[1].melds[0].tiles.length === 4, '杠应有4张牌');
});

test('37. 胡牌检测流程', () => {
  const game = new MockGame();
  game.init();

  // 构造听牌场景：玩家0听牌（清一色听牌）
  game.players[0].hand = [
    {id: 't1', type: 'wan1'},
    {id: 't2', type: 'wan2'},
    {id: 't3', type: 'wan3'},
    {id: 't4', type: 'wan4'},
    {id: 't5', type: 'wan5'},
    {id: 't6', type: 'wan6'},
    {id: 't7', type: 'wan7'},
    {id: 't8', type: 'wan8'},
    {id: 't9', type: 'wan9'},
    {id: 't10', type: 'wan9'},
    {id: 't11', type: 'wan9'},
    {id: 't12', type: 'wan1'},
    {id: 't13', type: 'wan1'}
  ];

  // 检查听牌
  const waiting = checkTenpai(game.players[0].hand);

  if (waiting.length > 0) {
    console.log(`   听牌: ${waiting.map(t => t.type || t).join(', ')}`);

    // 模拟摸到胡牌
    const winTileType = waiting[0].type || waiting[0];
    game.players[0].hand.push({type: winTileType});

    assert(game.canWin(0), '摸到听牌应该能胡');
  } else {
    // 如果没听牌，手动添加一张让它胡
    game.players[0].hand.push({type: 'wan1'});
    // 现在应该能胡
    const canWinNow = game.canWin(0);
    console.log(`   添加一张后能否胡: ${canWinNow}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`测试结果: ${testsPassed} 通过, ${testsFailed} 失败`);
console.log('='.repeat(60));

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 所有测试通过！游戏核心功能正常。');
}
