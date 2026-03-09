// 麻将胡牌判定模块

// 番型定义
const FanType = {
  PING_HU: { name: '平胡', score: 1 },
  DUI_DUI_HU: { name: '对对胡', score: 2 },
  QING_YI_SE: { name: '清一色', score: 6 },
  HUN_YI_SE: { name: '混一色', score: 3 },
  QI_DUI_ZI: { name: '七对子', score: 4 },
  GUO_SHI_WU_SHUANG: { name: '国士无双', score: 13 },
  XIAO_SAN_YUAN: { name: '小三元', score: 2 },
  DA_SAN_YUAN: { name: '大三元', score: 8 },
  SI_AN_KE: { name: '四暗刻', score: 6 },
  SAN_AN_KE: { name: '三暗刻', score: 2 },
  ZI_MO: { name: '自摸', score: 1 },
  GANG_KAI: { name: '杠开', score: 2 }
};

// 国士无双需要的13张牌
const THIRTEEN_ORPHANS = [
  'wan1', 'wan9',      // 一万、九万
  'sou1', 'sou9',      // 一索、九索
  'pin1', 'pin9',      // 一筒、九筒
  'east', 'south', 'west', 'north',  // 东南西北
  'zhong', 'fa', 'bai' // 中发白
];

// 风牌
const WIND_TILES = ['east', 'south', 'west', 'north'];
// 三元牌
const DRAGON_TILES = ['zhong', 'fa', 'bai'];
// 字牌
const HONOR_TILES = [...WIND_TILES, ...DRAGON_TILES];

/**
 * 判断能否胡牌
 * @param {Array} hand - 手牌数组
 * @returns {boolean}
 */
