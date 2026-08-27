import { Point, LadderPoints, ProcessingConfig, ProcessedRow, ProcessingResult } from '../types';

/**
 * Computes 3x3 Homography perspective transformation matrix
 * mapping (x0,y0)..(x3,y3) to (u0,v0)..(u3,v3)
 */
export function getPerspectiveTransform(src: Point[], dst: Point[]): number[] {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const h = solveLinearSystem8x8(a, b);
  return [...h, 1];
}

/**
 * Solves 8x8 linear equation system using Gaussian Elimination with partial pivoting
 */
function solveLinearSystem8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let p = 0; p < n; p++) {
    let maxRow = p;
    for (let i = p + 1; i < n; i++) {
      if (Math.abs(M[i][p]) > Math.abs(M[maxRow][p])) {
        maxRow = i;
      }
    }
    const temp = M[p];
    M[p] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[p][p]) < 1e-12) {
      // Degenerate matrix fallback
      M[p][p] = 1e-12;
    }

    for (let i = p + 1; i < n; i++) {
      const alpha = M[i][p] / M[p][p];
      for (let j = p; j <= n; j++) {
        M[i][j] -= alpha * M[p][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * x[j];
    }
    x[i] = (M[i][n] - sum) / M[i][i];
  }

  return x;
}

/**
 * Applies perspective warp from source ImageData to destination ImageData
 * with high quality bilinear interpolation.
 */
export function warpPerspectiveBilinear(
  srcData: ImageData,
  dstWidth: number,
  dstHeight: number,
  srcCorners: Point[]
): ImageData {
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: dstWidth, y: 0 },
    { x: dstWidth, y: dstHeight },
    { x: 0, y: dstHeight },
  ];

  // We need inverse mapping: from dst (u, v) -> src (x, y)
  const Hinv = getPerspectiveTransform(dstCorners, srcCorners);

  const dstData = new ImageData(dstWidth, dstHeight);
  const src = srcData.data;
  const dst = dstData.data;
  const sw = srcData.width;
  const sh = srcData.height;

  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = Hinv;

  for (let v = 0; v < dstHeight; v++) {
    for (let u = 0; u < dstWidth; u++) {
      const w = h6 * u + h7 * v + h8;
      if (Math.abs(w) < 1e-8) continue;

      const sx = (h0 * u + h1 * v + h2) / w;
      const sy = (h3 * u + h4 * v + h5) / w;

      if (sx < 0 || sx >= sw - 1 || sy < 0 || sy >= sh - 1) {
        // Outside boundary, set white background
        const dstIdx = (v * dstWidth + u) * 4;
        dst[dstIdx] = 255;
        dst[dstIdx + 1] = 255;
        dst[dstIdx + 2] = 255;
        dst[dstIdx + 3] = 255;
        continue;
      }

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w01 = fx * (1 - fy);
      const w10 = (1 - fx) * fy;
      const w11 = fx * fy;

      const idx00 = (y0 * sw + x0) * 4;
      const idx01 = (y0 * sw + x1) * 4;
      const idx10 = (y1 * sw + x0) * 4;
      const idx11 = (y1 * sw + x1) * 4;

      const dstIdx = (v * dstWidth + u) * 4;

      for (let c = 0; c < 3; c++) {
        dst[dstIdx + c] = Math.round(
          src[idx00 + c] * w00 +
          src[idx01 + c] * w01 +
          src[idx10 + c] * w10 +
          src[idx11 + c] * w11
        );
      }
      dst[dstIdx + 3] = 255;
    }
  }

  return dstData;
}

/**
 * Fast Adaptive Thresholding with Gaussian-weighted/Integral Mean Box window
 * Robust against strong mobile shadows and uneven paper illumination.
 */
