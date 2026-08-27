export interface Point {
  x: number;
  y: number;
}

export type LadderPoints = Point[];

export type ChromaFilterMode =
  | 'none'            // Standard Grayscale (全通道灰度)
  | 'chroma_suppress' // Chroma Suppression: suppresses colored guidelines/red seals/yellow stains, extracts dark neutral ink
  | 'red_filter'      // Red Light Pass + Dark Red Boost: thoroughly eliminates dark red/vermilion guidelines & stamps
  | 'blue_filter'     // Blue Light Pass: filters out cyan/blue guidelines
  | 'color_ink';      // Color Ink Isolation: extracts chromatic ink (e.g. red pen corrections)

export type MorphMode =
  | 'none'    // No morphology (原始粗细)
  | 'erode'   // Erosion / Thinning (侵蚀/笔画细化/去毛刺粘连)
  | 'dilate'  // Dilation / Thickening (膨胀/笔画加粗/增强淡墨)
  | 'open'    // Morphological Opening: Erode -> Dilate (开运算: 消除毛刺微突起但保持笔画粗细)
  | 'close';  // Morphological Closing: Dilate -> Erode (闭运算: 弥合微小空洞与笔画断裂)

export interface ProcessingConfig {
  rowCount: number;             // default 3 (e.g. 1 to 8 rows)
  targetWidth: number;          // e.g. 2364px (600 DPI @ 100mm) or 1182px (300 DPI)
  targetHeight: number;         // e.g. 472px (600 DPI @ 20mm) or 236px (300 DPI)
  paddingCutPercentX: number;   // default 5% (cuts 5% from left and right)
  paddingCutPercentY: number;   // default 5% (cuts 5% from top and bottom)
  thresholdMode: 'adaptive' | 'manual'; // 'adaptive' (Gaussian local mean) or 'manual' (global grayscale cutoff)
  manualThreshold: number;      // default 140 (0-255)
  adaptiveBlockSize: number;    // default 51 (odd number 31-101)
  adaptiveC: number;            // default 8 (5-20)
  enableMorphClose: boolean;    // default true (kernel repair)
  morphMode?: MorphMode;        // default 'none' | 'erode' | 'dilate' | 'open' | 'close'
  morphStrength?: number;       // default 1 (kernel radius 1-6 px for high-res 600 DPI fine tuning)
  minNoiseArea?: number;        // default 16 (0-100 pixels: connected component small noise/speckle removal threshold)
  emptyRowThresholdPercent: number; // default 0.3% (if ink pixels < 0.3%, marked as empty)
  invertResult: boolean;        // default false (true for white text on dark)
  inkColor: string;             // default '#000000'
  chromaSensitivity?: number;   // default 50 (0-100: 0 = off, 1-100 = sensitivity for filtering red/blue/colored guidelines & stamps)
  chromaFilterMode?: string;    // legacy compatibility
  chromaThreshold?: number;     // legacy compatibility
  redSensitivity?: number;      // legacy compatibility
}

export interface ProcessedRow {
  rowIndex: number;             // 0, 1, 2... (corresponds to Box 1, 2, 3...)
  title: string;                // "第一行 (Row 1)", etc.
  isEmpty: boolean;
  inkPixelCount: number;
  totalPixelCount: number;
  inkDensityPercent: number;
  dataUrl: string;              // Standard transparent PNG data url
  blob?: Blob;
  width: number;
  height: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  processingTimeMs: number;
}

export interface ProcessingResult {
  rows: ProcessedRow[];
  totalTimeMs: number;
  originalWidth: number;
  originalHeight: number;
  processedCount: number;
  skippedCount: number;
}

export interface PresetScenario {
  id: string;
  name: string;
  badge: string;
  description: string;
  notes: string;
}
