import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point, LadderPoints, ProcessingConfig } from '../types';
import {
  autoPredictLadderMesh,
  interpolateLadderPoints,
  unprojectToPerspectiveRatio,
} from '../utils/cvEngine';
import {
  Wand2,
  RotateCcw,
  Move,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Eye,
  Info,
  Link,
  Unlink,
  Split,
  Sliders,
  MoveVertical,
  Layers,
} from 'lucide-react';

interface LadderGridEditorProps {
  previewImg: HTMLImageElement;
  scaleRatio: number;
  ladderMesh: LadderPoints;
  config?: ProcessingConfig;
  onMeshChange: (newMesh: LadderPoints) => void;
  onConfigChange?: (newConfig: ProcessingConfig) => void;
  onGenerate: () => void;
  isProcessing: boolean;
  onCancel: () => void;
  scenarioNotes?: string;
}

// Compute distance from point to line segment
function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

export const LadderGridEditor: React.FC<LadderGridEditorProps> = ({
  previewImg,
  scaleRatio: _scaleRatio,
  ladderMesh,
  config,
  onMeshChange,
  onConfigChange,
  onGenerate,
  isProcessing,
  onCancel,
  scenarioNotes,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Derive row count from mesh length or config
  const rowCount = Math.max(1, Math.round(ladderMesh.length / 2 - 1));
  const botLeftIdx = rowCount * 2;
  const botRightIdx = rowCount * 2 + 1;

  const [activePointIndex, setActivePointIndex] = useState<number | null>(0);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Midline dragging states (1 .. rowCount-1)
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [linkIntermediateToCorners, setLinkIntermediateToCorners] = useState(true);

  // Dynamic perspective ratios for all intermediate lines (1 .. rowCount - 1)
  const [lineRatios, setLineRatios] = useState<number[]>(() => {
    const ratios: number[] = [];
    for (let i = 1; i < rowCount; i++) {
      ratios.push(i / rowCount);
    }
    return ratios;
  });

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

  // Categorize 4 Outer Corners vs Intermediate Subdividers
  const isCornerPoint = (idx: number) =>
    idx === 0 || idx === 1 || idx === botLeftIdx || idx === botRightIdx;

  // Responsive Canvas Size handling
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current || !previewImg) return;
      const containerWidth = containerRef.current.clientWidth - 32;
      const maxCanvasHeight = Math.min(window.innerHeight * 0.65, 560);

      const imgAspect = previewImg.naturalWidth / previewImg.naturalHeight;

      let targetW = containerWidth;
      let targetH = targetW / imgAspect;

      if (targetH > maxCanvasHeight) {
        targetH = maxCanvasHeight;
        targetW = targetH * imgAspect;
      }

      setCanvasDimensions({
        width: Math.floor(targetW),
        height: Math.floor(targetH),
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [previewImg]);

  // Sync midline perspective ratios when mesh updates externally or row count changes
  useEffect(() => {
    if (ladderMesh && ladderMesh.length === (rowCount + 1) * 2) {
      const p0 = ladderMesh[0];
      const p1 = ladderMesh[1];
      const p_botL = ladderMesh[botLeftIdx];
      const p_botR = ladderMesh[botRightIdx];
      const newRatios: number[] = [];

      for (let k = 1; k < rowCount; k++) {
        const leftP = ladderMesh[2 * k];
        const rightP = ladderMesh[2 * k + 1];
        const mid = { x: (leftP.x + rightP.x) / 2, y: (leftP.y + rightP.y) / 2 };
        const r = unprojectToPerspectiveRatio(mid, p0, p1, p_botL, p_botR, rowCount * 20);
        newRatios.push(!isNaN(r) && r > 0.02 && r < 0.98 ? r : k / rowCount);
      }
      setLineRatios(newRatios);
    }
  }, [ladderMesh, rowCount, botLeftIdx, botRightIdx]);

  // Get pointer coordinate in image pixel space
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

  // Convert image coordinate to canvas render display coordinate
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

  // Update a single control point (and optionally re-calculate perspective midlines if corner moved)
  const updatePointAndMesh = useCallback(
    (pointIdx: number, newPt: Point, autoInterpolate: boolean = linkIntermediateToCorners) => {
      const updatedMesh = [...ladderMesh] as LadderPoints;
      updatedMesh[pointIdx] = newPt;

      if (autoInterpolate && isCornerPoint(pointIdx) && rowCount > 1) {
        const recomputed = interpolateLadderPoints(
          updatedMesh[0],
          updatedMesh[1],
          updatedMesh[botLeftIdx],
          updatedMesh[botRightIdx],
          rowCount,
          lineRatios
        );
        for (let i = 2; i < botLeftIdx; i++) {
          updatedMesh[i] = recomputed[i];
        }
      }

      onMeshChange(updatedMesh);
    },
    [ladderMesh, linkIntermediateToCorners, lineRatios, onMeshChange, rowCount, botLeftIdx, botRightIdx]
  );

  // Shift an entire midline along paper perspective
  const updateMidlineRatio = useCallback(
    (lineIdx: number, newRatio: number) => {
      if (lineIdx < 1 || lineIdx >= rowCount) return;

      const p0 = ladderMesh[0];
      const p1 = ladderMesh[1];
      const p_botL = ladderMesh[botLeftIdx];
      const p_botR = ladderMesh[botRightIdx];

      const minBound = lineIdx === 1 ? 0.05 : lineRatios[lineIdx - 2] + 0.04;
      const maxBound = lineIdx === rowCount - 1 ? 0.95 : lineRatios[lineIdx] - 0.04;
      const clampedRatio = Math.max(minBound, Math.min(maxBound, newRatio));

      const updatedRatios = [...lineRatios];
      updatedRatios[lineIdx - 1] = clampedRatio;
      setLineRatios(updatedRatios);

      const recomputed = interpolateLadderPoints(
        p0,
        p1,
        p_botL,
        p_botR,
        rowCount,
        updatedRatios
      );
      onMeshChange(recomputed);
    },
    [ladderMesh, lineRatios, onMeshChange, rowCount, botLeftIdx, botRightIdx]
  );

  // Change Row Count and re-interpolate mesh
  const handleRowCountChange = (newRowCount: number) => {
    if (newRowCount === rowCount) return;

    const p0 = ladderMesh[0];
    const p1 = ladderMesh[1];
    const p_botL = ladderMesh[botLeftIdx];
    const p_botR = ladderMesh[botRightIdx];

    const newMesh = interpolateLadderPoints(p0, p1, p_botL, p_botR, newRowCount);
    const newRatios: number[] = [];
    for (let i = 1; i < newRowCount; i++) {
      newRatios.push(i / newRowCount);
    }
    setLineRatios(newRatios);
    setActivePointIndex(0);
    setActiveLineIndex(null);
    onMeshChange(newMesh);

    if (onConfigChange && config) {
      onConfigChange({
        ...config,
        rowCount: newRowCount,
      });
    }
  };

  // Re-interpolate intermediate points from current 4 corners with equal standard ratios
  const handleReinterpolateFromCorners = () => {
    const defaultRatios: number[] = [];
    for (let i = 1; i < rowCount; i++) {
      defaultRatios.push(i / rowCount);
    }
    setLineRatios(defaultRatios);

    const updated = interpolateLadderPoints(
      ladderMesh[0],
      ladderMesh[1],
      ladderMesh[botLeftIdx],
      ladderMesh[botRightIdx],
      rowCount,
      defaultRatios
    );
    onMeshChange(updated);
  };

  // Keyboard navigation for precision fine-tuning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeLineIndex !== null) {
        const step = e.shiftKey ? 0.02 : 0.005;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          updateMidlineRatio(activeLineIndex, lineRatios[activeLineIndex - 1] - step);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          updateMidlineRatio(activeLineIndex, lineRatios[activeLineIndex - 1] + step);
        }
        return;
      }

      if (activePointIndex === null) return;
      const step = e.shiftKey ? 6 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else return;

      e.preventDefault();
      const cur = ladderMesh[activePointIndex];
      const newPt: Point = {
        x: Math.max(0, Math.min(previewImg.naturalWidth, cur.x + dx)),
        y: Math.max(0, Math.min(previewImg.naturalHeight, cur.y + dy)),
      };
      updatePointAndMesh(activePointIndex, newPt);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activePointIndex,
    activeLineIndex,
    ladderMesh,
    previewImg,
    lineRatios,
    updatePointAndMesh,
    updateMidlineRatio,
  ]);

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

    // 2. Convert points to display space
    const dPts = ladderMesh.map(toDisplayCoord);

    // 3. Draw Row Shading & Quadrilateral fills
    const rowColors = [
      'rgba(245, 158, 11, 0.14)',
      'rgba(59, 130, 246, 0.14)',
      'rgba(16, 185, 129, 0.14)',
      'rgba(168, 85, 247, 0.14)',
      'rgba(236, 72, 153, 0.14)',
      'rgba(20, 184, 166, 0.14)',
    ];

    for (let r = 0; r < rowCount; r++) {
      const pTopL = dPts[r * 2];
      const pTopR = dPts[r * 2 + 1];
      const pBotL = dPts[(r + 1) * 2];
      const pBotR = dPts[(r + 1) * 2 + 1];

      if (!pTopL || !pTopR || !pBotL || !pBotR) continue;

      ctx.beginPath();
      ctx.moveTo(pTopL.x, pTopL.y);
      ctx.lineTo(pTopR.x, pTopR.y);
      ctx.lineTo(pBotR.x, pBotR.y);
      ctx.lineTo(pBotL.x, pBotL.y);
      ctx.closePath();
      ctx.fillStyle = rowColors[r % rowColors.length];
      ctx.fill();

      // Row title tag
      if (showHelperGuides) {
        const midY = (pTopL.y + pBotL.y) / 2;
        const midX = (pTopL.x + pBotL.x) / 2 + 10;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(`第 ${r + 1} 行 (100×20mm)`, midX, midY);
        ctx.shadowColor = 'transparent';
      }
    }

    // 4. Draw Outer & Intermediate Lines
    // Top Boundary Line (P0-P1)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(dPts[0].x, dPts[0].y);
    ctx.lineTo(dPts[1].x, dPts[1].y);
    ctx.stroke();

    // Intermediate Divider Lines
    for (let k = 1; k < rowCount; k++) {
      const leftP = dPts[2 * k];
      const rightP = dPts[2 * k + 1];
      if (!leftP || !rightP) continue;

      const isLineActive = activeLineIndex === k || hoveredLineIndex === k;
      ctx.lineWidth = isLineActive ? 4 : 2.5;
      ctx.strokeStyle = isLineActive ? '#38bdf8' : '#0284c7';
      ctx.beginPath();
      ctx.moveTo(leftP.x, leftP.y);
      ctx.lineTo(rightP.x, rightP.y);
      ctx.stroke();
    }

    // Bottom Boundary Line (P_botL - P_botR)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(dPts[botLeftIdx].x, dPts[botLeftIdx].y);
    ctx.lineTo(dPts[botRightIdx].x, dPts[botRightIdx].y);
    ctx.stroke();

    // Outer Left Boundary Line
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dPts[0].x, dPts[0].y);
    for (let k = 1; k <= rowCount; k++) {
      const p = dPts[k * 2];
      if (p) ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Outer Right Boundary Line
    ctx.beginPath();
    ctx.moveTo(dPts[1].x, dPts[1].y);
    for (let k = 1; k <= rowCount; k++) {
      const p = dPts[k * 2 + 1];
      if (p) ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // 5. Draw Draggable Handle Pills on Intermediate Lines
    const drawMidlineHandle = (
      ptA: Point,
      ptB: Point,
      label: string,
      isActive: boolean,
      isHovered: boolean
    ) => {
      const midX = (ptA.x + ptB.x) / 2;
      const midY = (ptA.y + ptB.y) / 2;
      const pillW = 94;
      const pillH = 22;

      ctx.save();
      ctx.translate(midX, midY);

      // Pill Background
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(-pillW / 2, -pillH / 2, pillW, pillH, 11);
      ctx.fillStyle = isActive ? '#0284c7' : isHovered ? '#0369a1' : 'rgba(15, 23, 42, 0.88)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isActive || isHovered ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)';
      ctx.stroke();

      // Pill Text & Icon
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⇕ ${label}`, 0, 0);
      ctx.restore();
    };

    for (let k = 1; k < rowCount; k++) {
      const leftP = dPts[2 * k];
      const rightP = dPts[2 * k + 1];
      if (leftP && rightP) {
        drawMidlineHandle(
          leftP,
          rightP,
          `中线${k} 平移`,
          activeLineIndex === k,
          hoveredLineIndex === k
        );
      }
    }

    // 6. Draw Interactive Anchor Points
    dPts.forEach((pt, idx) => {
      const isActive = activePointIndex === idx;
      const isHovered = hoveredPointIndex === idx;
      const isCorner = isCornerPoint(idx);

      const radius = isCorner
        ? isActive ? 13 : isHovered ? 11 : 9
        : isActive ? 10 : isHovered ? 9 : 7;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 6;

      if (isCorner) {
        // CORNER POINT: Bold Gold Accent
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#dc2626' : '#1e293b';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#fee2e2' : '#f59e0b';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#991b1b' : '#ffffff';
        ctx.fill();
      } else {
        // INTERMEDIATE POINT: Blue/Sky Accent
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#dc2626' : '#334155';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#fee2e2' : '#38bdf8';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#991b1b' : '#0f172a';
        ctx.fill();
      }

      ctx.shadowColor = 'transparent';

      // Anchor Point ID Label Tag
      if (showHelperGuides || isActive) {
        ctx.fillStyle = isActive ? '#b91c1c' : isCorner ? '#d97706' : '#0284c7';
        ctx.font = isCorner ? 'bold 10.5px monospace' : 'bold 9.5px monospace';
        const labelText = isCorner ? `★P${idx}` : `P${idx}`;
        const offset = idx % 2 === 0 ? -22 : 12;
        ctx.fillText(labelText, pt.x + offset, pt.y - (isCorner ? 11 : 8));
      }
    });
  }, [
    canvasDimensions,
    previewImg,
    ladderMesh,
    activePointIndex,
    hoveredPointIndex,
    activeLineIndex,
    hoveredLineIndex,
    showHelperGuides,
    toDisplayCoord,
    rowCount,
    botLeftIdx,
    botRightIdx,
  ]);

  // Find nearest anchor point within threshold (touch radius 34px)
  const findNearestPoint = (imgPt: Point): number | null => {
    const dprX = canvasDimensions.width / previewImg.naturalWidth;
    const touchThreshold = 34 / dprX;

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

  // Find nearest midline within threshold
  const findNearestMidline = (imgPt: Point): number | null => {
    const dprX = canvasDimensions.width / previewImg.naturalWidth;
    const lineThreshold = 24 / dprX;

    let closestLine: number | null = null;
    let minDist = Infinity;

    for (let k = 1; k < rowCount; k++) {
      const leftP = ladderMesh[2 * k];
      const rightP = ladderMesh[2 * k + 1];
      if (!leftP || !rightP) continue;

      const d = distToSegment(imgPt, leftP, rightP);
      if (d < lineThreshold && d < minDist) {
        minDist = d;
        closestLine = k;
      }
    }

    return closestLine;
  };

  // Pointer / Touch Start
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasCoordsFromEvent(e);
    if (!pt) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    // 1. Point hit test
    const hitIdx = findNearestPoint(pt);
    if (hitIdx !== null) {
      setActivePointIndex(hitIdx);
      setActiveLineIndex(null);
      setIsDragging(true);

      setMagnifierPos({
        clientX,
        clientY,
        imgX: pt.x,
        imgY: pt.y,
      });
      return;
    }

    // 2. Midline hit test
    const hitLine = findNearestMidline(pt);
    if (hitLine !== null) {
      setActiveLineIndex(hitLine);
      setActivePointIndex(null);
      setIsDragging(true);

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

    if (isDragging) {
      if (activePointIndex !== null) {
        // Dragging individual point
        const clampedX = Math.max(0, Math.min(previewImg.naturalWidth, pt.x));
        const clampedY = Math.max(0, Math.min(previewImg.naturalHeight, pt.y));

        const newPoint: Point = { x: Math.round(clampedX), y: Math.round(clampedY) };
        updatePointAndMesh(activePointIndex, newPoint);

        setMagnifierPos({
          clientX,
          clientY,
          imgX: clampedX,
          imgY: clampedY,
        });
      } else if (activeLineIndex !== null) {
        // Dragging midline along perspective axis
        const p0 = ladderMesh[0];
        const p1 = ladderMesh[1];
        const p_botL = ladderMesh[botLeftIdx];
        const p_botR = ladderMesh[botRightIdx];

        const ratio = unprojectToPerspectiveRatio(pt, p0, p1, p_botL, p_botR, rowCount * 20);
        updateMidlineRatio(activeLineIndex, ratio);

        setMagnifierPos({
          clientX,
          clientY,
          imgX: pt.x,
          imgY: pt.y,
        });
      }
    } else {
      // Hover detection
      const hitIdx = findNearestPoint(pt);
      setHoveredPointIndex(hitIdx);

      if (hitIdx === null) {
        const hitLine = findNearestMidline(pt);
        setHoveredLineIndex(hitLine);
      } else {
        setHoveredLineIndex(null);
      }
    }
  };

  // Pointer / Touch End
  const handlePointerUp = () => {
    setIsDragging(false);
    setMagnifierPos(null);
  };

  // Auto-Predict Mesh with current rowCount
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
      imgData,
      rowCount
    );
    const defaultRatios: number[] = [];
    for (let i = 1; i < rowCount; i++) {
      defaultRatios.push(i / rowCount);
    }
    setLineRatios(defaultRatios);
    onMeshChange(predicted);
  };

  // Reset to default centered mesh
  const handleResetMesh = () => {
    const defaultMesh = autoPredictLadderMesh(
      previewImg.naturalWidth,
      previewImg.naturalHeight,
      undefined,
      rowCount
    );
    const defaultRatios: number[] = [];
    for (let i = 1; i < rowCount; i++) {
      defaultRatios.push(i / rowCount);
    }
    setLineRatios(defaultRatios);
    onMeshChange(defaultMesh);
  };

  // Micro Nudge for selected active anchor / midline (1px / 3px)
  const handleNudge = (dx: number, dy: number) => {
    if (activePointIndex !== null) {
      const cur = ladderMesh[activePointIndex];
      const newPt: Point = {
        x: Math.max(0, Math.min(previewImg.naturalWidth, cur.x + dx)),
        y: Math.max(0, Math.min(previewImg.naturalHeight, cur.y + dy)),
      };
      updatePointAndMesh(activePointIndex, newPt);
    } else if (activeLineIndex !== null) {
      const step = (dy / canvasDimensions.height) * 0.5;
      updateMidlineRatio(activeLineIndex, lineRatios[activeLineIndex - 1] + step);
    }
  };

  // Corner point indices
  const cornerIndices = [0, 1, botLeftIdx, botRightIdx];

  // Intermediate point indices
  const intermediateIndices: number[] = [];
  for (let i = 2; i < botLeftIdx; i++) {
    intermediateIndices.push(i);
  }

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
          {/* Row Count Quick Selector */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
            <span className="text-[11px] font-bold text-stone-600 px-1.5 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-stone-500" />
              行数:
            </span>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleRowCountChange(num)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  rowCount === num
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
                }`}
                title={`切换为 ${num} 行模版`}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            id="editor-autopredict-btn"
            type="button"
            onClick={handleAutoPredict}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            自动识别四角 (Auto-Predict)
          </button>

          {rowCount > 1 && (
            <button
              id="editor-reinterpolate-btn"
              type="button"
              onClick={handleReinterpolateFromCorners}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-semibold transition-colors border border-amber-200"
              title="根据当前 4 个最外角点与模板比例，重新按纸张透视计算所有中线位置"
            >
              <Split className="w-3.5 h-3.5 text-amber-600" />
              透视标准等分 (1:1等分)
            </button>
          )}

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
            {showHelperGuides ? '隐藏编号' : '显示编号'}
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
                <span>处理中...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>生成标准化素材 ({rowCount} 行)</span>
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
              cursor: isDragging
                ? 'grabbing'
                : hoveredLineIndex !== null
                ? 'ns-resize'
                : hoveredPointIndex !== null
                ? 'grab'
                : 'crosshair',
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

          {/* Floating 2.4x Magnifier Loupe */}
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
              <canvas
                ref={(loupeCanvas) => {
                  if (!loupeCanvas || !previewImg) return;
                  const loupeSize = 112;
                  loupeCanvas.width = loupeSize;
                  loupeCanvas.height = loupeSize;
                  const ctx = loupeCanvas.getContext('2d');
                  if (!ctx) return;

                  const zoom = 2.4;
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

                  // Precision Crosshair
                  const center = loupeSize / 2;
                  ctx.strokeStyle = '#ef4444';
                  ctx.lineWidth = 1.5;

                  ctx.beginPath();
                  ctx.moveTo(center - 16, center);
                  ctx.lineTo(center + 16, center);
                  ctx.moveTo(center, center - 16);
                  ctx.lineTo(center, center + 16);
                  ctx.stroke();

                  ctx.beginPath();
                  ctx.arc(center, center, 4, 0, Math.PI * 2);
                  ctx.strokeStyle = '#fbbf24';
                  ctx.lineWidth = 1;
                  ctx.stroke();
                }}
                className="w-full h-full"
              />
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/75 px-1.5 py-0.5 rounded text-[9px] text-white font-mono font-bold">
                2.4× 放大
              </div>
            </div>
          )}

          {/* Interactive Hint */}
          <div className="absolute bottom-3 left-4 bg-stone-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-stone-200 border border-stone-700/60 hidden sm:flex items-center gap-2">
            <Move className="w-3 h-3 text-amber-400" />
            <span>
              ① 调整 4 个黄色外角点自动计算透视；② 直接拖动<strong>「中线平移」</strong>滑块沿透视整体移动；③ 拖拽单个蓝点微调
            </span>
          </div>
        </div>

        {/* Right Sidebar Control Panel */}
        <div className="space-y-3">
          {/* Active Point Selector & Status Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <span>网格控制面板</span>
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-stone-100 rounded text-stone-700 border border-stone-200">
                {activeLineIndex !== null
                  ? `选中: 中线 ${activeLineIndex}`
                  : `选中: P${activePointIndex ?? 0}`}
              </span>
            </div>

            {/* Corner linkage toggle */}
            {rowCount > 1 && (
              <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {linkIntermediateToCorners ? (
                    <Link className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Unlink className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span className="text-xs font-bold text-amber-950">角点透视联动</span>
                </div>
                <button
                  type="button"
                  id="toggle-corner-linkage-btn"
                  onClick={() => setLinkIntermediateToCorners(!linkIntermediateToCorners)}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                    linkIntermediateToCorners
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {linkIntermediateToCorners ? '已开启' : '已关闭'}
                </button>
              </div>
            )}

            {/* Step 1: 4 Outer Corners (Highest Priority) */}
            <div>
              <div className="text-[11px] font-bold text-amber-900 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  1. 四个最外角点 (透视基准)
                </span>
                <span className="text-[10px] text-amber-700 font-normal">计算纸张透视</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {cornerIndices.map((idx) => {
                  const pt = ladderMesh[idx];
                  if (!pt) return null;
                  const isSelected = activePointIndex === idx && activeLineIndex === null;
                  const isTop = idx === 0 || idx === 1;
                  const isLeft = idx % 2 === 0;
                  const desc = `${isTop ? '顶' : '底'}${isLeft ? '左' : '右'}角点`;
                  return (
                    <button
                      key={idx}
                      id={`select-anchor-P${idx}`}
                      type="button"
                      onClick={() => {
                        setActivePointIndex(idx);
                        setActiveLineIndex(null);
                      }}
                      className={`text-left p-2 rounded-xl text-xs transition-all border flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500 text-stone-900 border-amber-600 font-bold shadow-xs'
                          : 'bg-amber-50/40 text-stone-800 border-amber-200/70 hover:bg-amber-100/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold">★ P{idx}</span>
                        <span className="text-[10px] opacity-80">{desc}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-75 mt-0.5">
                        ({Math.round(pt.x)}, {Math.round(pt.y)})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Midline Perspective Translation (整体沿透视平移) */}
            {rowCount > 1 && (
              <div className="border-t border-stone-100 pt-2.5 space-y-2">
                <div className="text-[11px] font-bold text-sky-950 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MoveVertical className="w-3.5 h-3.5 text-sky-600" />
                    2. 中线透视整体平移 ({rowCount - 1} 条)
                  </span>
                  <button
                    type="button"
                    onClick={handleReinterpolateFromCorners}
                    className="text-[10px] text-sky-700 hover:text-sky-900 underline font-normal"
                  >
                    恢复标准等分
                  </button>
                </div>

                {/* Sliders for each intermediate line */}
                {Array.from({ length: rowCount - 1 }, (_, i) => i + 1).map((lineIdx) => {
                  const ratio = lineRatios[lineIdx - 1] ?? lineIdx / rowCount;
                  const isSelected = activeLineIndex === lineIdx;
                  return (
                    <div
                      key={lineIdx}
                      onClick={() => {
                        setActiveLineIndex(lineIdx);
                        setActivePointIndex(null);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-400'
                          : 'bg-stone-50 border-stone-200 hover:bg-stone-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-stone-800 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-sky-500" />
                          中线 {lineIdx} (P{2 * lineIdx}-P{2 * lineIdx + 1} 行{lineIdx}-{lineIdx + 1}共用)
                        </span>
                        <span className="font-mono text-[11px] text-sky-700 font-bold">
                          {(ratio * 100).toFixed(1)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="95"
                        value={Math.round(ratio * 100)}
                        onChange={(e) => updateMidlineRatio(lineIdx, Number(e.target.value) / 100)}
                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step 3: Single Point Micro-Adjustment */}
            {intermediateIndices.length > 0 && (
              <div className="border-t border-stone-100 pt-2.5">
                <div className="text-[11px] font-bold text-stone-700 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-stone-500" />
                    3. 单独移动某个点 (非均匀纸张微调)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {intermediateIndices.map((idx) => {
                    const pt = ladderMesh[idx];
                    if (!pt) return null;
                    const isSelected = activePointIndex === idx && activeLineIndex === null;
                    return (
                      <button
                        key={idx}
                        id={`select-anchor-P${idx}`}
                        type="button"
                        onClick={() => {
                          setActivePointIndex(idx);
                          setActiveLineIndex(null);
                        }}
                        className={`text-left p-1.5 rounded-xl text-xs transition-all border flex flex-col justify-between ${
                          isSelected
                            ? 'bg-sky-600 text-white border-sky-700 font-bold shadow-xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold">P{idx}</span>
                          <span className="text-[10px] opacity-80">
                            {idx % 2 === 0 ? '左界' : '右界'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono opacity-75 mt-0.5">
                          ({Math.round(pt.x)}, {Math.round(pt.y)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* D-Pad Micro Adjustment */}
            <div className="border-t border-stone-100 pt-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-stone-800">
                  {activeLineIndex !== null
                    ? `透视平移 (中线 ${activeLineIndex})`
                    : `方向微调 (P${activePointIndex ?? 0})`}
                </span>
                <span className="text-[10px] text-stone-400">支持键盘方向键</span>
              </div>

              <div className="flex flex-col items-center gap-1 my-1">
                <button
                  id="nudge-up-btn"
                  type="button"
                  onClick={() => handleNudge(0, -3)}
                  className="w-16 py-1 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-md text-stone-700 flex items-center justify-center transition-colors border border-stone-200"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    id="nudge-left-btn"
                    type="button"
                    onClick={() => handleNudge(-3, 0)}
                    disabled={activeLineIndex !== null}
                    className="w-12 py-1 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-md text-stone-700 flex items-center justify-center transition-colors border border-stone-200 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div
                    className={`w-14 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                      activeLineIndex !== null
                        ? 'bg-sky-600 text-white'
                        : isCornerPoint(activePointIndex ?? 0)
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-sky-500 text-white'
                    }`}
                  >
                    {activeLineIndex !== null ? `线 ${activeLineIndex}` : `P${activePointIndex ?? 0}`}
                  </div>
                  <button
                    id="nudge-right-btn"
                    type="button"
                    onClick={() => handleNudge(3, 0)}
                    disabled={activeLineIndex !== null}
                    className="w-12 py-1 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-md text-stone-700 flex items-center justify-center transition-colors border border-stone-200 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  id="nudge-down-btn"
                  type="button"
                  onClick={() => handleNudge(0, 3)}
                  className="w-16 py-1 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-md text-stone-700 flex items-center justify-center transition-colors border border-stone-200"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Structure Logic Card */}
          <div className="bg-stone-50 rounded-2xl border border-stone-200 p-3 text-xs text-stone-600 space-y-1.5">
            <h4 className="font-bold text-stone-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              双模式对齐机制
            </h4>
            <p className="text-[11px] leading-relaxed">
              <strong>自动透视放置</strong>：自动识别仅锁定外围 4 个角点，中间中线依据纸张透视矩阵（Homography）与模版比例自动定位。<br />
              <strong>中线平移与单点微调</strong>：可直接按住画布上的中线手柄沿透视整体上下平移；若有纸张弯曲，可单独拖动任意控制点。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