function canWin(hand) {
  // 需要14张牌
  if (hand.length !== 14) return false;

  const tiles = hand.map(t => t.type);

  // 先检查特殊牌型：国士无双
  if (isThirteenOrphans(tiles)) return true;

  // 检查是否有对子
  // 尝试将每个对子作为雀头，检查剩余是否能组成顺子/刻子
  for (let i = 0; i < tiles.length; i++) {
    // 找相同牌作为雀头
    const j = tiles.indexOf(tiles[i], i + 1);
    if (j !== -1) {
      // 提取雀头和剩余牌
      const remaining = [...tiles.slice(0, i), ...tiles.slice(i + 1, j), ...tiles.slice(j + 1)];

      if (canFormMelds(remaining)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 判断剩余牌能否组成顺子或刻子
 */
function canFormMelds(tiles) {
  if (tiles.length === 0) return true;
  if (tiles.length % 3 !== 0) return false;
  
  // 排序
  tiles.sort();
  
  // 尝试消除一个顺子或刻子
  const tileStr = tiles.join(',');
  
  // 检查刻子 (AAA)
  for (let i = 0; i < tiles.length; i++) {
    if (i + 2 < tiles.length && 
        tiles[i] === tiles[i + 1] && 
        tiles[i] === tiles[i + 2]) {
      const remaining = [...tiles.slice(0, i), ...tiles.slice(i + 3)];
      if (canFormMelds(remaining)) return true;
    }
  }
  
  // 检查顺子 (ABC) - 只对万/索/筒有效
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const num = parseInt(tile.replace(/\D/g, ''));
    const suit = tile.replace(/\d/g, '');
    
    // 风牌和箭牌不能组成顺子
    if (!['wan', 'sou', 'pin'].includes(suit)) continue;
    
    const next1 = `${suit}${num + 1}`;
    const next2 = `${suit}${num + 2}`;
    
    const idx1 = tiles.indexOf(next1);
    const idx2 = tiles.indexOf(next2);
    
    if (idx1 !== -1 && idx2 !== -1) {
      const remaining = tiles.filter((t, idx) => idx !== i && idx !== idx1 && idx !== idx2);
      if (canFormMelds(remaining)) return true;
    }
  }
  
  return false;
}

/**
 * 检查是否听牌
 * @param {Array} hand - 13张手牌
 * @returns {Array} - 听牌后能胡的牌列表
 */
function checkTenpai(hand) {
  if (hand.length !== 13) return [];
  
  const waitingTiles = [];
  const allTypes = getAllTileTypes();
  
  // 尝试加入每种牌，看能否胡
  for (const type of allTypes) {
    // 检查牌堆中是否还有这种牌
    const testHand = [...hand, { type, id: `test_${type}` }];
    if (canWin(testHand)) {
      waitingTiles.push(type);
    }
  }
  
  return waitingTiles;
}

/**
 * 能否碰牌
 */
function canPong(hand, discardedTile) {
  const count = hand.filter(t => t.type === discardedTile.type).length;
  return count >= 2;
}

/**
 * 能否吃牌
 */
function canChow(hand, discardedTile) {
  const suit = discardedTile.type.replace(/\d/g, '');
  const num = parseInt(discardedTile.type.replace(/\D/g, ''));
  
  // 字牌不能吃
  if (!['wan', 'sou', 'pin'].includes(suit)) return false;
  if (num < 1 || num > 7) return false; // 只有1-7才能吃
  
  const needed = [
    `${suit}${num - 1}`,
    `${suit}${num + 1}`
  ];
  
  return needed.every(neededType => 
    hand.some(t => t.type === neededType)
  );
}

/**
 * 能否杠牌
 */
function canKong(hand, discardedTile, isSelfDraw = false) {
  const count = hand.filter(t => t.type === discardedTile.type).length;
  
  // 明杠: 手中有3张，桌上有1张
  if (!isSelfDraw && count >= 3) return true;
  
  // 暗杠: 手中有4张
  if (count >= 4) return true;
  
  return false;
}

/**
 * 能否从碰加杠（明杠）
 */
function canKongFromPong(player, tile) {
  if (!player.melds) return false;
  // 检查是否有该牌的碰
  return player.melds.some(meld => meld.type === 'pong' && meld.tiles[0].type === tile.type);
}

/**
 * 计算番数 (扩展版)
 * @param {Array} hand - 手牌
 * @param {Array} melds - 副露
 * @param {boolean} isZimo - 是否自摸
 * @param {boolean} isGangshanghua - 是否杠上开花
 * @returns {Object} - { fans: number, fanTypes: Array }
 */
function calcScore(hand, melds = [], isZimo = false, isGangshanghua = false) {
  const fanTypes = [];
  let fans = 0;

  // 获取所有牌型
  const tiles = hand.map(t => t.type);

  // 检查国士无双 (最高优先级，单独计算)
  if (isThirteenOrphans(tiles)) {
    fanTypes.push(FanType.GUO_SHI_WU_SHUANG);
    fans = FanType.GUO_SHI_WU_SHUANG.score;
    // 自摸加分
    if (isZimo) {
      fanTypes.push(FanType.ZI_MO);
      fans += FanType.ZI_MO.score;
    }
    return { fans, fanTypes };
  }

  // 检查大三元
  if (isDaSanYuan(tiles, melds)) {
    fanTypes.push(FanType.DA_SAN_YUAN);
    fans = Math.max(fans, FanType.DA_SAN_YUAN.score);
  }
  // 检查小三元
  else if (isXiaoSanYuan(tiles, melds)) {
    fanTypes.push(FanType.XIAO_SAN_YUAN);
    fans = Math.max(fans, FanType.XIAO_SAN_YUAN.score);
  }

  // 检查四暗刻
  if (isSiAnKe(tiles, melds)) {
    fanTypes.push(FanType.SI_AN_KE);
    fans = Math.max(fans, FanType.SI_AN_KE.score);
  }
  // 检查三暗刻
  else if (isSanAnKe(tiles, melds)) {
    fanTypes.push(FanType.SAN_AN_KE);
    fans = Math.max(fans, FanType.SAN_AN_KE.score);
  }

  // 检查清一色
  if (isQingYiSe(tiles, melds)) {
    fanTypes.push(FanType.QING_YI_SE);
    fans = Math.max(fans, FanType.QING_YI_SE.score);
  }
  // 检查混一色
  else if (isHunYiSe(tiles, melds)) {
    fanTypes.push(FanType.HUN_YI_SE);
    fans = Math.max(fans, FanType.HUN_YI_SE.score);
  }

  // 检查七对子
  if (isQiDui(tiles)) {
    fanTypes.push(FanType.QI_DUI_ZI);
    fans = Math.max(fans, FanType.QI_DUI_ZI.score);
  }
  // 检查碰碰胡
  else if (isPengPengHu(tiles, melds)) {
    fanTypes.push(FanType.DUI_DUI_HU);
    fans = Math.max(fans, FanType.DUI_DUI_HU.score);
  }

  // 如果没有任何特殊番型，基础平胡
  if (fans === 0) {
    fanTypes.push(FanType.PING_HU);
    fans = FanType.PING_HU.score;
  }

  // 杠上开花
  if (isGangshanghua) {
    fanTypes.push(FanType.GANG_KAI);
    fans += FanType.GANG_KAI.score;
  }

  // 自摸
  if (isZimo) {
    fanTypes.push(FanType.ZI_MO);
    fans += FanType.ZI_MO.score;
  }

  return { fans, fanTypes };
}

// 七对子
function isQiDui(tiles) {
  const counts = {};
  tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);
  
  let pairs = 0;
  Object.values(counts).forEach(c => {
    if (c === 2) pairs++;
    else if (c === 4) pairs += 2; // 四张算两对
  });
  
  return pairs === 7;
}

// 清一色
function isQingYiSe(tiles, melds) {
  // 从 melds 中提取牌的类型
  const meldTiles = melds.flatMap(m => m.tiles ? m.tiles.map(t => t.type || t) : []);
  const allTiles = [...tiles, ...meldTiles];
  const suits = new Set(allTiles.map(t => {
    const type = typeof t === 'string' ? t : (t.type || t);
    return type.replace(/\d/g, '');
  }));
  return suits.size === 1 && !suits.has('');
}

// 混一色
function isHunYiSe(tiles, melds) {
  // 从 melds 中提取牌的类型
  const meldTiles = melds.flatMap(m => m.tiles ? m.tiles.map(t => t.type || t) : []);
  const allTiles = [...tiles, ...meldTiles];
  const suits = new Set(allTiles.map(t => {
    const type = typeof t === 'string' ? t : (t.type || t);
    return type.replace(/\d/g, '');
  }));
  const hasZi = allTiles.some(t => {
    const type = typeof t === 'string' ? t : (t.type || t);
    return ['east','south','west','north','zhong','fa','bai'].includes(type);
  });

  return suits.size === 2 && hasZi;
}

// 碰碰胡
function isPengPengHu(tiles, melds) {
  // 从 melds 中提取牌的类型
  const meldTiles = melds.flatMap(m => m.tiles ? m.tiles.map(t => t.type || t) : []);
  const allTiles = [...tiles, ...meldTiles];
  const counts = {};
  allTiles.forEach(t => {
    const type = typeof t === 'string' ? t : (t.type || t);
    counts[type] = (counts[type] || 0) + 1;
  });

  const triplets = Object.values(counts).filter(c => c >= 3).length;
  const pairs = Object.values(counts).filter(c => c === 2).length;

  return triplets === 4 && pairs === 1;
}

// 国士无双 (十三幺)
function isThirteenOrphans(tiles) {
  const counts = {};
  tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);

  // 必须包含所有13种牌
  let hasAll = true;
  let pairCount = 0;

  for (const req of THIRTEEN_ORPHANS) {
    if (!counts[req]) {
      hasAll = false;
      break;
    }
    if (counts[req] === 2) {
      pairCount++;
    }
  }

  // 必须包含所有13种牌，且有一种牌是两张（做雀头）
  return hasAll && pairCount === 1;
}

// 大三元检测
function isDaSanYuan(tiles, melds) {
  // 从 melds 中提取牌的类型
  const meldTiles = melds.flatMap(m => m.tiles ? m.tiles.map(t => t.type || t) : []);
  const allTiles = [...tiles, ...meldTiles];
  const counts = {};
  allTiles.forEach(t => {
    const type = typeof t === 'string' ? t : (t.type || t);
    counts[type] = (counts[type] || 0) + 1;
  });

  // 检查中发白是否都是刻子
  let dragonTriplets = 0;
  for (const dragon of DRAGON_TILES) {
    if (counts[dragon] >= 3) {
      dragonTriplets++;
    }
  }

  return dragonTriplets === 3;
}

// 小三元检测
function isXiaoSanYuan(tiles, melds) {
  // 从 melds 中提取牌的类型
  const meldTiles = melds.flatMap(m => m.tiles ? m.tiles.map(t => t.type || t) : []);
  const allTiles = [...tiles, ...meldTiles];
  const counts = {};
  allTiles.forEach(t => {
    const type = typeof t === 'string' ? t : (t.type || t);
    counts[type] = (counts[type] || 0) + 1;
  });

  // 检查中发白：2个刻子 + 1个对子
  let dragonTriplets = 0;
  let dragonPairs = 0;
  for (const dragon of DRAGON_TILES) {
    if (counts[dragon] >= 3) dragonTriplets++;
    else if (counts[dragon] === 2) dragonPairs++;
  }

  return dragonTriplets === 2 && dragonPairs === 1;
}

// 统计暗刻数量（需要知道哪些是碰/杠的）
function countAnKe(tiles, melds) {
  // 如果有明碰/明杠，不算暗刻
  // melds 中 type 为 'pong' 或 'kong' 的是明副露
  // 这里简化处理：如果没有 melds，统计手牌中的刻子
  const counts = {};
  tiles.forEach(t => counts[t] = (counts[t] || 0) + 1);

  let anKe = 0;
  for (const count of Object.values(counts)) {
    if (count >= 3) anKe++;
  }

  // 减去明副露的数量
  const meldTriplets = melds ? melds.filter(m => m.type === 'pong' || m.type === 'kong').length : 0;

  return Math.max(0, anKe - meldTriplets);
}

// 四暗刻检测
function isSiAnKe(tiles, melds) {
  // 有副露不算四暗刻
  if (melds && melds.length > 0) return false;
  return countAnKe(tiles, melds) === 4;
}

// 三暗刻检测
function isSanAnKe(tiles, melds) {
  return countAnKe(tiles, melds) === 3;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    canWin, checkTenpai, canPong, canChow, canKong, calcScore,
    // 导出新函数供测试
    isThirteenOrphans, isDaSanYuan, isXiaoSanYuan, isSiAnKe, isSanAnKe,
    FanType, THIRTEEN_ORPHANS, WIND_TILES, DRAGON_TILES, HONOR_TILES
  };
}
