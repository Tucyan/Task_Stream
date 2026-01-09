import React, { useEffect, useRef, useState, useMemo } from 'react';

// --- 配置与默认值 ---

const DEFAULT_CONFIG = {
  baseColor: '#0ff',
  eyeSize: 85,
  pupilSize: 35,
  eyeGap: 240,
  faceTilt: 0.05,
  animSpeed: 0.12, 
};

// 默认表情参数
const DEFAULT_EXPRESSIONS = {
  neutral: {
    eyeScaleY: 1, eyeShape: 0, pupilScale: 1,
    browAngle: 0, browY: -80, browAlpha: 0, 
    leftBrowCurve: 0, rightBrowCurve: 0, 
    mouthWidth: 60, mouthHeight: 20, mouthY: 90, mouthShape: 0,
    tearAlpha: 0, wink: 0
  },
};

/**
 * RobotFace 组件
 * @param {number} winkTrigger - 传入一个时间戳或计数器，每次变化都会触发一次眨眼动作
 */
const RobotFace = ({ 
  color = '#0ff', 
  expression = 'neutral', 
  customExpressions = {}, 
  className = '',
  onClick,
  winkTrigger = 0 
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const requestRef = useRef(null);

  // 合并表情数据
  const expressionsData = useMemo(() => {
    const base = {
      neutral: { ...DEFAULT_EXPRESSIONS.neutral },
      happy: {
        ...DEFAULT_EXPRESSIONS.neutral,
        eyeShape: 1, pupilScale: 0,
        mouthWidth: 90, mouthHeight: 80, mouthShape: 1
      },
      surprised: {
        ...DEFAULT_EXPRESSIONS.neutral,
        pupilScale: 0.5, browY: -95,
        mouthWidth: 35, mouthHeight: 45, mouthY: 100, mouthShape: 2
      },
      angry: {
        ...DEFAULT_EXPRESSIONS.neutral,
        pupilScale: 0.8, browAngle: 0.5, browY: -50, browAlpha: 1,
        mouthWidth: 70, mouthHeight: 40, mouthY: 100, mouthShape: 3
      },
      sad: {
        ...DEFAULT_EXPRESSIONS.neutral,
        eyeScaleY: 0.7, browAngle: -0.2,
        mouthWidth: 60, mouthHeight: 40, mouthY: 100, mouthShape: 4,
        tearAlpha: 1
      },
      // 将原来的 clicked 状态定义为 uwu，作为基础库的一部分
      uwu: {
        ...DEFAULT_EXPRESSIONS.neutral,
        eyeShape: 2, pupilScale: 0,
        mouthWidth: 70, mouthHeight: 30, mouthShape: 5
      }
    };
    return { ...base, ...customExpressions };
  }, [customExpressions]);

  const stateRef = useRef({
    width: 0, height: 0,
    mouse: { x: 0, y: 0 }, targetMouse: { x: 0, y: 0 },
    currentVal: JSON.parse(JSON.stringify(DEFAULT_EXPRESSIONS.neutral)),
    targetVal: DEFAULT_EXPRESSIONS.neutral,
    currentLogicState: 'neutral',
    time: 0,
    blinkScale: 1,
    tears: [],
    zzzs: [],
    breathOffset: 0,
    shake: { x: 0, y: 0 },
    actionWinkVal: 0,     
    isWinkingAction: false, 
    winkStartTime: 0
  });

  // 1. 监听眨眼触发
  useEffect(() => {
    if (winkTrigger > 0) {
      const state = stateRef.current;
      state.isWinkingAction = true;
      state.winkStartTime = Date.now();
    }
  }, [winkTrigger]);

  // 2. 表情切换逻辑 (直接切换，去除中间态)
  useEffect(() => {
    const state = stateRef.current;
    state.currentLogicState = expression;

    // 直接设置目标值，不再使用 setTimeout 回到 neutral
    // 线性插值 (lerp) 函数会自动处理两个状态之间的平滑过渡
    state.targetVal = expressionsData[expression] || expressionsData.neutral;

  }, [expression, expressionsData]);

  // 3. 动画循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = stateRef.current;

    const lerp = (start, end, amt) => start + (end - start) * amt;

    const resize = () => {
      if (containerRef.current && canvas) {
        state.width = canvas.width = containerRef.current.clientWidth;
        state.height = canvas.height = containerRef.current.clientHeight;
      }
    };

    const draw = () => {
      state.time += 0.05;

      // --- 处理眨眼动作动画 ---
      if (state.isWinkingAction) {
        const elapsed = Date.now() - state.winkStartTime;
        const duration = 800; // 动画持续时间
        if (elapsed < duration) {
            const progress = elapsed / duration;
            if (progress < 0.5) {
                state.actionWinkVal = progress * 2; // 闭眼阶段
            } else {
                state.actionWinkVal = 1 - (progress - 0.5) * 2; // 开眼阶段
            }
        } else {
            state.actionWinkVal = 0;
            state.isWinkingAction = false;
        }
      }

      // --- 参数插值 ---
      for (let key in state.currentVal) {
        let target = state.targetVal[key] !== undefined ? state.targetVal[key] : (DEFAULT_EXPRESSIONS.neutral[key] || 0);

        if (key === 'mouthShape' || key === 'eyeShape') {
          state.currentVal[key] = target;
        } else {
          state.currentVal[key] = lerp(state.currentVal[key], target, DEFAULT_CONFIG.animSpeed);
        }
      }

      state.mouse.x = lerp(state.mouse.x, state.targetMouse.x, 0.1);
      state.mouse.y = lerp(state.mouse.y, state.targetMouse.y, 0.1);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, state.width, state.height);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      
      ctx.font = "bold 40px 'Courier New', monospace";
      ctx.textAlign = "center";

      let breathY = Math.sin(state.time) * 5;
      state.shake = { x: 0, y: 0 };
      
      if (state.currentLogicState === 'angry') {
        state.shake.x = (Math.random() - 0.5) * 4;
        state.shake.y = (Math.random() - 0.5) * 4;
        breathY = Math.sin(state.time * 3) * 8;
      }
      if (state.currentLogicState === 'sleeping') {
          breathY = Math.sin(state.time * 0.5) * 10;
      }

      const faceX = state.width / 2 + state.mouse.x * DEFAULT_CONFIG.faceTilt + state.shake.x;
      const faceY = state.height / 2 + state.mouse.y * DEFAULT_CONFIG.faceTilt + breathY + state.shake.y;

      ctx.save();
      ctx.translate(faceX, faceY);
      
      drawEyes(ctx, state);
      drawMouth(ctx, state);
      drawBrows(ctx, state);
      drawTears(ctx, state);
      drawZZZ(ctx, state);
      
      ctx.restore();

      requestRef.current = requestAnimationFrame(draw);
    };

    // --- 绘图函数 ---

    const drawEyes = (ctx, s) => {
      const gap = DEFAULT_CONFIG.eyeGap / 2;
      const y = -30;
      drawOneEye(ctx, s, -gap, y, true);
      drawOneEye(ctx, s, gap, y, false);
    };

    const drawOneEye = (ctx, s, offsetX, offsetY, isLeft) => {
      ctx.save();
      ctx.translate(offsetX, offsetY);
      
      let totalScaleY = s.currentVal.eyeScaleY * s.blinkScale;
      
      const winkValue = Math.max(s.currentVal.wink, s.actionWinkVal);
      const isWinking = !isLeft && winkValue > 0.01;
      
      if (isWinking) {
          totalScaleY = s.currentVal.eyeScaleY * (1 - winkValue * 0.1); 
      }

      if ([2, 3, 4, 5].includes(s.currentVal.eyeShape)) totalScaleY = 1; 

      ctx.scale(1, totalScaleY);
      const size = DEFAULT_CONFIG.eyeSize;
      
      ctx.beginPath();
      
      if (s.currentVal.eyeShape === 5) { // 十字星星眼
        const r = size * 0.9; 
        ctx.moveTo(0, -r); 
        ctx.quadraticCurveTo(0, 0, r, 0); 
        ctx.quadraticCurveTo(0, 0, 0, r); 
        ctx.quadraticCurveTo(0, 0, -r, 0); 
        ctx.quadraticCurveTo(0, 0, 0, -r); 
        ctx.fill();
      }
      else if (s.currentVal.eyeShape === 4) { // 睡眠
        ctx.lineWidth = 12;
        const lineLen = size * 0.8;
        ctx.moveTo(-lineLen, 0);
        ctx.lineTo(lineLen, 0);
        ctx.stroke();
        ctx.lineWidth = 6;
      }
      else if (isWinking && winkValue > 0.8) { // 眨眼
        const ws = size * 0.8; 
        ctx.moveTo(ws, -ws);
        ctx.lineTo(-ws, 0);
        ctx.lineTo(ws, ws);
        ctx.stroke();
      } 
      else if (s.currentVal.eyeShape === 3) { // 爱心
        const hs = size * 0.035; // 心形缩放系数
        ctx.save(); 
        ctx.scale(hs, hs); 
        ctx.beginPath();
        const bottomY = 25; // 心形底部坐标
        ctx.moveTo(0, -10);
        ctx.bezierCurveTo(0, -25, -25, -25, -25, -10);
        ctx.bezierCurveTo(-25, 10, 0, 15, 0, bottomY);
        ctx.bezierCurveTo(0, 15, 25, 10, 25, -10);
        ctx.bezierCurveTo(25, -25, 0, -25, 0, -10);
        ctx.fill(); 
        ctx.restore();
      } 
      else if (s.currentVal.eyeShape === 1) { // 弧形
        ctx.arc(0, 15, size, Math.PI, 0);
        ctx.stroke();
      } 
      else if (s.currentVal.eyeShape === 2) { // 线条
        const sz = size * 0.8; // 线条尺寸
        if (isLeft) { ctx.moveTo(-sz, -sz); ctx.lineTo(sz, 0); ctx.lineTo(-sz, sz); }
        else { ctx.moveTo(sz, -sz); ctx.lineTo(-sz, 0); ctx.lineTo(sz, sz); }
        ctx.stroke();
      } 
      else { // 圆形 (默认)
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 绘制瞳孔
      const noPupilShapes = [2, 3, 4, 5];
      const shouldDrawPupil = 
        !noPupilShapes.includes(s.currentVal.eyeShape) && 
        s.currentVal.pupilScale > 0.1 && 
        (!isWinking || winkValue < 0.8);

      if (shouldDrawPupil) {
        if (totalScaleY > 0.2) {
            ctx.restore(); ctx.save(); ctx.translate(offsetX, offsetY);
            let lookX = s.mouse.x;
            let lookY = s.mouse.y - offsetY * 0.5;
            const angle = Math.atan2(lookY, lookX);
            const maxDist = size - DEFAULT_CONFIG.pupilSize * s.currentVal.pupilScale - 8;
            const dist = Math.min(Math.sqrt(lookX**2 + lookY**2), maxDist);
            let px = Math.cos(angle) * dist;
            let py = Math.sin(angle) * dist;
            py *= totalScaleY;
            ctx.beginPath();
            ctx.arc(px, py, DEFAULT_CONFIG.pupilSize * s.currentVal.pupilScale, 0, Math.PI * 2);
            ctx.fill();
        }
      }
      ctx.restore();
    };

    const drawMouth = (ctx, s) => {
      const w = s.currentVal.mouthWidth;
      const h = s.currentVal.mouthHeight;
      const y = s.currentVal.mouthY;
      ctx.save(); ctx.translate(0, y); ctx.beginPath();
      
      if (s.currentVal.mouthShape === 6) { // 嘟嘴
        ctx.moveTo(-w, 0);
        ctx.quadraticCurveTo(0, h, w, 0); 
        
        const sideGap = 4;
        const sideH = 22;  
        
        ctx.moveTo(w + sideGap, -sideH);
        ctx.quadraticCurveTo(w - sideGap, 0, w + sideGap, sideH);

      } else if (s.currentVal.mouthShape === 1) { // D 形嘴 (D-shape mouth)
        const halfW = w / 2; // 一半宽度
        ctx.moveTo(-w, -h/2);
        ctx.quadraticCurveTo(-halfW, h, 0, -h/2);
        ctx.quadraticCurveTo(halfW, h, w, -h/2);
      } else if (s.currentVal.mouthShape === 4) { // 悲伤弧形
        ctx.moveTo(-w, h); ctx.quadraticCurveTo(0, -h, w, h);
      } else if (s.currentVal.mouthShape === 3) { // 梯形
        ctx.moveTo(-w, h); ctx.lineTo(-w/2, -h/2); ctx.lineTo(0, h); ctx.lineTo(w/2, -h/2); ctx.lineTo(w, h);
      } else if (s.currentVal.mouthShape === 2) { // 圆形
        ctx.ellipse(0, h/2, w/2, h, 0, 0, Math.PI * 2);
      } else if (s.currentVal.mouthShape === 1) { // D 形嘴 (D-shape mouth)
        ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, h*2, w, 0); ctx.quadraticCurveTo(0, h*0.5, -w, 0);
      } else { // 中性弧形
        ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, h, w, 0);
      }
      ctx.stroke(); ctx.restore();
    };

    const drawBrows = (ctx, s) => {
      if (s.currentVal.browAlpha < 0.05) return;
      const browLen = 60;
      
      const drawSingleBrow = (curveAmt) => {
        ctx.beginPath();
        if (Math.abs(curveAmt) < 5) {
            ctx.moveTo(-browLen, 0);
            ctx.lineTo(browLen, 0);
        } else {
            ctx.moveTo(-browLen, 0);
            ctx.quadraticCurveTo(0, curveAmt, browLen, 0);
        }
        ctx.stroke();
      };

      ctx.save(); ctx.globalAlpha = s.currentVal.browAlpha;
      ctx.translate(-DEFAULT_CONFIG.eyeGap/2, s.currentVal.browY);
      ctx.rotate(s.currentVal.browAngle);
      drawSingleBrow(s.currentVal.leftBrowCurve);
      ctx.restore();
      
      ctx.save(); ctx.globalAlpha = s.currentVal.browAlpha;
      ctx.translate(DEFAULT_CONFIG.eyeGap/2, s.currentVal.browY);
      const rightAngle = -s.currentVal.browAngle + (s.currentVal.rightBrowBend || 0);
      ctx.rotate(rightAngle);
      drawSingleBrow(s.currentVal.rightBrowCurve);
      ctx.restore();
    };

    const drawTears = (ctx, s) => {
      if (s.currentVal.tearAlpha < 0.1) { s.tears = []; return; }
      if (Math.random() < 0.2) {
        const side = Math.random() > 0.5 ? 1 : -1;
        s.tears.push({ x: (DEFAULT_CONFIG.eyeGap/2) * side, y: 40, len: 5, speed: 2 + Math.random()*3 });
      }
      ctx.save(); ctx.globalAlpha = s.currentVal.tearAlpha;
      for (let i = s.tears.length - 1; i >= 0; i--) {
        let t = s.tears[i];
        t.y += t.speed; t.len += 0.2;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y + t.len); ctx.stroke();
        if (t.y > 300) s.tears.splice(i, 1);
      }
      ctx.restore();
    };

    const drawZZZ = (ctx, s) => {
        if (s.currentLogicState !== 'sleeping') {
            s.zzzs = [];
            return;
        }
        if (Math.random() < 0.03) { 
            s.zzzs.push({
                x: DEFAULT_CONFIG.eyeGap/2 + 60, 
                y: -60, 
                size: 20,
                alpha: 1,
                drift: Math.random() * 0.5 // 漂移
            });
        }
        for (let i = s.zzzs.length - 1; i >= 0; i--) {
            let z = s.zzzs[i];
            z.y -= 1; // 向上移动
            z.x += z.drift; 
            z.size += 0.2; 
            z.alpha -= 0.01; 
            if (z.alpha <= 0) {
                s.zzzs.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.fillStyle = color; 
            ctx.globalAlpha = z.alpha;
            ctx.font = `bold ${z.size}px monospace`;
            ctx.fillText("Z", z.x, z.y);
            ctx.restore();
        }
    };

    let blinkTimer;
    const blinkLoop = () => {
      let next = 2000 + Math.random() * 3000;
      if (state.currentLogicState === 'sleeping' || state.currentLogicState === 'love' || state.currentLogicState === 'starry') next = 5000;
      
      blinkTimer = setTimeout(() => {
        performBlink();
        blinkLoop();
      }, next);
    };
    const performBlink = () => {
      const duration = 150;
      const start = Date.now();
      const loop = () => {
        const now = Date.now();
        const p = (now - start) / duration;
        if (p <= 0.5) state.blinkScale = 1 - p * 2;
        else if (p <= 1) state.blinkScale = (p - 0.5) * 2;
        else { state.blinkScale = 1; return; }
        requestAnimationFrame(loop);
      };
      loop();
    };

    resize();
    window.addEventListener('resize', resize);
    requestRef.current = requestAnimationFrame(draw);
    blinkLoop();

    return () => {
      window.removeEventListener('resize', resize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (blinkTimer) clearTimeout(blinkTimer);
    };
  }, [color, expressionsData]); 

  const onMouseMove = (e) => {
      if(!canvasRef.current || !stateRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      stateRef.current.targetMouse.x = e.clientX - rect.left - stateRef.current.width / 2;
      stateRef.current.targetMouse.y = e.clientY - rect.top - stateRef.current.height / 2;
  }
  // 移除 onMouseDown 和 onMouseUp 中的表情切换逻辑
  const onMouseDown = () => {
      if (onClick) onClick();
  }

  return (
    <div 
      ref={containerRef} 
      className={`relative overflow-hidden bg-black rounded-3xl border-4 border-gray-800 shadow-2xl cursor-pointer select-none ${className}`}
      style={{ aspectRatio: '4/3' }}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute inset-0 pointer-events-none z-10 bg-scanlines" 
           style={{
             background: `linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.1) 50%)`,
             backgroundSize: '100% 4px'
           }}
      />
    </div>
  );
};