export function adaptiveThresholdFast(
  imgData: ImageData,
  blockSize: number = 37,
  C: number = 8
): Uint8Array {
  const width = imgData.width;
  const height = imgData.height;
  const src = imgData.data;

  // 1. Convert to Grayscale
  const gray = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < src.length; i += 4, j++) {
    // Standard perceptual luminance: 0.299R + 0.587G + 0.114B
    gray[j] = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
  }

  // 2. Build Integral Image (O(N) time) for instantaneous block-mean computation
  const integral = new Float64Array((width + 1) * (height + 1));
  const intW = width + 1;

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const grayRowOffset = y * width;
    const intRowOffset = (y + 1) * intW;
    const prevIntRowOffset = y * intW;

    for (let x = 0; x < width; x++) {
      rowSum += gray[grayRowOffset + x];
      integral[intRowOffset + (x + 1)] = integral[prevIntRowOffset + (x + 1)] + rowSum;
    }
  }

  const radius = Math.floor(blockSize / 2);
  const binary = new Uint8Array(width * height);

  // 3. Compute Adaptive Threshold per pixel:
  // If pixel < (local_mean - C), it is dark INK (value 0 for black or 1 for ink flag), otherwise white background (255)
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);

      const count = (x1 - x0) * (y1 - y0);
      const sum =
        integral[y1 * intW + x1] -
        integral[y0 * intW + x1] -
        integral[y1 * intW + x0] +
        integral[y0 * intW + x0];

      const localMean = sum / count;
      const pixelVal = gray[y * width + x];

      // Adaptive threshold condition:
      // Dark stroke if significantly darker than local background
      if (pixelVal < localMean - C) {
        binary[y * width + x] = 0; // Black (Ink)
      } else {
        binary[y * width + x] = 255; // White (Paper)
      }
    }
  }

  return binary;
}

/**
 * 2x2 Morphological Closing (Dilation then Erosion) on binary image
 * Repairs micro gaps in pen strokes caused by reflections or dry ink.
 */
export function morphClose2x2(binary: Uint8Array, width: number, height: number): Uint8Array {
  // Dilate (make black ink thicker)
  const dilated = new Uint8Array(width * height);
  dilated.fill(255);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binary[y * width + x] === 0) {
        // Expand black 1 pixel around
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (nx < width && ny < height) {
              dilated[ny * width + nx] = 0;
            }
          }
        }
      }
    }
  }

  // Erode (shrink black ink back)
  const result = new Uint8Array(width * height);
  result.fill(255);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let allBlack = true;
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (nx >= width || ny >= height || dilated[ny * width + nx] !== 0) {
            allBlack = false;
            break;
          }
        }
        if (!allBlack) break;
      }
      if (allBlack) {
        result[y * width + x] = 0;
      }
    }
  }

  return result;
}

/**
 * Performs Dead-Zone Padding Cut (向内收缩 5% 切除手绘边框线)
 * and calculates ink statistics and bounding box.
 */
