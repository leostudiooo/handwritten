import { PresetScenario } from '../types';

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'paper_curl',
    name: '纸张卷曲畸变',
    badge: '测试卷曲',
    description: '照片中部凸起微卷，中间框变大变宽，验证 8 点分段矫正的一致性',
    notes: '8点网格贴合后，分段矫正使三行字迹尺寸、笔画粗细一致，无拉伸变形。',
  },
  {
    id: 'phone_shadow',
    name: '严重手机阴影',
    badge: '测试除影',
    description: '手机近距离拍摄，纸张右下半部处于深色浓重阴影中',
    notes: '高斯自适应二值化后，阴影区与亮区字迹粗细均匀，背景纯白无噪点。',
  },
  {
    id: 'rough_border',
    name: '手画框线粗糙',
    badge: '测试去框',
    description: '手绘尺子边框粗细不匀，且内侧有墨水晕染',
    notes: '死区 5% Padding 裁切完全滤除手绘框线，输出 PNG 边缘干净无黑线。',
  },
  {
    id: 'empty_row',
    name: '部分行留空',
    badge: '测试空行',
    description: '第 1 框和第 3 框书写字迹，第 2 框完全留空白',
    notes: '空行过滤算法（<0.3%字迹密度）自动检测并丢弃第2框，仅输出 2 张PNG。',
  },
  {
    id: 'clean_standard',
    name: '标准三行样本',
    badge: '标准用例',
    description: '整洁拍摄的 3 个手写框，包含完整中文与英文笔迹',
    notes: '完整提取 3 行标准透明 PNG 素材，标准 300PPI 尺寸。',
  },
];

/**
 * Draws realistic procedural sample images for each test scenario
 */
