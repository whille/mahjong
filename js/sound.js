// 麻将音效模块 - Web Audio API 合成

const Sound = {
  ctx: null,

  // 初始化音频上下文（仅在用户交互后调用）
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  },

  // 用户交互后激活音频
  activate() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // 检查音频是否可用
  isReady() {
    return this.ctx && this.ctx.state === 'running';
  },

  // 播放指定频率的声音
  playTone(frequency, duration, type = 'sine', volume = 0.3) {
    // 如果 AudioContext 未创建或未激活，静默跳过
    if (!this.isReady()) return;
    
    const oscillator = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    
    // 音量包络
    gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    oscillator.start(this.ctx.currentTime);
    oscillator.stop(this.ctx.currentTime + duration);
  },
  
  // 摸牌声音 (短促 "嗒")
  playDraw() {
    this.playTone(800, 0.08, 'sine', 0.2);
    setTimeout(() => this.playTone(600, 0.05, 'sine', 0.1), 50);
  },
  
  // 打牌声音 (较轻 "啪")
  playDiscard() {
    this.playTone(400, 0.06, 'triangle', 0.15);
    setTimeout(() => this.playTone(300, 0.04, 'sine', 0.08), 30);
  },
  
  // 碰声音 (两声短促)
  playPong() {
    this.playTone(600, 0.1, 'square', 0.15);
    setTimeout(() => this.playTone(600, 0.1, 'square', 0.15), 100);
  },
  
  // 杠声音 (三声或低沉)
  playKong() {
    this.playTone(500, 0.15, 'sawtooth', 0.12);
    setTimeout(() => this.playTone(400, 0.15, 'sawtooth', 0.12), 120);
    setTimeout(() => this.playTone(300, 0.2, 'sawtooth', 0.12), 240);
  },
  
  // 吃声音
  playChow() {
    this.playTone(500, 0.08, 'sine', 0.15);
    setTimeout(() => this.playTone(700, 0.08, 'sine', 0.15), 60);
  },
  
  // 胡牌声音 (上升音阶/和弦)
  playWin() {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.2), i * 150);
    });
  },
  
  // 点炮声音 (稍不同)
  playLose() {
    this.playTone(400, 0.2, 'sawtooth', 0.1);
    setTimeout(() => this.playTone(300, 0.3, 'sawtooth', 0.1), 150);
  },
  
  // 自摸声音
  playZimo() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.25, 'sine', 0.2), i * 120);
    });
  },
  
  // 按钮点击声
  playClick() {
    this.playTone(1000, 0.05, 'sine', 0.1);
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Sound;
}

// 用户首次交互时激活音频
document.addEventListener('click', () => Sound.activate(), { once: true });
document.addEventListener('keydown', () => Sound.activate(), { once: true });