export function processBoxImage(
  warpedImageData: ImageData,
  config: ProcessingConfig,
  rowIndex: number
): ProcessedRow {
  const startTime = performance.now();
  const rawW = warpedImageData.width;
  const rawH = warpedImageData.height;

  // 1. Adaptive Binarization
  const binary = adaptiveThresholdFast(
    warpedImageData,
    config.adaptiveBlockSize,
    config.adaptiveC
  );

  // 2. Optional Morphological Closing
  const processedBinary = config.enableMorphClose
    ? morphClose2x2(binary, rawW, rawH)
    : binary;

  // 3. Dead Zone Padding Cut (5% inward crop)
  const padX = Math.round((rawW * config.paddingCutPercentX) / 100);
  const padY = Math.round((rawH * config.paddingCutPercentY) / 100);

  const innerX0 = padX;
  const innerY0 = padY;
  const innerX1 = rawW - padX;
  const innerY1 = rawH - padY;
  const innerW = innerX1 - innerX0;
  const innerH = innerY1 - innerY0;

  // 4. Analyze ink pixels within the valid inner area
  let inkCount = 0;
  let minX = innerW;
  let minY = innerH;
  let maxX = -1;
  let maxY = -1;

  const validArea = innerW * innerH;

  for (let y = innerY0; y < innerY1; y++) {
    const rowOffset = y * rawW;
    const localY = y - innerY0;
    for (let x = innerX0; x < innerX1; x++) {
      const isInk = processedBinary[rowOffset + x] === 0;
      if (isInk) {
        inkCount++;
        const localX = x - innerX0;
        if (localX < minX) minX = localX;
        if (localX > maxX) maxX = localX;
        if (localY < minY) minY = localY;
        if (localY > maxY) maxY = localY;
      }
    }
  }

  const inkDensityPercent = (inkCount / validArea) * 100;
  const isEmpty = inkDensityPercent < config.emptyRowThresholdPercent;

  // 5. Create Standard Transparent Output Canvas
  const outCanvas = document.createElement('canvas');
  outCanvas.width = config.targetWidth;
  outCanvas.height = config.targetHeight;
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true });

  let dataUrl = '';
  let bBox: { x: number; y: number; width: number; height: number } | undefined = undefined;

  if (ctx && !isEmpty && inkCount > 0 && maxX >= minX && maxY >= minY) {
    bBox = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };

    // Create an intermediate cropped ImageData for the valid inner region with alpha transparency
    const innerImgData = ctx.createImageData(innerW, innerH);
    const innerData = innerImgData.data;

    // Parse ink color (e.g. #000000 or custom)
    const inkR = 0;
    const inkG = 0;
    const inkB = 0;

    for (let y = 0; y < innerH; y++) {
      const srcY = y + innerY0;
      for (let x = 0; x < innerW; x++) {
        const srcX = x + innerX0;
        const isInk = processedBinary[srcY * rawW + srcX] === 0;
        const idx = (y * innerW + x) * 4;

        if (isInk) {
          innerData[idx] = inkR;
          innerData[idx + 1] = inkG;
          innerData[idx + 2] = inkB;
          innerData[idx + 3] = 255; // Solid Ink
        } else {
          innerData[idx] = 255;
          innerData[idx + 1] = 255;
          innerData[idx + 2] = 255;
          innerData[idx + 3] = 0; // Completely Transparent Background
        }
      }
    }

    // Render transparent inner content to standard canvas, scaling & centering proportionally
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = innerW;
    tempCanvas.height = innerH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(innerImgData, 0, 0);

      // Proportionally fit into target canvas with margin padding
      ctx.clearRect(0, 0, config.targetWidth, config.targetHeight);
      
      // Calculate scale to fit nicely into standard target canvas
      const scaleX = config.targetWidth / rawW;
      const scaleY = config.targetHeight / rawH;
      const destX = padX * scaleX;
      const destY = padY * scaleY;
      const destW = innerW * scaleX;
      const destH = innerH * scaleY;

      ctx.drawImage(tempCanvas, destX, destY, destW, destH);
      dataUrl = outCanvas.toDataURL('image/png');
    }
  } else {
    // If empty, generate a clean transparent placeholder dataUrl
    dataUrl = outCanvas.toDataURL('image/png');
  }

  const processingTimeMs = Math.round(performance.now() - startTime);

  const rowTitles = ['第一行 (Box 1)', '第二行 (Box 2)', '第三行 (Box 3)'];

  return {
    rowIndex,
    title: rowTitles[rowIndex] || `第 ${rowIndex + 1} 行`,
    isEmpty,
    inkPixelCount: inkCount,
    totalPixelCount: validArea,
    inkDensityPercent: Number(inkDensityPercent.toFixed(3)),
    dataUrl,
    width: config.targetWidth,
    height: config.targetHeight,
    boundingBox: bBox,
    processingTimeMs,
  };
}

/**
 * Full Pipeline Runner for 3 Stacked Boxes
 */
export async function runStandardizationPipeline(
  sourceImage: HTMLImageElement | ImageData | HTMLCanvasElement,
  mesh: LadderPoints,
  config: ProcessingConfig
): Promise<ProcessingResult> {
  const overallStart = performance.now();

  let srcData: ImageData;
  let originalWidth: number;
  let originalHeight: number;

  if (sourceImage instanceof ImageData) {
    srcData = sourceImage;
    originalWidth = srcData.width;
    originalHeight = srcData.height;
  } else {
    const canvas = document.createElement('canvas');
    if (sourceImage instanceof HTMLImageElement) {
      originalWidth = sourceImage.naturalWidth || sourceImage.width;
      originalHeight = sourceImage.naturalHeight || sourceImage.height;
    } else {
      originalWidth = sourceImage.width;
      originalHeight = sourceImage.height;
    }
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to obtain canvas 2D context');

    ctx.drawImage(sourceImage as any, 0, 0);
    srcData = ctx.getImageData(0, 0, originalWidth, originalHeight);
  }

  // Definition of 3 Box Quads from 8 points
  // Box 1: [P0, P1, P3, P2]
  // Box 2: [P2, P3, P5, P4]
  // Box 3: [P4, P5, P7, P6]
  const boxCornersList: Point[][] = [
    [mesh[0], mesh[1], mesh[3], mesh[2]],
    [mesh[2], mesh[3], mesh[5], mesh[4]],
    [mesh[4], mesh[5], mesh[7], mesh[6]],
  ];

  // Intermediate warp size for standard processing (1000 x 200)
  const warpWidth = 1000;
  const warpHeight = 200;

  const rows: ProcessedRow[] = [];

  for (let i = 0; i < 3; i++) {
    const corners = boxCornersList[i];
    // 1. Perspective Warp
    const warped = warpPerspectiveBilinear(srcData, warpWidth, warpHeight, corners);
    // 2. Dead Zone Cut + Adaptive Binarization + Empty Detection + Standard Output
    const processed = processBoxImage(warped, config, i);
    rows.push(processed);
  }

  const totalTimeMs = Math.round(performance.now() - overallStart);
  const processedCount = rows.filter((r) => !r.isEmpty).length;
  const skippedCount = rows.filter((r) => r.isEmpty).length;

  return {
    rows,
    totalTimeMs,
    originalWidth,
    originalHeight,
    processedCount,
    skippedCount,
  };
}

