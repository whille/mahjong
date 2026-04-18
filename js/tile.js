// 麻将牌定义模块

// 34种牌型
const TILE_TYPES = {
  // 万子 (Characters) 1-9
  WAN_1: 'wan1', WAN_2: 'wan2', WAN_3: 'wan3', WAN_4: 'wan4', WAN_5: 'wan5',
  WAN_6: 'wan6', WAN_7: 'wan7', WAN_8: 'wan8', WAN_9: 'wan9',
  
  // 索子 (Bamboos) 1-9
  SOU_1: 'sou1', SOU_2: 'sou2', SOU_3: 'sou3', SOU_4: 'sou4', SOU_5: 'sou5',
  SOU_6: 'sou6', SOU_7: 'sou7', SOU_8: 'sou8', SOU_9: 'sou9',
  
  // 筒子 (Circles) 1-9
  PIN_1: 'pin1', PIN_2: 'pin2', PIN_3: 'pin3', PIN_4: 'pin4', PIN_5: 'pin5',
  PIN_6: 'pin6', PIN_7: 'pin7', PIN_8: 'pin8', PIN_9: 'pin9',
  
  // 风牌 (Winds)
  EAST: 'east', SOUTH: 'south', WEST: 'west', NORTH: 'north',
  
  // 箭牌 (Dragons)
  ZHONG: 'zhong', FA: 'fa', BAI: 'bai'
};

// 牌型中文名
const TILE_NAMES = {
  wan1: '一万', wan2: '二万', wan3: '三万', wan4: '四万', wan5: '五万',
  wan6: '六万', wan7: '七万', wan8: '八万', wan9: '九万',
  sou1: '一索', sou2: '二索', sou3: '三索', sou4: '四索', sou5: '五索',
  sou6: '六索', sou7: '七索', sou8: '八索', sou9: '九索',
  pin1: '一筒', pin2: '二筒', pin3: '三筒', pin4: '四筒', pin5: '五筒',
  pin6: '六筒', pin7: '七筒', pin8: '八筒', pin9: '九筒',
  east: '东', south: '南', west: '西', north: '北',
  zhong: '中', fa: '发', bai: '白'
};

// 牌的花色分类
const TILE_SUITS = {
  wan: ['wan1','wan2','wan3','wan4','wan5','wan6','wan7','wan8','wan9'],
  sou: ['sou1','sou2','sou3','sou4','sou5','sou6','sou7','sou8','sou9'],
  pin: ['pin1','pin2','pin3','pin4','pin5','pin6','pin7','pin8','pin9'],
  winds: ['east','south','west','north'],
  dragons: ['zhong','fa','bai']
};

// 获取所有牌型列表
function getAllTileTypes() {
  return [...TILE_SUITS.wan, ...TILE_SUITS.sou, ...TILE_SUITS.pin, 
          ...TILE_SUITS.winds, ...TILE_SUITS.dragons];
}

// 初始化牌堆 (136张)
function initTileSet() {
  const tiles = [];
  const allTypes = getAllTileTypes();
  
  // 每种牌4张
  for (const type of allTypes) {
    for (let i = 0; i < 4; i++) {
      tiles.push({
        id: `${type}_${i}`,
        type: type,
        name: TILE_NAMES[type]
      });
    }
  }
  
  return tiles;
}

// 洗牌 (Fisher-Yates 算法)
function shuffle(tiles) {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 发牌给玩家
function dealTiles(tileSet, playerCount = 4) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    id: i,
    hand: [],
    pool: [],
    melds: [],
    isTenpai: false,
    isHu: false
  }));
  
  // 每人发13张
  for (let i = 0; i < 13; i++) {
    for (let p = 0; p < playerCount; p++) {
      if (tileSet.length > 0) {
        players[p].hand.push(tileSet.pop());
      }
    }
  }
  
  return { players, remainingTiles: tileSet };
}

// 玩家摸牌
function drawTile(player, tileSet) {
  if (tileSet.length === 0) return null;
  const tile = tileSet.pop();
  player.hand.push(tile);
  return tile;
}

// 玩家打牌
function discardTile(player, tileId) {
  const index = player.hand.findIndex(t => t.id === tileId);
  if (index === -1) return null;
  
  const [tile] = player.hand.splice(index, 1);
  player.pool.push(tile);
  return tile;
}

// 获取牌的类型
function getTileType(tile) {
  return tile.type;
}

// 获取牌的数字 (万/索/筒)
function getTileNumber(tile) {
  const type = tile.type;
  const match = type.match(/(wan|sou|pin)(\d)/);
  return match ? parseInt(match[2]) : null;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TILE_TYPES, TILE_NAMES, TILE_SUITS,
    getAllTileTypes, initTileSet, shuffle, dealTiles,
    drawTile, discardTile, getTileType, getTileNumber
  };
}
