// 麻将牌面 SVG 生成器

const TileGraphics = {
  // 生成牌的 SVG
  createTileSVG(type, size = 'medium') {
    const dims = {
      small: { w: 36, h: 48 },
      medium: { w: 48, h: 64 },
      large: { w: 60, h: 80 }
    };
    const { w, h } = dims[size] || dims.medium;
    
    const suit = type.replace(/\d/g, '');
    const num = parseInt(type.match(/\d/)?.[0]) || 0;
    
    // 牌面颜色
    const colors = {
      wan: '#1a5c1a',    // 万 - 深绿
      sou: '#1a6c1a',    // 索 - 绿色
      pin: '#1a4c8c',    // 筒 - 蓝色
      wind: '#4a1a6c',   // 风 - 紫色
      dragon: { zhong: '#c41e3a', fa: '#1a8c1a', bai: '#2a2a2a' }
    };
    
    let color = colors[suit];
    if (typeof color === 'object') color = color[type] || '#333';
    
    // 背景
    let svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>
          <linearGradient id="bg${type}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fffef5"/>
            <stop offset="100%" style="stop-color:#e8dcc8"/>
          </linearGradient>
          <filter id="shadow${type}">
            <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.3"/>
          </filter>
        </defs>
        <!-- 牌身 -->
        <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="4" fill="url(#bg${type})" filter="url(#shadow${type})"/>
        <!-- 边框 -->
        <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="4" fill="none" stroke="#c4b896" stroke-width="1"/>
    `;
    
    // 角标
    const cornerSize = Math.floor(h * 0.15);
    svg += `
      <text x="3" y="${cornerSize + 2}" font-size="${cornerSize}" font-family="SimSun" fill="${color}" font-weight="bold">${num}</text>
      <text x="${w - 3}" y="${h - 2}" font-size="${cornerSize}" font-family="SimSun" fill="${color}" font-weight="bold" transform="rotate(180 ${w-3} ${h-2})">${num}</text>
    `;
    
    // 中间图案
    const centerX = w / 2;
    const centerY = h / 2;
    const symbolSize = h * 0.45;
    
    if (suit === 'wan') {
      // 万子 - 中文数字
      const chars = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      svg += `<text x="${centerX}" y="${centerY + symbolSize * 0.35}" font-size="${symbolSize * 0.7}" font-family="SimSun" fill="${color}" text-anchor="middle" font-weight="bold">${chars[num]}</text>`;
    } else if (suit === 'sou') {
      // 索子 - 竹子图案
      svg += this.createBambooSVG(centerX, centerY, symbolSize, color);
    } else if (suit === 'pin') {
      // 筒子 - 圆圈
      svg += this.createCircleSVG(centerX, centerY, symbolSize, color);
    } else if (suit === 'wind') {
      // 风牌
      const windChars = { east: '東', south: '南', west: '西', north: '北' };
      svg += `<text x="${centerX}" y="${centerY + symbolSize * 0.35}" font-size="${symbolSize * 0.8}" font-family="SimSun" fill="${color}" text-anchor="middle" font-weight="bold">${windChars[type] || type}</text>`;
    } else if (suit === 'dragon') {
      // 箭牌
      const dragonChars = { zhong: '中', fa: '發', bai: '白' };
      const dragonColors = { zhong: '#c41e3a', fa: '#1a8c1a', bai: '#2a2a2a' };
      svg += `<text x="${centerX}" y="${centerY + symbolSize * 0.35}" font-size="${symbolSize * 0.8}" font-family="SimSun" fill="${dragonColors[type] || color}" text-anchor="middle" font-weight="bold">${dragonChars[type] || type}</text>`;
    }
    
    svg += '</svg>';
    return svg;
  },
  
  // 索子图案 (竹子)
  createBambooSVG(cx, cy, size, color) {
    const s = size * 0.25;
    let g = `<g fill="${color}">`;
    // 上圆
    g += `<circle cx="${cx}" cy="${cy - s * 1.2}" r="${s * 0.6}"/>`;
    // 中间
    g += `<rect x="${cx - s * 0.15}" y="${cy - s * 0.8}" width="${s * 0.3}" height="${s * 1.6}" rx="${s * 0.1}"/>`;
    // 下圆
    g += `<circle cx="${cx}" cy="${cy + s * 1.2}" r="${s * 0.6}"/>`;
    g += '</g>';
    return g;
  },
  
  // 筒子图案 (圆圈)
  createCircleSVG(cx, cy, size, color) {
    const s = size * 0.4;
    let g = `<g fill="${color}">`;
    // 外圆
    g += `<circle cx="${cx}" cy="${cy}" r="${s}" fill="none" stroke="${color}" stroke-width="${s * 0.15}"/>`;
    // 内部圆点 (根据数字)
    g += `<circle cx="${cx}" cy="${cy}" r="${s * 0.25}"/>`;
    g += '</g>';
    return g;
  },
  
  // 牌背
  createBackSVG(size = 'medium') {
    const dims = { small: { w: 36, h: 48 }, medium: { w: 48, h: 64 }, large: { w: 60, h: 80 } };
    const { w, h } = dims[size] || dims.medium;
    
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <defs>
          <linearGradient id="backGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#8b0000"/>
            <stop offset="100%" style="stop-color:#5c0000"/>
          </linearGradient>
          <pattern id="backPat" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#8b0000"/>
            <path d="M0 0L8 8M8 0L0 8" stroke="#d4af3740" stroke-width="1"/>
          </pattern>
        </defs>
        <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="4" fill="url(#backGrad)"/>
        <rect x="3" y="3" width="${w-6}" height="${h-6}" rx="2" fill="none" stroke="#d4af37" stroke-width="1"/>
        <rect x="4" y="4" width="${w-8}" height="${h-8}" rx="1" fill="url(#backPat)" opacity="0.5"/>
      </svg>
    `;
  },
  
  // 导出为 data URL
  toDataURL(svgString) {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TileGraphics;
}