/**
 * Auto-Predict 8-point Ladder Grid from image
 * Detects contrast gradients / paper boundaries and computes 4 vertices,
 * then interpolates the 4 shared middle points.
 * Falls back to 80% centered default grid.
 */
export function autoPredictLadderMesh(
  imgWidth: number,
  imgHeight: number,
  previewData?: ImageData
): LadderPoints {
  // Default centered 80% grid with 3:5 aspect ratio
  const gridW = Math.min(imgWidth * 0.78, (imgHeight * 0.85 * 5) / 3);
  const gridH = (gridW * 3) / 5;

  const cx = imgWidth / 2;
  const cy = imgHeight / 2;

  let p0 = { x: Math.round(cx - gridW / 2), y: Math.round(cy - gridH / 2) };
  let p1 = { x: Math.round(cx + gridW / 2), y: Math.round(cy - gridH / 2) };
  let p6 = { x: Math.round(cx - gridW / 2), y: Math.round(cy + gridH / 2) };
  let p7 = { x: Math.round(cx + gridW / 2), y: Math.round(cy + gridH / 2) };

  // If previewData is provided, try gradient edge detection to refine outer boundary
  if (previewData) {
    try {
      const refined = detectOuterBoundaries(previewData, imgWidth, imgHeight);
      if (refined) {
        p0 = refined.p0;
        p1 = refined.p1;
        p6 = refined.p6;
        p7 = refined.p7;
      }
    } catch (e) {
      console.warn('Edge detection fallback:', e);
    }
  }

  // 1:1:1 Linear Interpolation on Left line (P0 -> P6) and Right line (P1 -> P7)
  const p2 = {
    x: Math.round(p0.x + (p6.x - p0.x) * (1 / 3)),
    y: Math.round(p0.y + (p6.y - p0.y) * (1 / 3)),
  };
  const p3 = {
    x: Math.round(p1.x + (p7.x - p1.x) * (1 / 3)),
    y: Math.round(p1.y + (p7.y - p1.y) * (1 / 3)),
  };
  const p4 = {
    x: Math.round(p0.x + (p6.x - p0.x) * (2 / 3)),
    y: Math.round(p0.y + (p6.y - p0.y) * (2 / 3)),
  };
  const p5 = {
    x: Math.round(p1.x + (p7.x - p1.x) * (2 / 3)),
    y: Math.round(p1.y + (p7.y - p1.y) * (2 / 3)),
  };

  return [p0, p1, p2, p3, p4, p5, p6, p7];
}

/**
 * Gradient-based quadrilateral finder
 */
function detectOuterBoundaries(
  imgData: ImageData,
  targetW: number,
  targetH: number
): { p0: Point; p1: Point; p6: Point; p7: Point } | null {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;

  // Simple Sobel edge magnitude
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }

  // Threshold on gradient
  const edges: Point[] = [];
  const step = 4;
  for (let y = 10; y < h - 10; y += step) {
    for (let x = 10; x < w - 10; x += step) {
      const gx = Math.abs(gray[y * w + (x + 1)] - gray[y * w + (x - 1)]);
      const gy = Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
      if (gx + gy > 65) {
        edges.push({ x, y });
      }
    }
  }

  if (edges.length < 50) return null;

  // Find bounding extremes
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (const pt of edges) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const detectedW = maxX - minX;
  const detectedH = maxY - minY;

  // Check if detected box has reasonable size (> 25% of image)
  if (detectedW < w * 0.25 || detectedH < h * 0.25) return null;

  const scaleX = targetW / w;
  const scaleY = targetH / h;

  return {
    p0: { x: Math.round(minX * scaleX), y: Math.round(minY * scaleY) },
    p1: { x: Math.round(maxX * scaleX), y: Math.round(minY * scaleY) },
    p6: { x: Math.round(minX * scaleX), y: Math.round(maxY * scaleY) },
    p7: { x: Math.round(maxX * scaleX), y: Math.round(maxY * scaleY) },
  };
}
