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

console.log('\n' + '='.repeat(60));
console.log(`测试结果: ${testsPassed} 通过, ${testsFailed} 失败`);
console.log('='.repeat(60));

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 所有测试通过！游戏核心功能正常。');
}
