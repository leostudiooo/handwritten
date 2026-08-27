import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point, LadderPoints } from '../types';
import { autoPredictLadderMesh } from '../utils/cvEngine';
import {
  Wand2,
  RotateCcw,
  ZoomIn,
  Move,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  HelpCircle,
  Eye,
  Info,
} from 'lucide-react';

interface LadderGridEditorProps {
  previewImg: HTMLImageElement;
  scaleRatio: number;
  ladderMesh: LadderPoints;
  onMeshChange: (newMesh: LadderPoints) => void;
  onGenerate: () => void;
  isProcessing: boolean;
  onCancel: () => void;
  scenarioNotes?: string;
}

export const LadderGridEditor: React.FC<LadderGridEditorProps> = ({
  previewImg,
  scaleRatio,
  ladderMesh,
  onMeshChange,
  onGenerate,
  isProcessing,
  onCancel,
  scenarioNotes,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState<{
    clientX: number;
    clientY: number;
    imgX: number;
    imgY: number;
  } | null>(null);

  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  const [showHelperGuides, setShowHelperGuides] = useState(true);

  // Helper point labels for user clarity
  const pointLabels = [
    'P0 (顶左)',
    'P1 (顶右)',
    'P2 (第1-2行共用)',
    'P3 (第1-2行共用)',
    'P4 (第2-3行共用)',
    'P5 (第2-3行共用)',
    'P6 (底左)',
    'P7 (底右)',
  ];

  // Resize handling
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current || !previewImg) return;
      const containerW = containerRef.current.clientWidth;
      const aspect = previewImg.naturalWidth / previewImg.naturalHeight;
      const displayW = Math.min(containerW, 960);
      const displayH = displayW / aspect;

      setCanvasDimensions({
        width: Math.round(displayW),
        height: Math.round(displayH),
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [previewImg]);

  // Coordinate transforms: between Preview Canvas coordinates and Display Screen coordinates
  const getCanvasCoordsFromEvent = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    } else {
      return null;
    }

    const scaleX = previewImg.naturalWidth / rect.width;
    const scaleY = previewImg.naturalHeight / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return { x, y };
  };

  // Convert image coord (0..naturalWidth) to canvas render display coord
  const toDisplayCoord = useCallback(
    (pt: Point): Point => {
      const scaleX = canvasDimensions.width / previewImg.naturalWidth;
      const scaleY = canvasDimensions.height / previewImg.naturalHeight;
      return {
        x: pt.x * scaleX,
        y: pt.y * scaleY,
      };
    },
    [canvasDimensions, previewImg]
  );

  // Render Canvas with Ladder Mesh overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina display support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDimensions.width * dpr;
    canvas.height = canvasDimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // 1. Draw Preview Image
    ctx.drawImage(previewImg, 0, 0, canvasDimensions.width, canvasDimensions.height);

    // 2. Convert 8 points to display space
    const dPts = ladderMesh.map(toDisplayCoord);

    // 3. Draw Row Shading & Quadrilateral fills
    const boxes = [
      { pts: [dPts[0], dPts[1], dPts[3], dPts[2]], name: '框 1 (20×100mm)', color: 'rgba(245, 158, 11, 0.12)' },
      { pts: [dPts[2], dPts[3], dPts[5], dPts[4]], name: '框 2 (20×100mm)', color: 'rgba(59, 130, 246, 0.12)' },
      { pts: [dPts[4], dPts[5], dPts[7], dPts[6]], name: '框 3 (20×100mm)', color: 'rgba(16, 185, 129, 0.12)' },
    ];

    boxes.forEach((box, idx) => {
      ctx.beginPath();
      ctx.moveTo(box.pts[0].x, box.pts[0].y);
      ctx.lineTo(box.pts[1].x, box.pts[1].y);
      ctx.lineTo(box.pts[2].x, box.pts[2].y);
      ctx.lineTo(box.pts[3].x, box.pts[3].y);
      ctx.closePath();
      ctx.fillStyle = box.color;
      ctx.fill();

      // Draw subtle row tag in center left of box
      if (showHelperGuides) {
        const midY = (box.pts[0].y + box.pts[3].y) / 2;
        const midX = (box.pts[0].x + box.pts[3].x) / 2 + 10;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(`第 ${idx + 1} 行`, midX, midY);
        ctx.shadowColor = 'transparent';
      }
    });

    // 4. Draw Ladder Grid Lines (4 Horizontal, 2 Vertical outer lines)
    ctx.lineWidth = 2.5;

    // Horizontal Lines (Bright Amber)
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([]);

    // P0-P1
    ctx.beginPath();
    ctx.moveTo(dPts[0].x, dPts[0].y);
    ctx.lineTo(dPts[1].x, dPts[1].y);
    ctx.stroke();

    // P2-P3 (Shared)
    ctx.beginPath();
    ctx.moveTo(dPts[2].x, dPts[2].y);
    ctx.lineTo(dPts[3].x, dPts[3].y);
    ctx.stroke();

    // P4-P5 (Shared)
    ctx.beginPath();
    ctx.moveTo(dPts[4].x, dPts[4].y);
    ctx.lineTo(dPts[5].x, dPts[5].y);
    ctx.stroke();

    // P6-P7
    ctx.beginPath();
    ctx.moveTo(dPts[6].x, dPts[6].y);
    ctx.lineTo(dPts[7].x, dPts[7].y);
    ctx.stroke();

    // Outer Vertical Boundary Lines (Left & Right)
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;

    // Left outer line: P0 -> P2 -> P4 -> P6
    ctx.beginPath();
    ctx.moveTo(dPts[0].x, dPts[0].y);
    ctx.lineTo(dPts[2].x, dPts[2].y);
    ctx.lineTo(dPts[4].x, dPts[4].y);
    ctx.lineTo(dPts[6].x, dPts[6].y);
    ctx.stroke();

    // Right outer line: P1 -> P3 -> P5 -> P7
    ctx.beginPath();
    ctx.moveTo(dPts[1].x, dPts[1].y);
    ctx.lineTo(dPts[3].x, dPts[3].y);
    ctx.lineTo(dPts[5].x, dPts[5].y);
    ctx.lineTo(dPts[7].x, dPts[7].y);
    ctx.stroke();

    // 5. Draw 8 Interactive Anchor Points
    dPts.forEach((pt, idx) => {
      const isActive = activePointIndex === idx;
      const isHovered = hoveredPointIndex === idx;
      const radius = isActive ? 12 : isHovered ? 10 : 8;

      // Outer glow / shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;

      // Outer ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#ef4444' : '#1e293b';
      ctx.fill();

      // Inner fill
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#fee2e2' : '#fbbf24';
      ctx.fill();

      // Center dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      ctx.shadowColor = 'transparent';

      // Anchor Point ID Label Tag
      if (showHelperGuides || isActive) {
        ctx.fillStyle = isActive ? '#991b1b' : '#334155';
        ctx.font = 'bold 10px monospace';
        const labelText = `P${idx}`;
        const offset = idx % 2 === 0 ? -18 : 12;
        ctx.fillText(labelText, pt.x + offset, pt.y - 10);
      }
    });
  }, [canvasDimensions, previewImg, ladderMesh, activePointIndex, hoveredPointIndex, showHelperGuides, toDisplayCoord]);

  // Find nearest anchor point within threshold (touch radius 28px)
  const findNearestPoint = (imgPt: Point): number | null => {
    const dprX = canvasDimensions.width / previewImg.naturalWidth;
    const dprY = canvasDimensions.height / previewImg.naturalHeight;
    const touchThreshold = 32 / dprX; // 32 display pixels

    let closestIdx: number | null = null;
    let minDistance = Infinity;

    ladderMesh.forEach((pt, idx) => {
      const dist = Math.hypot(pt.x - imgPt.x, pt.y - imgPt.y);
      if (dist < touchThreshold && dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    return closestIdx;
  };

  // Pointer / Touch Start
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasCoordsFromEvent(e);
    if (!pt) return;

    const hitIdx = findNearestPoint(pt);
    if (hitIdx !== null) {
      setActivePointIndex(hitIdx);
      setIsDragging(true);

      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      setMagnifierPos({
        clientX,
        clientY,
        imgX: pt.x,
        imgY: pt.y,
      });
    }
  };

  // Pointer / Touch Move
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasCoordsFromEvent(e);
    if (!pt) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    if (isDragging && activePointIndex !== null) {
      // Clamp coordinates inside image boundary
      const clampedX = Math.max(0, Math.min(previewImg.naturalWidth, pt.x));
      const clampedY = Math.max(0, Math.min(previewImg.naturalHeight, pt.y));

      const updatedMesh = [...ladderMesh] as LadderPoints;
      updatedMesh[activePointIndex] = { x: Math.round(clampedX), y: Math.round(clampedY) };
      onMeshChange(updatedMesh);

      setMagnifierPos({
        clientX,
        clientY,
        imgX: clampedX,
        imgY: clampedY,
      });
    } else {
      // Hover detection for desktop
      const hitIdx = findNearestPoint(pt);
      setHoveredPointIndex(hitIdx);
    }
  };

  // Pointer / Touch End
  const handlePointerUp = () => {
    setIsDragging(false);
    setMagnifierPos(null);
  };

  // Auto-Predict Mesh with edge gradients
  const handleAutoPredict = () => {
    const canvas = document.createElement('canvas');
    canvas.width = previewImg.naturalWidth;
    canvas.height = previewImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(previewImg, 0, 0);
    const imgData = ctx.getImageData(0, 0, previewImg.naturalWidth, previewImg.naturalHeight);

    const predicted = autoPredictLadderMesh(
      previewImg.naturalWidth,
      previewImg.naturalHeight,
      imgData
    );
    onMeshChange(predicted);
  };

  // Reset to default centered 80% mesh
  const handleResetMesh = () => {
    const defaultMesh = autoPredictLadderMesh(
      previewImg.naturalWidth,
      previewImg.naturalHeight
    );
    onMeshChange(defaultMesh);
  };

  // Micro Nudge for selected active anchor (1px / 5px)
  const handleNudge = (dx: number, dy: number) => {
    const targetIdx = activePointIndex ?? 0;
    const updated = [...ladderMesh] as LadderPoints;
    const cur = updated[targetIdx];
    updated[targetIdx] = {
      x: Math.max(0, Math.min(previewImg.naturalWidth, cur.x + dx)),
      y: Math.max(0, Math.min(previewImg.naturalHeight, cur.y + dy)),
    };
    onMeshChange(updated);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 py-2 select-none">
      {/* Scenario Guidance Banner if preset active */}
      {scenarioNotes && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold mr-1">验收标准指引:</span>
            {scenarioNotes}
          </div>
        </div>
      )}

      {/* Editor Control Toolbar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="editor-autopredict-btn"
            type="button"
            onClick={handleAutoPredict}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            自动识别边框 (Auto-Predict)
          </button>

          <button
            id="editor-reset-mesh-btn"
            type="button"
            onClick={handleResetMesh}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors border border-stone-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置默认网格
          </button>

          <button
            type="button"
            onClick={() => setShowHelperGuides(!showHelperGuides)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
              showHelperGuides
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-stone-50 text-stone-600 border-stone-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {showHelperGuides ? '隐藏锚点编号' : '显示锚点编号'}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            id="editor-cancel-btn"
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl text-xs font-medium transition-colors border border-stone-200"
          >
            返回
          </button>

          <button
            id="editor-generate-btn"
            type="button"
            onClick={onGenerate}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Web Worker 处理中...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>生成标准化素材</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Canvas Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Interactive Canvas Viewport */}
        <div
          ref={containerRef}
          className="lg:col-span-3 bg-stone-900 rounded-2xl p-2 sm:p-4 shadow-sm border border-stone-800 flex items-center justify-center relative overflow-hidden min-h-[460px]"
        >
          <canvas
            ref={canvasRef}
            id="ladder-grid-canvas"
            style={{
              width: canvasDimensions.width,
              height: canvasDimensions.height,
              touchAction: 'none',
              cursor: isDragging ? 'grabbing' : activePointIndex !== null ? 'grab' : 'crosshair',
            }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
            className="rounded-xl shadow-lg border border-stone-700/50"
          />

          {/* Floating 2x Magnifier Loupe (手指上方 50px 悬浮 2 倍放大镜) */}
          {magnifierPos && (
            <div
              id="magnifier-loupe"
              style={{
                position: 'fixed',
                left: `${magnifierPos.clientX}px`,
                top: `${magnifierPos.clientY - 90}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 9999,
              }}
              className="w-28 h-28 rounded-full border-3 border-white shadow-2xl overflow-hidden bg-stone-950 ring-2 ring-stone-900/50"
            >
              {/* Magnified Canvas */}
              <canvas
                ref={(loupeCanvas) => {
                  if (!loupeCanvas || !previewImg) return;
                  const loupeSize = 112; // 28 * 4
                  loupeCanvas.width = loupeSize;
                  loupeCanvas.height = loupeSize;
                  const ctx = loupeCanvas.getContext('2d');
                  if (!ctx) return;

                  const zoom = 2.4; // 2.4x magnification
                  const srcW = loupeSize / zoom;
                  const srcH = loupeSize / zoom;
                  const srcX = magnifierPos.imgX - srcW / 2;
                  const srcY = magnifierPos.imgY - srcH / 2;

                  ctx.imageSmoothingEnabled = true;
                  ctx.drawImage(
                    previewImg,
                    srcX,
                    srcY,
                    srcW,
                    srcH,
                    0,
                    0,
                    loupeSize,
                    loupeSize
                  );

                  // Precision Crosshair (十字准星)
                  const center = loupeSize / 2;
                  ctx.strokeStyle = '#ef4444';
                  ctx.lineWidth = 1.5;

                  // Center cross
                  ctx.beginPath();
                  ctx.moveTo(center - 16, center);
                  ctx.lineTo(center + 16, center);
                  ctx.moveTo(center, center - 16);
                  ctx.lineTo(center, center + 16);
                  ctx.stroke();

                  // Center circle target
                  ctx.beginPath();
                  ctx.arc(center, center, 4, 0, Math.PI * 2);
                  ctx.strokeStyle = '#ffffff';
                  ctx.stroke();
                }}
                className="w-full h-full"
              />
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/75 px-1.5 py-0.5 rounded text-[9px] text-white font-mono font-bold">
                2× 放大
              </div>
            </div>
          )}

          {/* Interactive Hint */}
          <div className="absolute bottom-3 left-4 bg-stone-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-stone-300 border border-stone-700/60 hidden sm:flex items-center gap-2">
            <Move className="w-3 h-3 text-amber-400" />
            <span>拖拽 8 个黄色锚点对齐手绘框外边缘，拖动时自动触发顶部 2× 放大镜</span>
          </div>
        </div>

        {/* Anchor Selector & Fine-tuning D-Pad Panel */}
        <div className="space-y-4">
          {/* Active Point Selector & Status Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-stone-900 mb-3 flex items-center justify-between">
              <span>8 点阶梯锚点选择</span>
              <span className="text-[10px] font-normal text-stone-500">
                当前选中: P{activePointIndex ?? 0}
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {ladderMesh.map((pt, idx) => {
                const isSelected = activePointIndex === idx;
                return (
                  <button
                    key={idx}
                    id={`select-anchor-P${idx}`}
                    type="button"
                    onClick={() => setActivePointIndex(idx)}
                    className={`text-left p-2 rounded-xl text-xs font-mono transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500 text-stone-900 border-amber-600 font-bold shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <span>P{idx}</span>
                    <span className="text-[10px] opacity-75">
                      ({Math.round(pt.x)}, {Math.round(pt.y)})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* D-Pad Micro Adjustment for Mobile & High Precision */}
            <div className="border-t border-stone-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-stone-800">
                  微调移动 (P{activePointIndex ?? 0})
                </span>
                <span className="text-[10px] text-stone-400">支持键盘方向键</span>
              </div>

              <div className="flex flex-col items-center gap-1.5 my-2">
                <button
                  id="nudge-up-btn"
                  type="button"
                  onClick={() => handleNudge(0, -3)}
                  className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg shadow-xs active:bg-stone-300 transition-colors"
                  title="向上微调 3px"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    id="nudge-left-btn"
                    type="button"
                    onClick={() => handleNudge(-3, 0)}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg shadow-xs active:bg-stone-300 transition-colors"
                    title="向左微调 3px"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                    P{activePointIndex ?? 0}
                  </div>
                  <button
                    id="nudge-right-btn"
                    type="button"
                    onClick={() => handleNudge(3, 0)}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg shadow-xs active:bg-stone-300 transition-colors"
                    title="向右微调 3px"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  id="nudge-down-btn"
                  type="button"
                  onClick={() => handleNudge(0, 3)}
                  className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg shadow-xs active:bg-stone-300 transition-colors"
                  title="向下微调 3px"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Structure Logic Card */}
          <div className="bg-stone-50 rounded-2xl border border-stone-200 p-3.5 text-xs text-stone-600 space-y-2">
            <h4 className="font-bold text-stone-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
              8 点连体阶梯联动规则
            </h4>
            <p className="text-[11px] leading-relaxed">
              <strong>P2 / P3</strong> 为 Box 1 与 Box 2 的共享点；<strong>P4 / P5</strong> 为 Box 2 与 Box 3 的共享点。拖拽中间点保证多行之间无缝连接并自动消除纵向卷曲畸变。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
