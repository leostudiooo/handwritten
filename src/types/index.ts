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
  outputDpi?: number;           // optional PNG pHYs density metadata, e.g. 600 or 300
  paddingCutPxX: number;        // default 24px (cuts fixed pixels from left and right)
  paddingCutPxY: number;        // default 24px (cuts fixed pixels from top and bottom)
  manualThreshold: number;      // default: CV-estimated global grayscale cutoff, user-adjustable 0-255
  autoThreshold?: number;       // latest CV-estimated global threshold used as the slider default
  thresholdSource?: 'auto' | 'manual'; // whether manualThreshold follows CV suggestion or user input
  enableMorphClose: boolean;    // default true (kernel repair)
  morphMode?: MorphMode;        // default 'none' | 'erode' | 'dilate' | 'open' | 'close'
  morphStrength?: number;       // default 1 (kernel radius 1-6 px for high-res 600 DPI fine tuning)
  minNoiseArea?: number;        // default 16 (0-100 pixels: connected component small noise/speckle removal threshold)
  emptyRowThresholdPercent: number; // default 0.3% (if ink pixels < 0.3%, marked as empty)
  invertResult: boolean;        // default false (true for white text on dark)
  inkColor: string;             // default '#000000'
  chromaSensitivity?: number;   // default 0 (0-100; 0 = off, 1-100 = chroma filter sensitivity)
  thresholdMode?: 'manual';     // current UI uses manual + auto global seed
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
  originalDataUrl?: string;     // Initial CV result before manual touch-up
  isManuallyEdited?: boolean;   // Flag indicating manual eraser / touchup
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
