export interface Point {
  x: number;
  y: number;
}

export type LadderPoints = [
  Point, // P0: Top-Left of Box 1
  Point, // P1: Top-Right of Box 1
  Point, // P2: Bottom-Left of Box 1 / Top-Left of Box 2
  Point, // P3: Bottom-Right of Box 1 / Top-Right of Box 2
  Point, // P4: Bottom-Left of Box 2 / Top-Left of Box 3
  Point, // P5: Bottom-Right of Box 2 / Top-Right of Box 3
  Point, // P6: Bottom-Left of Box 3
  Point  // P7: Bottom-Right of Box 3
];

export interface ProcessingConfig {
  targetWidth: number;          // e.g. 1182px (300 PPI @ 100mm) or 1000px
  targetHeight: number;         // e.g. 236px (300 PPI @ 20mm) or 200px
  paddingCutPercentX: number;   // default 5% (cuts 5% from left and right)
  paddingCutPercentY: number;   // default 5% (cuts 5% from top and bottom)
  adaptiveBlockSize: number;    // default 37 (odd number 31-65)
  adaptiveC: number;            // default 8 (5-20)
  enableMorphClose: boolean;    // default true (2x2 kernel repair)
  emptyRowThresholdPercent: number; // default 0.3% (if ink pixels < 0.3%, marked as empty)
  invertResult: boolean;        // default false (true for white text on dark)
  inkColor: string;             // default '#000000'
}

export interface ProcessedRow {
  rowIndex: number;             // 0, 1, 2 (corresponds to Box 1, 2, 3)
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
