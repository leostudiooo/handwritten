import { Point, LadderPoints, ProcessingConfig, ProcessedRow, ProcessingResult, ChromaFilterMode, MorphMode } from '../types';

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
 * Convert RGB ImageData to Grayscale Uint8Array with Unified Chroma Filtering (0-100 range).
 * - chromaSensitivity = 0: Disabled (Standard Perceptual Grayscale: 0.299R + 0.587G + 0.114B).
 * - chromaSensitivity = 1..100: Automatically suppresses colored grid lines, red seals, dark red/cyan guidelines, and paper stains to paper white (255), while perfectly preserving neutral black/dark ink.
 */
export function convertToFilteredGrayscale(
  imgData: ImageData,
  chromaSensitivity: number = 0
): Uint8Array {
  const width = imgData.width;
  const height = imgData.height;
  const src = imgData.data;
  const gray = new Uint8Array(width * height);
  const sens = Math.max(0, Math.min(100, chromaSensitivity ?? 0));

  if (sens <= 0) {
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      gray[j] = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    }
    return gray;
  }

  // Unified sensitivity mapping (0-100)
  const normS = sens / 100;
  // Saturation threshold: higher sensitivity -> lower threshold (more aggressive suppression of faint tints)
  const satThreshold = Math.max(0.025, 0.70 * (1 - normS * 0.95));
  // Dominance threshold for dark-red / vermilion lines & seals:
  const redExcessDelta = Math.max(2, Math.round(36 * (1 - normS * 0.92)));
  // Dominance threshold for blue/cyan grid lines:
  const blueExcessDelta = Math.max(2, Math.round(36 * (1 - normS * 0.92)));

  for (let i = 0, j = 0; i < src.length; i += 4, j++) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const delta = maxC - minC;
    const saturation = maxC > 0 ? delta / maxC : 0;
    const redExcess = Math.max(0, r - Math.max(g, b));
    const blueExcess = Math.max(0, b - Math.max(r, g));

    // Determine if pixel has chromatic content (colored guideline, red stamp, cyan line, paper stain)
    const isChromatic =
      saturation >= satThreshold ||
      (redExcess >= redExcessDelta && r > Math.max(g, b) * 1.04) ||
      (blueExcess >= blueExcessDelta && b > Math.max(r, g) * 1.04);

    if (isChromatic) {
      gray[j] = 255; // Suppress colored background lines to white
    } else {
      gray[j] = (r * 77 + g * 150 + b * 29) >> 8; // Preserve black/dark neutral ink
    }
  }

  return gray;
}

/**
 * Fast Adaptive Thresholding with Gaussian-weighted/Integral Mean Box window
 * Robust against strong mobile shadows and uneven paper illumination.
 */
export function adaptiveThresholdFast(
  imgData: ImageData,
  blockSize: number = 37,
  C: number = 8,
  chromaSensitivity: number = 0
): Uint8Array {
  const width = imgData.width;
  const height = imgData.height;

  // 1. Convert to Filtered Grayscale with chroma suppression
  const gray = convertToFilteredGrayscale(imgData, chromaSensitivity);

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
  const minDelta = Math.max(C, 7);

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

      // Adaptive threshold condition
      if (pixelVal < localMean - minDelta) {
        binary[y * width + x] = 0; // Black (Ink)
      } else {
        binary[y * width + x] = 255; // White (Paper)
      }
    }
  }

  return binary;
}

/**
 * Global Manual Grayscale Thresholding with Chroma Filtering
 */
export function manualThreshold(
  imgData: ImageData,
  threshold: number = 140,
  chromaSensitivity: number = 0
): Uint8Array {
  const width = imgData.width;
  const height = imgData.height;
  const gray = convertToFilteredGrayscale(imgData, chromaSensitivity);
  const binary = new Uint8Array(width * height);

  for (let j = 0; j < width * height; j++) {
    binary[j] = gray[j] < threshold ? 0 : 255;
  }

  return binary;
}