export function generatePresetImage(scenarioId: string): Promise<string> {
  return new Promise((resolve) => {
    const width = 1600;
    const height = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 1. Desk/Wood Background
    const deskGrad = ctx.createLinearGradient(0, 0, width, height);
    deskGrad.addColorStop(0, '#d1c4b2');
    deskGrad.addColorStop(0.5, '#c7b7a3');
    deskGrad.addColorStop(1, '#bba792');
    ctx.fillStyle = deskGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle desk woodgrain texture
    ctx.strokeStyle = 'rgba(120, 90, 60, 0.08)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < height; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y + (Math.sin(y * 0.05) * 4));
      ctx.bezierCurveTo(
        width * 0.3, y + Math.cos(y * 0.03) * 8,
        width * 0.7, y - Math.sin(y * 0.04) * 6,
        width, y + Math.cos(y * 0.02) * 5
      );
      ctx.stroke();
    }

    // 2. Paper Position with 3-D Perspective tilt
    ctx.save();
    ctx.translate(width / 2, height / 2);
    // Slight angle tilt
    const tiltAngle = scenarioId === 'paper_curl' ? 0.03 : -0.02;
    ctx.rotate(tiltAngle);

    const paperW = 900;
    const paperH = 750;

    // Paper Drop Shadow
    ctx.shadowColor = 'rgba(40, 30, 20, 0.35)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 12;
    ctx.shadowOffsetY = 18;

    // Paper Background
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(-paperW / 2, -paperH / 2, paperW, paperH);

    // Reset shadow
    ctx.shadowColor = 'transparent';

    // Paper texture noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
    for (let i = 0; i < 4000; i++) {
      const px = -paperW / 2 + Math.random() * paperW;
      const py = -paperH / 2 + Math.random() * paperH;
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    // 3. Draw 3 Contiguous Hand-drawn Rectangular Boxes (100mm x 20mm each, 100mm x 60mm total)
    const boxW = 680;
    const boxH = 140; // total 3 * 140 = 420
    const startX = -boxW / 2;
    const startY = - (boxH * 3) / 2;

    const isRough = scenarioId === 'rough_border';
    const isCurl = scenarioId === 'paper_curl';

    // Define vertices for 3 stacked boxes with potential curl/roughness
    const getCorner = (row: number, col: number) => {
      let x = startX + col * boxW;
      let y = startY + row * boxH;

      if (isCurl) {
        // Middle row bulges outward and wider
        if (row === 1 || row === 2) {
          y += (col === 0 ? -12 : 12);
          if (row === 1) y -= 16;
          if (row === 2) y += 14;
        }
      }
      if (isRough) {
        x += (Math.random() - 0.5) * 6;
        y += (Math.random() - 0.5) * 5;
      }
      return { x, y };
    };

    // Draw Box Outlines (Ink pen / ballpoint pen simulation)
    ctx.strokeStyle = '#22252a';
    ctx.lineWidth = isRough ? 4.5 : 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let r = 0; r < 3; r++) {
      const tl = getCorner(r, 0);
      const tr = getCorner(r, 1);
      const br = getCorner(r + 1, 1);
      const bl = getCorner(r + 1, 0);

      ctx.beginPath();
      if (isRough) {
        // Wobbly hand-drawn line
        drawRoughLine(ctx, tl.x, tl.y, tr.x, tr.y);
        drawRoughLine(ctx, tr.x, tr.y, br.x, br.y);
        drawRoughLine(ctx, br.x, br.y, bl.x, bl.y);
        drawRoughLine(ctx, bl.x, bl.y, tl.x, tl.y);
      } else {
        ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
      }
      ctx.stroke();

      // Hand-drawn ink bleed artifacts in corners if rough
      if (isRough) {
        ctx.fillStyle = 'rgba(30, 35, 40, 0.4)';
        ctx.beginPath();
        ctx.arc(tl.x + 4, tl.y + 4, 3, 0, Math.PI * 2);
        ctx.arc(tr.x - 5, tr.y + 3, 4, 0, Math.PI * 2);
        ctx.arc(bl.x + 3, bl.y - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Small printed box dimension label in corner outside or light watermark
      ctx.fillStyle = 'rgba(160, 160, 160, 0.5)';
      ctx.font = '12px sans-serif';
      ctx.fillText(`BOX ${r + 1} (100mm×20mm)`, tl.x + 10, tl.y - 6);
    }

    // 4. Draw Handwriting inside boxes
    // Row 1 Text
    drawHandwrittenText(
      ctx,
      '春风得意马蹄疾，一日看尽长安花。',
      startX + 40,
      startY + 85,
      isCurl ? 0.04 : 0
    );

    // Row 2 Text (Empty if scenario is 'empty_row')
    if (scenarioId !== 'empty_row') {
      drawHandwrittenText(
        ctx,
        'Standardizing Handwritten Notes 2026',
        startX + 50,
        startY + boxH + 85,
        isCurl ? -0.03 : 0
      );
    }

    // Row 3 Text
    drawHandwrittenText(
      ctx,
      '工欲善其事，必先利其器。Hello World!',
      startX + 40,
      startY + boxH * 2 + 85,
      isCurl ? 0.02 : 0
    );

    // 5. Environmental Lighting & Phone Shadow Effects
    if (scenarioId === 'phone_shadow') {
      // Strong harsh phone silhouette shadow diagonally covering right and bottom
      const shadowGrad = ctx.createLinearGradient(
        -paperW * 0.4, -paperH * 0.4,
        paperW * 0.5, paperH * 0.5
      );
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
      shadowGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.15)');
      shadowGrad.addColorStop(0.55, 'rgba(15, 20, 30, 0.65)');
      shadowGrad.addColorStop(1, 'rgba(10, 15, 25, 0.82)');

      ctx.fillStyle = shadowGrad;
      ctx.fillRect(-paperW / 2, -paperH / 2, paperW, paperH);

      // Phone silhouette head shadow
      ctx.fillStyle = 'rgba(10, 15, 25, 0.4)';
      ctx.beginPath();
      ctx.ellipse(100, 150, 220, 320, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mild natural ambient gradient
      const ambientGrad = ctx.createLinearGradient(
        -paperW / 2, -paperH / 2,
        paperW / 2, paperH / 2
      );
      ambientGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      ambientGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.0)');
      ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(-paperW / 2, -paperH / 2, paperW, paperH);
    }

    ctx.restore();

    resolve(canvas.toDataURL('image/jpeg', 0.94));
  });
}

function drawRoughLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const steps = 10;
  ctx.moveTo(x1, y1);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 3;
    const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 3;
    ctx.lineTo(px, py);
  }
}

function drawHandwrittenText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  rotation: number = 0
) {
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);

  ctx.fillStyle = '#16191f';
  ctx.font = 'bold 36px "Kaiti SC", "STKaiti", "KaiTi", "Songti SC", "SimSun", serif, cursive';
  ctx.shadowColor = 'rgba(20, 25, 30, 0.2)';
  ctx.shadowBlur = 1;

  // Render text with natural stroke variations
  ctx.fillText(text, 0, 0);

  // Subtle ink pressure variation
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(10, 15, 25, 0.85)';
  ctx.strokeText(text, 0, 0);

  ctx.restore();
}