// --- 应用程序 ---

const App = () => {
  const [currentExpr, setCurrentExpr] = useState('neutral');
  const [themeColor, setThemeColor] = useState('#0ff');
  const [winkCounter, setWinkCounter] = useState(0); // 眨眼触发器

  const handleWink = () => {
    setWinkCounter(c => c + 1);
  };

  const customExpressions = {
    dizzy: {
      eyeScaleY: 1, eyeShape: 2, pupilScale: 0,
      browAngle: 0.3, browY: -70, browAlpha: 1, 
      mouthWidth: 50, mouthHeight: 30, mouthY: 90, mouthShape: 4,
      tearAlpha: 0, wink: 0
    },
    love: {
      eyeScaleY: 1, eyeShape: 3, pupilScale: 0,
      browAngle: 0, browY: -80, browAlpha: 0, 
      mouthWidth: 50, mouthHeight: 50, mouthY: 90, mouthShape: 2,
      tearAlpha: 0, wink: 0
    },
    starry: {
      eyeScaleY: 1, eyeShape: 5, pupilScale: 0, // 5 = 十字星
      browAngle: 0, browY: -80, browAlpha: 0, 
      mouthWidth: 50, mouthHeight: 50, mouthY: 90, mouthShape: 2, // O 形嘴 (O-shape mouth)
      tearAlpha: 0, wink: 0
    },
    sweat: {
      eyeScaleY: 0.4, eyeShape: 0, pupilScale: 1,
      browAngle: 0, browY: -60, browAlpha: 1, 
      mouthWidth: 40, mouthHeight: 0, mouthY: 90, mouthShape: 0,
      tearAlpha: 0, wink: 0
    },
    pouting: {
      eyeScaleY: 0.6, 
      eyeShape: 0, pupilScale: 1,
      browAngle: 0.3, browY: -70, browAlpha: 1, 
      mouthWidth: 40, // 增加宽度
      mouthHeight: 15, mouthY: 100, mouthShape: 6,
      tearAlpha: 0, wink: 0
    },
    confused: {
      eyeScaleY: 0.8, eyeShape: 0, pupilScale: 1,
      browAngle: 0, 
      browY: -95, // 眉毛上移 (更负)
      browAlpha: 1, 
      rightBrowBend: 0,
      leftBrowCurve: -30, 
      rightBrowCurve: 30,
      mouthWidth: 50, mouthHeight: 15, mouthY: 90, mouthShape: 5,
      tearAlpha: 0, wink: 0
    },
    grievance: {
      eyeScaleY: 0.9, eyeShape: 0, pupilScale: 1,
      browAngle: -0.4, browY: -70, browAlpha: 1, 
      mouthWidth: 40, mouthHeight: 20, mouthY: 100, mouthShape: 4,
      tearAlpha: 0.3, wink: 0
    },
    sleepy: {
      eyeScaleY: 0.3, eyeShape: 0, pupilScale: 0.5,
      browAngle: 0, browY: -60, browAlpha: 0, 
      mouthWidth: 30, mouthHeight: 10, mouthY: 90, mouthShape: 2,
      tearAlpha: 0, wink: 0
    },
    sleeping: {
      eyeScaleY: 1, 
      eyeShape: 4, 
      pupilScale: 0, 
      browAngle: 0, browY: -60, browAlpha: 0, 
      mouthWidth: 30, mouthHeight: 0, mouthY: 90, mouthShape: 0,
      tearAlpha: 0, wink: 0
    }
  };

  const expressionList = [
    { id: 'neutral', label: '默认' },
    { id: 'happy', label: '开心' },
    { id: 'angry', label: '生气' },
    { id: 'surprised', label: '惊讶' },
    { id: 'sad', label: '流泪' },
  ];

  const customList = [
    { id: 'uwu', label: '>w<' },
    { id: 'dizzy', label: '晕倒' },
    { id: 'love', label: '痴迷' },
    { id: 'starry', label: '🤩星星' },
    { id: 'sweat', label: '😓无语' },
    { id: 'pouting', label: '嘟嘴' },
    { id: 'confused', label: '困惑' },
    { id: 'grievance', label: '委屈' },
    { id: 'sleepy', label: '😪困' },
    { id: 'sleeping', label: '😴睡觉' },
  ];

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-mono text-gray-200">
      
      <div className="w-full max-w-2xl mb-8">
        <RobotFace 
          color={themeColor} 
          expression={currentExpr}
          customExpressions={customExpressions}
          winkTrigger={winkCounter} // 传入触发器
        />
      </div>

      <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 w-full max-w-2xl">
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-sm text-gray-400">主题颜色:</span>
          <div className="flex gap-3">
            {['#0ff', '#0f0', '#ffaa00', '#ff0055', '#a855f7'].map(c => (
              <button
                key={c}
                onClick={() => setThemeColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${themeColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}` }}
              />
            ))}
          </div>
        </div>

        <div className="h-px bg-neutral-700 w-full mb-6"></div>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {expressionList.map((expr) => (
            <button
              key={expr.id}
              onClick={() => setCurrentExpr(expr.id)}
              className={`
                px-4 py-2 rounded-lg border transition-all text-sm tracking-wider
                ${currentExpr === expr.id 
                  ? 'bg-neutral-700 border-white text-white font-bold shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                  : 'bg-neutral-900 border-neutral-600 text-gray-400 hover:bg-neutral-800 hover:border-gray-400'}
              `}
            >
              {expr.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {customList.map((expr) => (
            <button
              key={expr.id}
              onClick={() => setCurrentExpr(expr.id)}
              className={`
                px-4 py-2 rounded-lg border border-dashed transition-all text-sm tracking-wider
                ${currentExpr === expr.id 
                  ? 'bg-neutral-800 border-yellow-400 text-yellow-400 font-bold shadow-[0_0_15px_rgba(255,200,0,0.2)]' 
                  : 'bg-neutral-900 border-gray-600 text-gray-400 hover:border-yellow-600 hover:text-yellow-600'}
              `}
            >
              {expr.label}
            </button>
          ))}
        </div>

        {/* 独立动作按钮区域 */}
        <div className="flex justify-center mt-4">
          <button
            onClick={handleWink}
            className="px-6 py-2 rounded-full border border-cyan-500 text-cyan-400 hover:bg-cyan-900/30 font-bold tracking-widest transition-transform active:scale-95 shadow-[0_0_10px_rgba(0,255,255,0.3)]"
          >
            点击眨眼 😉
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;