/**
 * 2x2 Morphological Closing (Dilation then Erosion) on binary image
 */
export function morphClose2x2(binary: Uint8Array, width: number, height: number): Uint8Array {
  const dilated = new Uint8Array(width * height);
  dilated.fill(255);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (binary[y * width + x] === 0) {
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
 * Morphological Erosion on ink (foreground = 0):
 * Thins stroke width, trims burrs, and separates overlapping/touching letters.
 */
export function erodeInk(binary: Uint8Array, width: number, height: number, radius = 1): Uint8Array {
  if (radius <= 0) return binary;
  let current = binary;
  for (let iter = 0; iter < radius; iter++) {
    const next = new Uint8Array(width * height);
    next.fill(255);
    for (let y = 0; y < height; y++) {
      const yOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = yOffset + x;
        if (current[idx] === 0) {
          let keep = true;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) {
              keep = false;
              break;
            }
            const nOffset = ny * width;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= width || current[nOffset + nx] !== 0) {
                keep = false;
                break;
              }
            }
            if (!keep) break;
          }
          if (keep) {
            next[idx] = 0;
          }
        }
      }
    }
    current = next;
  }
  return current;
}

/**
 * Morphological Dilation on ink (foreground = 0):
 * Thickens stroke width, reinforces faint ink lines, and bridges micro-cracks.
 */
export function dilateInk(binary: Uint8Array, width: number, height: number, radius = 1): Uint8Array {
  if (radius <= 0) return binary;
  let current = binary;
  for (let iter = 0; iter < radius; iter++) {
    const next = new Uint8Array(current);
    for (let y = 0; y < height; y++) {
      const yOffset = y * width;
      for (let x = 0; x < width; x++) {
        if (current[yOffset + x] === 0) {
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            const nOffset = ny * width;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              if (nx >= 0 && nx < width) {
                next[nOffset + nx] = 0;
              }
            }
          }
        }
      }
    }
    current = next;
  }
  return current;
}

/**
 * Universal Morphological Processor
 * Supports: 'erode' (细化/侵蚀), 'dilate' (加粗/膨胀), 'open' (开运算), 'close' (闭运算), 'none'
 */
export function applyMorphology(
  binary: Uint8Array,
  width: number,
  height: number,
  mode: MorphMode = 'none',
  strength = 1,
  legacyMorphClose = false
): Uint8Array {
  const s = Math.max(1, Math.min(6, Math.round(strength || 1)));

  if (mode === 'erode') {
    return erodeInk(binary, width, height, s);
  }
  if (mode === 'dilate') {
    return dilateInk(binary, width, height, s);
  }
  if (mode === 'open') {
    // Open = Erode then Dilate (removes tiny protrusions/burrs without changing stroke thickness)
    return dilateInk(erodeInk(binary, width, height, s), width, height, s);
  }
  if (mode === 'close') {
    // Close = Dilate then Erode (fills pinholes/micro-breaks without changing stroke thickness)
    return erodeInk(dilateInk(binary, width, height, s), width, height, s);
  }

  // Legacy fallback if morphMode is 'none' but legacy enableMorphClose is true
  if (legacyMorphClose) {
    return morphClose2x2(binary, width, height);
  }

  return binary;
}

/**
 * Removes isolated small noise / speckle / dust components (connected ink pixel area < minArea).
 * 8-connectivity connected-component analysis.
 */
export function filterSmallNoiseComponents(
  binary: Uint8Array,
  width: number,
  height: number,
  minArea: number
): Uint8Array {
  if (!minArea || minArea <= 0) return binary;
  const len = width * height;
  const result = new Uint8Array(binary);
  const visited = new Uint8Array(len);
  const queueIdx = new Int32Array(len);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (result[idx] === 0 && visited[idx] === 0) {
        let head = 0;
        let tail = 0;

        queueIdx[tail++] = idx;
        visited[idx] = 1;

        while (head < tail) {
          const cIdx = queueIdx[head++];
          const cy = Math.floor(cIdx / width);
          const cx = cIdx % width;

          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= height) continue;
            const nRowOffset = ny * width;

            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              if (nx < 0 || nx >= width) continue;

              const nIdx = nRowOffset + nx;
              if (result[nIdx] === 0 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queueIdx[tail++] = nIdx;
              }
            }
          }
        }

        const compSize = tail;
        // Erase tiny isolated pepper noise / dust / stray dots
        if (compSize < minArea) {
          for (let i = 0; i < compSize; i++) {
            result[queueIdx[i]] = 255;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Performs Dead-Zone Padding Cut and calculates ink statistics and bounding box.
 */
export function processBoxImage(
  warpedImageData: ImageData,
  config: ProcessingConfig,
  rowIndex: number
): ProcessedRow {
  const startTime = performance.now();
  const rawW = warpedImageData.width;
  const rawH = warpedImageData.height;

  // 1. Binarization: Adaptive vs Manual Thresholding with Unified Chroma Filter (0-100)
  const chromaSens =
    config.chromaSensitivity !== undefined
      ? config.chromaSensitivity
      : config.chromaFilterMode && config.chromaFilterMode !== 'none'
      ? 50
      : 0;

  const binary =
    config.thresholdMode === 'manual'
      ? manualThreshold(
          warpedImageData,
          config.manualThreshold ?? 140,
          chromaSens
        )
      : adaptiveThresholdFast(
          warpedImageData,
          config.adaptiveBlockSize,
          config.adaptiveC,
          chromaSens
        );

  // 2. Morphological Operations: Erosion / Dilation / Open / Close
  const morphBinary = applyMorphology(
    binary,
    rawW,
    rawH,
    config.morphMode || (config.enableMorphClose ? 'close' : 'none'),
    config.morphStrength || 1,
    config.enableMorphClose
  );

  // 2.5 Small Noise / Speckle Filter (Connected Component Area Threshold)
  const processedBinary =
    config.minNoiseArea && config.minNoiseArea > 0
      ? filterSmallNoiseComponents(morphBinary, rawW, rawH, config.minNoiseArea)
      : morphBinary;

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

    const innerImgData = ctx.createImageData(innerW, innerH);
    const innerData = innerImgData.data;

    for (let y = 0; y < innerH; y++) {
      const srcY = y + innerY0;
      for (let x = 0; x < innerW; x++) {
        const srcX = x + innerX0;
        const isInk = processedBinary[srcY * rawW + srcX] === 0;
        const idx = (y * innerW + x) * 4;

        if (isInk) {
          innerData[idx] = 0;
          innerData[idx + 1] = 0;
          innerData[idx + 2] = 0;
          innerData[idx + 3] = 255; // Solid Ink
        } else {
          innerData[idx] = 255;
          innerData[idx + 1] = 255;
          innerData[idx + 2] = 255;
          innerData[idx + 3] = 0; // Transparent Background
        }
      }
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = innerW;
    tempCanvas.height = innerH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(innerImgData, 0, 0);

      ctx.clearRect(0, 0, config.targetWidth, config.targetHeight);
      
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
    dataUrl = outCanvas.toDataURL('image/png');
  }

  const processingTimeMs = Math.round(performance.now() - startTime);

  return {
    rowIndex,
    title: `第 ${rowIndex + 1} 行 (Box ${rowIndex + 1})`,
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
 * Full Pipeline Runner for N Stacked Boxes
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

  // Derive row count from mesh length: (N + 1) * 2 points => N rows
  const numRows = config.rowCount || Math.max(1, Math.floor(mesh.length / 2 - 1));

  // Intermediate warp size for standard processing (1000 x 200)
  const warpWidth = 1000;
  const warpHeight = 200;

  const rows: ProcessedRow[] = [];

  for (let i = 0; i < numRows; i++) {
    const pTopL = mesh[2 * i] || mesh[0];
    const pTopR = mesh[2 * i + 1] || mesh[1];
    const pBotR = mesh[2 * i + 3] || mesh[mesh.length - 1];
    const pBotL = mesh[2 * i + 2] || mesh[mesh.length - 2];

    const corners: Point[] = [pTopL, pTopR, pBotR, pBotL];

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
 * Project canonical coordinate (u in 0..100, v in 0..canonicalH) to image space (x, y)
 * using true perspective homography matrix derived from the 4 outer corner points.
 */
export function projectCanonicalPoint(
  u: number, // 0..100 mm (or relative width)
  v: number, // 0..canonicalH (e.g. rowCount * 20)
  p0: Point,
  p1: Point,
  p_botL: Point,
  p_botR: Point,
  canonicalH: number = 60
): Point {
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: canonicalH },
    { x: 0, y: canonicalH },
  ];
  const srcCorners: Point[] = [p0, p1, p_botR, p_botL];
  const Hinv = getPerspectiveTransform(dstCorners, srcCorners);
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = Hinv;
  const w = h6 * u + h7 * v + h8;
  if (Math.abs(w) < 1e-8) {
    // Linear fallback if matrix is degenerate
    const tY = v / canonicalH;
    const tX = u / 100;
    const topX = p0.x + (p1.x - p0.x) * tX;
    const topY = p0.y + (p1.y - p0.y) * tX;
    const botX = p_botL.x + (p_botR.x - p_botL.x) * tX;
    const botY = p_botL.y + (p_botR.y - p_botL.y) * tX;
    return {
      x: Math.round(topX + (botX - topX) * tY),
      y: Math.round(topY + (botY - topY) * tY),
    };
  }
  return {
    x: Math.round((h0 * u + h1 * v + h2) / w),
    y: Math.round((h3 * u + h4 * v + h5) / w),
  };
}

/**
 * Inverse project an image coordinate (x, y) back into canonical space (u, v)
 * where u in 0..100, v in 0..canonicalH, returning ratio t = v / canonicalH (0..1).
 */
export function unprojectToPerspectiveRatio(
  pt: Point,
  p0: Point,
  p1: Point,
  p_botL: Point,
  p_botR: Point,
  canonicalH: number = 60
): number {
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: canonicalH },
    { x: 0, y: canonicalH },
  ];
  const srcCorners: Point[] = [p0, p1, p_botR, p_botL];
  const H = getPerspectiveTransform(srcCorners, dstCorners);
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;
  const w = h6 * pt.x + h7 * pt.y + h8;
  if (Math.abs(w) < 1e-8) {
    // Fallback: estimate from vertical bounds
    const minY = Math.min(p0.y, p1.y);
    const maxY = Math.max(p_botL.y, p_botR.y);
    return Math.max(0, Math.min(1, (pt.y - minY) / (maxY - minY || 1)));
  }
  const v = (h3 * pt.x + h4 * pt.y + h5) / w;
  return Math.max(0.01, Math.min(0.99, v / canonicalH));
}

/**
 * Compute all (rowCount + 1) * 2 ladder points from the 4 outer corner points
 * using perspective projection and row ratios.
 */
export function interpolateLadderPoints(
  p0: Point,
  p1: Point,
  p_botL: Point,
  p_botR: Point,
  rowCount: number = 3,
  customRatios?: number[]
): Point[] {
  const canonicalH = rowCount * 20; // 20mm per row
  const points: Point[] = [p0, p1];

  for (let k = 1; k < rowCount; k++) {
    const ratio = customRatios && customRatios[k - 1] !== undefined
      ? customRatios[k - 1]
      : k / rowCount;
    const v = ratio * canonicalH;
    const leftPt = projectCanonicalPoint(0, v, p0, p1, p_botL, p_botR, canonicalH);
    const rightPt = projectCanonicalPoint(100, v, p0, p1, p_botL, p_botR, canonicalH);
    points.push(leftPt, rightPt);
  }

  points.push(p_botL, p_botR);
  return points;
}

/**
 * Backward-compatible helper for 3 rows
 */
export function interpolateIntermediatePoints(
  p0: Point,
  p1: Point,
  p6: Point,
  p7: Point,
  ratio1: number = 1 / 3,
  ratio2: number = 2 / 3
): { p2: Point; p3: Point; p4: Point; p5: Point } {
  const pts = interpolateLadderPoints(p0, p1, p6, p7, 3, [ratio1, ratio2]);
  return { p2: pts[2], p3: pts[3], p4: pts[4], p5: pts[5] };
}

/**
 * Auto-Predict (rowCount + 1) * 2 Ladder Grid from image
 * Detects contrast gradients / paper boundaries and computes 4 vertices,
 * then interpolates the divider lines according to rowCount.
 */
export function autoPredictLadderMesh(
  imgWidth: number,
  imgHeight: number,
  previewData?: ImageData,
  rowCount: number = 3
): LadderPoints {
  // Default centered grid with 5 : rowCount aspect ratio
  const gridW = Math.min(imgWidth * 0.78, (imgHeight * 0.85 * 5) / rowCount);
  const gridH = (gridW * rowCount) / 5;

  const cx = imgWidth / 2;
  const cy = imgHeight / 2;

  let p0 = { x: Math.round(cx - gridW / 2), y: Math.round(cy - gridH / 2) };
  let p1 = { x: Math.round(cx + gridW / 2), y: Math.round(cy - gridH / 2) };
  let p_botL = { x: Math.round(cx - gridW / 2), y: Math.round(cy + gridH / 2) };
  let p_botR = { x: Math.round(cx + gridW / 2), y: Math.round(cy + gridH / 2) };

  // If previewData is provided, try gradient edge detection to refine outer boundary
  if (previewData) {
    try {
      const refined = detectOuterBoundaries(previewData, imgWidth, imgHeight, rowCount);
      if (refined) {
        p0 = refined.p0;
        p1 = refined.p1;
        p_botL = refined.p6;
        p_botR = refined.p7;
      }
    } catch (e) {
      console.warn('Edge detection fallback:', e);
    }
  }

  return interpolateLadderPoints(p0, p1, p_botL, p_botR, rowCount);
}

/**
 * Fit a line y = m * x + c using robust linear regression with outlier rejection
 */
function fitHorizontalLine(points: Point[]): { m: number; c: number } | null {
  if (points.length < 5) return null;
  let sumX = 0, sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / points.length;
  const meanY = sumY / points.length;

  let num = 0, den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) * (p.x - meanX);
  }
  if (Math.abs(den) < 1e-6) return null;
  const m = num / den;
  const c = meanY - m * meanX;

  // Outlier rejection pass
  const residuals = points.map((p) => Math.abs(p.y - (m * p.x + c)));
  const avgResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const inliers = points.filter((_, i) => residuals[i] <= Math.max(10, avgResidual * 2));

  if (inliers.length < 5) return { m, c };

  let sumX2 = 0, sumY2 = 0;
  for (const p of inliers) {
    sumX2 += p.x;
    sumY2 += p.y;
  }
  const meanX2 = sumX2 / inliers.length;
  const meanY2 = sumY2 / inliers.length;

  let num2 = 0, den2 = 0;
  for (const p of inliers) {
    num2 += (p.x - meanX2) * (p.y - meanY2);
    den2 += (p.x - meanX2) * (p.x - meanX2);
  }
  if (Math.abs(den2) < 1e-6) return { m, c };
  return { m: num2 / den2, c: meanY2 - (num2 / den2) * meanX2 };
}

/**
 * Fit a line x = m * y + c for vertical/near-vertical lines with outlier rejection
 */
function fitVerticalLine(points: Point[]): { m: number; c: number } | null {
  if (points.length < 5) return null;
  let sumX = 0, sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / points.length;
  const meanY = sumY / points.length;

  let num = 0, den = 0;
  for (const p of points) {
    num += (p.y - meanY) * (p.x - meanX);
    den += (p.y - meanY) * (p.y - meanY);
  }
  if (Math.abs(den) < 1e-6) return null;
  const m = num / den;
  const c = meanX - m * meanY;

  // Outlier rejection pass
  const residuals = points.map((p) => Math.abs(p.x - (m * p.y + c)));
  const avgResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const inliers = points.filter((_, i) => residuals[i] <= Math.max(10, avgResidual * 2));

  if (inliers.length < 5) return { m, c };

  let sumX2 = 0, sumY2 = 0;
  for (const p of inliers) {
    sumX2 += p.x;
    sumY2 += p.y;
  }
  const meanX2 = sumX2 / inliers.length;
  const meanY2 = sumY2 / inliers.length;

  let num2 = 0, den2 = 0;
  for (const p of inliers) {
    num2 += (p.y - meanY2) * (p.x - meanX2);
    den2 += (p.y - meanY2) * (p.y - meanY2);
  }
  if (Math.abs(den2) < 1e-6) return { m, c };
  return { m: num2 / den2, c: meanX2 - (num2 / den2) * meanY2 };
}

/**
 * True 4-corner quadrilateral boundary finder for ladder template (100mm x 20mm*rowCount, 5:rowCount aspect ratio).
 * Uses horizontal line peak analysis and linear regression with strict geometric aspect ratio bounds
 * to prevent boundary from snapping to photo shadows or bottom table edges.
 */
function detectOuterBoundaries(
  imgData: ImageData,
  targetW: number,
  targetH: number,
  rowCount: number = 3
): { p0: Point; p1: Point; p6: Point; p7: Point } | null {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;

  // 1. Grayscale computation
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }

  // 2. Stroke & ink detection with local contrast gating (rejecting outer 4% camera frame)
  const marginFrameX = Math.max(10, Math.round(w * 0.04));
  const marginFrameY = Math.max(10, Math.round(h * 0.04));

  const isDarkStroke = (x: number, y: number): boolean => {
    if (x < marginFrameX || x >= w - marginFrameX || y < marginFrameY || y >= h - marginFrameY) {
      return false;
    }
    const val = gray[y * w + x];
    if (val > 140) return false;
    const gx = Math.abs(gray[y * w + (x + 1)] - gray[y * w + (x - 1)]);
    const gy = Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
    return gx + gy > 26 || val < 85;
  };

  // Collect candidate ink points
  const candidatePoints: Point[] = [];
  const sampleStep = 4;
  for (let y = marginFrameY; y < h - marginFrameY; y += sampleStep) {
    for (let x = marginFrameX; x < w - marginFrameX; x += sampleStep) {
      if (isDarkStroke(x, y)) {
        candidatePoints.push({ x, y });
      }
    }
  }

  if (candidatePoints.length < 50) return null;

  // Coarse bounding distribution
  candidatePoints.sort((a, b) => a.x - b.x);
  const minX = candidatePoints[Math.floor(candidatePoints.length * 0.03)].x;
  const maxX = candidatePoints[Math.floor(candidatePoints.length * 0.97)].x;

  candidatePoints.sort((a, b) => a.y - b.y);
  const minY = candidatePoints[Math.floor(candidatePoints.length * 0.03)].y;
  const maxY = candidatePoints[Math.floor(candidatePoints.length * 0.97)].y;

  const detectedW = maxX - minX;
  if (detectedW < w * 0.22) return null;

  // 3. Expected height for rowCount rows (each row is 20mm/100mm = 0.20 * Width)
  const expectedRatio = rowCount * 0.20;
  const expectedH = detectedW * expectedRatio;
  
  // 4. Horizontal Line Peak Detection for Top and Bottom Border Lines
  const startScanY = Math.max(marginFrameY, minY - 20);
  const maxSafeScanY = Math.min(h - marginFrameY, Math.round(minY + expectedH * 1.35));
  const hScores = new Float32Array(h);

  for (let y = startScanY; y < maxSafeScanY; y++) {
    let score = 0;
    const innerX0 = minX + Math.round(detectedW * 0.15);
    const innerX1 = maxX - Math.round(detectedW * 0.15);
    for (let x = innerX0; x <= innerX1; x += 2) {
      if (isDarkStroke(x, y)) {
        score += 1;
      }
    }
    hScores[y] = score;
  }

  // Find Top Line Peak near minY
  let topPeakY = minY;
  let topPeakScore = -1;
  const topSearchEnd = Math.min(h - marginFrameY, Math.round(minY + expectedH * 0.35));
  for (let y = startScanY; y <= topSearchEnd; y++) {
    if (hScores[y] > topPeakScore) {
      topPeakScore = hScores[y];
      topPeakY = y;
    }
  }

  // Find Bottom Line Peak specifically near topPeakY + expectedH (weighted by template aspect prior)
  const idealBotY = topPeakY + expectedH;
  const botSearchStart = Math.max(topPeakY + 30, Math.round(topPeakY + expectedH * 0.70));
  const botSearchEnd = Math.min(h - marginFrameY - 5, Math.round(topPeakY + expectedH * 1.25));
  
  let botPeakY = Math.round(idealBotY);
  let bestBotScore = -1;

  for (let y = botSearchStart; y <= botSearchEnd; y++) {
    const rawScore = hScores[y];
    // Distance penalty from ideal template ratio
    const distRatio = Math.abs(y - idealBotY) / Math.max(10, expectedH * 0.3);
    const weightedScore = rawScore * Math.exp(-distRatio * distRatio * 1.5);
    if (weightedScore > bestBotScore && rawScore >= 3) {
      bestBotScore = weightedScore;
      botPeakY = y;
    }
  }

  // If candidate maxY is closer and sensible
  if (bestBotScore < 2) {
    if (maxY > topPeakY + expectedH * 0.75 && maxY < topPeakY + expectedH * 1.25) {
      botPeakY = maxY;
    } else {
      botPeakY = Math.min(h - marginFrameY - 10, Math.round(idealBotY));
    }
  }

  const refinedH = botPeakY - topPeakY;

  // 5. Collect precise edge points along the 4 borders
  const topEdgePoints: Point[] = [];
  const bottomEdgePoints: Point[] = [];
  const leftEdgePoints: Point[] = [];
  const rightEdgePoints: Point[] = [];

  const xStep = Math.max(3, Math.round(detectedW / 60));
  const yStep = Math.max(3, Math.round(refinedH / 40));

  // Top line edge points (search within ±12px of topPeakY)
  for (let x = minX + Math.round(detectedW * 0.05); x <= maxX - Math.round(detectedW * 0.05); x += xStep) {
    for (let y = Math.max(marginFrameY, topPeakY - 12); y <= Math.min(h - 5, topPeakY + 12); y++) {
      if (isDarkStroke(x, y)) {
        topEdgePoints.push({ x, y });
        break;
      }
    }
  }

  // Bottom line edge points (search within ±12px of botPeakY)
  for (let x = minX + Math.round(detectedW * 0.05); x <= maxX - Math.round(detectedW * 0.05); x += xStep) {
    for (let y = Math.min(h - marginFrameY, botPeakY + 12); y >= Math.max(topPeakY + 20, botPeakY - 12); y--) {
      if (isDarkStroke(x, y)) {
        bottomEdgePoints.push({ x, y });
        break;
      }
    }
  }

  // Left line edge points (search within ±15px of minX)
  for (let y = topPeakY + Math.round(refinedH * 0.05); y <= botPeakY - Math.round(refinedH * 0.05); y += yStep) {
    for (let x = Math.max(marginFrameX, minX - 15); x <= Math.min(w - 5, minX + 15); x++) {
      if (isDarkStroke(x, y)) {
        leftEdgePoints.push({ x, y });
        break;
      }
    }
  }

  // Right line edge points (search within ±15px of maxX)
  for (let y = topPeakY + Math.round(refinedH * 0.05); y <= botPeakY - Math.round(refinedH * 0.05); y += yStep) {
    for (let x = Math.min(w - marginFrameX, maxX + 15); x >= Math.max(minX + 20, maxX - 15); x--) {
      if (isDarkStroke(x, y)) {
        rightEdgePoints.push({ x, y });
        break;
      }
    }
  }

  // 6. Line Fitting
  const topL = fitHorizontalLine(topEdgePoints.length >= 6 ? topEdgePoints : [{ x: minX, y: topPeakY }, { x: maxX, y: topPeakY }]);
  const botL = fitHorizontalLine(bottomEdgePoints.length >= 6 ? bottomEdgePoints : [{ x: minX, y: botPeakY }, { x: maxX, y: botPeakY }]);
  const leftL = fitVerticalLine(leftEdgePoints.length >= 6 ? leftEdgePoints : [{ x: minX, y: topPeakY }, { x: minX, y: botPeakY }]);
  const rightL = fitVerticalLine(rightEdgePoints.length >= 6 ? rightEdgePoints : [{ x: maxX, y: topPeakY }, { x: maxX, y: botPeakY }]);

  const scaleX = targetW / w;
  const scaleY = targetH / h;

  // Safe fallback anchored to detected width and expected ratio
  const fallback = {
    p0: { x: Math.round(minX * scaleX), y: Math.round(topPeakY * scaleY) },
    p1: { x: Math.round(maxX * scaleX), y: Math.round(topPeakY * scaleY) },
    p6: { x: Math.round(minX * scaleX), y: Math.round(botPeakY * scaleY) },
    p7: { x: Math.round(maxX * scaleX), y: Math.round(botPeakY * scaleY) },
  };

  if (!topL || !botL || !leftL || !rightL) {
    return fallback;
  }

  // 7. Compute Exact Intersection of the 4 border lines
  const denom0 = 1 - topL.m * leftL.m;
  const y0 = Math.abs(denom0) > 1e-4 ? (topL.m * leftL.c + topL.c) / denom0 : topPeakY;
  const x0 = leftL.m * y0 + leftL.c;

  const denom1 = 1 - topL.m * rightL.m;
  const y1 = Math.abs(denom1) > 1e-4 ? (topL.m * rightL.c + topL.c) / denom1 : topPeakY;
  const x1 = rightL.m * y1 + rightL.c;

  const denom6 = 1 - botL.m * leftL.m;
  const y6 = Math.abs(denom6) > 1e-4 ? (botL.m * leftL.c + botL.c) / denom6 : botPeakY;
  const x6 = leftL.m * y6 + leftL.c;

  const denom7 = 1 - botL.m * rightL.m;
  const y7 = Math.abs(denom7) > 1e-4 ? (botL.m * rightL.c + botL.c) / denom7 : botPeakY;
  const x7 = rightL.m * y7 + rightL.c;

  // Geometric validity & aspect ratio sanity checks
  const fitW = ((x1 - x0) + (x7 - x6)) / 2;
  const fitH = ((y6 - y0) + (y7 - y1)) / 2;
  const aspectRatio = fitW / Math.max(1, fitH);

  const targetAspect = 5.0 / rowCount;
  const minAspect = targetAspect * 0.65;
  const maxAspect = targetAspect * 1.45;

  const isAspectRatioValid = aspectRatio >= minAspect && aspectRatio <= maxAspect;
  const isWithinImage =
    x0 >= marginFrameX && x1 <= w - marginFrameX &&
    y0 >= marginFrameY && y6 <= h - marginFrameY &&
    y7 <= h - marginFrameY;

  if (!isAspectRatioValid || !isWithinImage) {
    return fallback;
  }

  return {
    p0: { x: Math.round(x0 * scaleX), y: Math.round(y0 * scaleY) },
    p1: { x: Math.round(x1 * scaleX), y: Math.round(y1 * scaleY) },
    p6: { x: Math.round(x6 * scaleX), y: Math.round(y6 * scaleY) },
    p7: { x: Math.round(x7 * scaleX), y: Math.round(y7 * scaleY) },
  };
}
