import React, { useState, useEffect } from 'react';
import { ProcessedRow, ProcessingResult, ProcessingConfig, MorphMode } from '../types';
import {
  Download,
  Copy,
  Check,
  Archive,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  SlidersHorizontal,
  Minimize2,
  Maximize2,
  Palette,
} from 'lucide-react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';

interface ResultViewerProps {
  result: ProcessingResult;
  config: ProcessingConfig;
  onUpdateConfigAndRerun: (newConfig: ProcessingConfig) => void;
  onBackToEdit: () => void;
  onNewImage: () => void;
  onOpenSettings: () => void;
  isProcessing?: boolean;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  result,
  config,
  onUpdateConfigAndRerun,
  onBackToEdit,
  onNewImage,
  onOpenSettings,
  isProcessing = false,
}) => {
  const [bgMode, setBgMode] = useState<'checker' | 'light' | 'dark' | 'cream'>('checker');
  const [copiedRowIdx, setCopiedRowIdx] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [localManualThreshold, setLocalManualThreshold] = useState<number>(config.manualThreshold ?? 140);
  const [localChromaThreshold, setLocalChromaThreshold] = useState<number>(
    config.chromaThresholdPercent ??
      (config.chromaSensitivity !== undefined ? config.chromaSensitivity / 100 : 0.5)
  );
  const [localMinNoiseArea, setLocalMinNoiseArea] = useState<number>(config.minNoiseArea ?? 8);
  const [localMorphMode, setLocalMorphMode] = useState<MorphMode>(
    config.morphMode ?? (config.enableMorphClose ? 'close' : 'none')
  );
  const [localMorphStrength, setLocalMorphStrength] = useState<number>(config.morphStrength ?? 1);

  useEffect(() => {
    setLocalManualThreshold(config.manualThreshold ?? 140);
  }, [config.manualThreshold]);

  useEffect(() => {
    setLocalChromaThreshold(
      config.chromaThresholdPercent ??
        (config.chromaSensitivity !== undefined ? config.chromaSensitivity / 100 : 0.5)
    );
  }, [config.chromaThresholdPercent, config.chromaSensitivity]);

  useEffect(() => {
    setLocalMinNoiseArea(config.minNoiseArea ?? 8);
  }, [config.minNoiseArea]);

  useEffect(() => {
    setLocalMorphMode(config.morphMode ?? (config.enableMorphClose ? 'close' : 'none'));
  }, [config.morphMode, config.enableMorphClose]);

  useEffect(() => {
    setLocalMorphStrength(config.morphStrength ?? 1);
  }, [config.morphStrength]);

  // Trigger celebration confetti on mount if at least 1 valid row extracted
  useEffect(() => {
    if (result.processedCount > 0) {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [result.processedCount]);

  // Handle Manual Threshold Slider change
  const handleManualThresholdChange = (val: number) => {
    setLocalManualThreshold(val);
  };

  const handleApplyManualThreshold = (val?: number, source: 'auto' | 'manual' = 'manual') => {
    const targetVal = val !== undefined ? val : localManualThreshold;
    const updated: ProcessingConfig = {
      ...config,
      thresholdMode: 'manual',
      manualThreshold: targetVal,
      thresholdSource: source,
    };
    onUpdateConfigAndRerun(updated);
  };

  // Handle Chroma Threshold (0-1%) Slider change & apply
  const handleChromaThresholdChange = (val: number) => {
    setLocalChromaThreshold(val);
  };

  const handleApplyChromaThreshold = (val?: number) => {
    const targetVal = val !== undefined ? val : localChromaThreshold;
    const updated: ProcessingConfig = {
      ...config,
      chromaThresholdPercent: targetVal,
    };
    onUpdateConfigAndRerun(updated);
  };

  // Handle Small Noise Filter Area Threshold Slider change & apply
  const handleMinNoiseAreaChange = (val: number) => {
    setLocalMinNoiseArea(val);
  };

  const handleApplyMinNoiseArea = (val?: number) => {
    const targetVal = val !== undefined ? val : localMinNoiseArea;
    const updated: ProcessingConfig = {
      ...config,
      minNoiseArea: targetVal,
    };
    onUpdateConfigAndRerun(updated);
  };

  // Handle Morphological Mode Switch
  const handleMorphModeChange = (mode: MorphMode) => {
    setLocalMorphMode(mode);
    const updated: ProcessingConfig = {
      ...config,
      morphMode: mode,
      enableMorphClose: mode === 'close',
      morphStrength: localMorphStrength,
    };
    onUpdateConfigAndRerun(updated);
  };

  // Handle Morphological Strength change & apply
  const handleMorphStrengthChange = (val: number) => {
    setLocalMorphStrength(val);
  };

  const handleApplyMorphStrength = (val?: number) => {
    const targetVal = val !== undefined ? val : localMorphStrength;
    const updated: ProcessingConfig = {
      ...config,
      morphMode: localMorphMode,
      enableMorphClose: localMorphMode === 'close',
      morphStrength: targetVal,
    };
    onUpdateConfigAndRerun(updated);
  };

  // Quick Preset for Morphology
  const handleQuickMorphPreset = (mode: MorphMode, strength: number) => {
    setLocalMorphMode(mode);
    setLocalMorphStrength(strength);
    const updated: ProcessingConfig = {
      ...config,
      morphMode: mode,
      enableMorphClose: mode === 'close',
      morphStrength: strength,
    };
    onUpdateConfigAndRerun(updated);
  };

  // Copy single PNG image to clipboard
  const handleCopyImage = async (row: ProcessedRow) => {
    try {
      const response = await fetch(row.dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopiedRowIdx(row.rowIndex);
      setTimeout(() => setCopiedRowIdx(null), 2000);
    } catch (err) {
      console.warn('Clipboard write failed, falling back to dataUrl text copy:', err);
      navigator.clipboard.writeText(row.dataUrl);
      setCopiedRowIdx(row.rowIndex);
      setTimeout(() => setCopiedRowIdx(null), 2000);
    }
  };

  // Download single PNG
  const handleDownloadSingle = (row: ProcessedRow) => {
    const link = document.createElement('a');
    link.href = row.dataUrl;
    const dpiTag = config.outputDpi ? `${config.outputDpi}dpi` : 'std';
    link.download = `handwriting_row_${row.rowIndex + 1}_${dpiTag}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Batch Download all valid rows as ZIP
  const handleBatchDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const validRows = result.rows.filter((r) => !r.isEmpty);

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        // Convert base64 dataUrl to blob
        const res = await fetch(row.dataUrl);
        const blob = await res.blob();
        zip.file(`standard_material_row_${row.rowIndex + 1}.png`, blob);
      }

      // Add a JSON metadata summary
      const manifest = {
        app: 'Semi-Automatic Handwriting Standardizer',
        totalRowsExtracted: validRows.length,
        originalDimensions: `${result.originalWidth}x${result.originalHeight}`,
        outputDpi: config.outputDpi ?? null,
        timestamp: new Date().toISOString(),
        rows: validRows.map((r) => ({
          row: r.rowIndex + 1,
          inkDensityPercent: r.inkDensityPercent,
          dimensions: `${r.width}x${r.height}`,
        })),
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `handwritten_materials_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const getBackgroundStyle = () => {
    switch (bgMode) {
      case 'checker':
        return {
          backgroundImage:
            'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: '#ffffff',
        };
      case 'light':
        return { backgroundColor: '#f8fafc' };
      case 'dark':
        return { backgroundColor: '#0f172a' };
      case 'cream':
        return { backgroundColor: '#fef3c7' };
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      {/* Top Banner & Summary Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              标准化处理完成
            </span>
            <span className="text-xs text-stone-400">
              耗时 {result.totalTimeMs} ms
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-stone-900">
            成功提取 {result.processedCount} 行标准透明 PNG 素材
            {result.skippedCount > 0 && ` (${result.skippedCount} 行空行已自动过滤)`}
          </h2>
          <p className="text-xs text-stone-500">
            原图分辨率 {result.originalWidth} × {result.originalHeight} · {config.outputDpi ? `${config.outputDpi} DPI` : '紧凑基准'} ({config.targetWidth} × {config.targetHeight} px) · 背景已转透明 Alpha
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            id="result-back-edit-btn"
            type="button"
            onClick={onBackToEdit}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            微调网格
          </button>

          {result.processedCount > 0 && (
            <button
              id="result-batch-zip-btn"
              type="button"
              onClick={handleBatchDownloadZip}
              disabled={isZipping}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 shadow-xs transition-colors"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              {isZipping ? '打包中...' : '批量下载 ZIP'}
            </button>
          )}

          <button
            id="result-new-image-btn"
            type="button"
            onClick={onNewImage}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            导入新照片
          </button>
        </div>
      </div>

      {/* Quick Threshold Adjustment Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900 flex items-center gap-2">
                <span>二值化阈值调控</span>
                <span className="text-[10px] text-stone-400 font-normal">
                  (当前: 手动阈值 {config.manualThreshold ?? 140}
                  {config.autoThreshold !== undefined ? ` · CV 建议 ${config.autoThreshold}` : ''})
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                先用 CV 自动检测全局阈值作为默认值，再用滑块微调墨迹深浅与背景纯净度
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100 border border-stone-200 transition-colors"
            >
              <Sliders className="w-3 h-3" />
              更多参数
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50/40 p-3 rounded-xl border border-amber-200/50">
          <div className="flex items-center gap-2 min-w-[140px]">
            <span className="text-xs font-bold text-amber-950">手动阈值:</span>
            <span className="font-mono text-xs font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-300 shadow-xs">
              {localManualThreshold}
            </span>
          </div>

          <div className="flex-1 flex items-center gap-3">
            <input
              id="result-manual-threshold-slider"
              type="range"
              min="30"
              max="230"
              step="1"
              value={localManualThreshold}
              onChange={(e) => handleManualThresholdChange(Number(e.target.value))}
              onMouseUp={() => handleApplyManualThreshold()}
              onTouchEnd={() => handleApplyManualThreshold()}
              className="w-full accent-amber-600"
            />
            <button
              type="button"
              id="result-apply-threshold-btn"
              onClick={() => handleApplyManualThreshold()}
              disabled={isProcessing}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
            >
              {isProcessing ? '重算中...' : '应用重算'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-amber-800 font-medium">预设:</span>
            {config.autoThreshold !== undefined && (
              <button
                type="button"
                onClick={() => {
                  const val = config.autoThreshold ?? 140;
                  setLocalManualThreshold(val);
                  handleApplyManualThreshold(val, 'auto');
                }}
                className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-[10px] font-bold text-white border border-amber-500"
              >
                CV 建议 {config.autoThreshold}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setLocalManualThreshold(110);
                handleApplyManualThreshold(110, 'manual');
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-medium text-stone-700 border border-amber-200"
            >
              淡墨 110
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalManualThreshold(140);
                handleApplyManualThreshold(140, 'manual');
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-medium text-stone-700 border border-amber-200"
            >
              标准 140
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalManualThreshold(170);
                handleApplyManualThreshold(170, 'manual');
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-medium text-stone-700 border border-amber-200"
            >
              浓墨 170
            </button>
          </div>
        </div>
        {/* Unified Chroma Filter Threshold (0-1%) Row */}
        <div className="pt-3 border-t border-stone-100 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-stone-100 text-amber-600 flex items-center justify-center">
                <Palette className="w-3 h-3" />
              </div>
              <span className="text-xs font-bold text-stone-900">
                色度过滤阈值 (Chroma Delta):
              </span>
              <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-xs">
                {localChromaThreshold === 0
                  ? '0% (已关闭 / 标准灰度)'
                  : `${localChromaThreshold.toFixed(2)}%`}
              </span>
            </div>

            <span className="text-[11px] font-medium text-stone-500">
              {localChromaThreshold === 0
                ? '关闭色度过滤：保留彩色痕迹，按标准亮度进行灰度与二值化转换'
                : localChromaThreshold <= 0.25
                ? '激进过滤：极小色偏也会被视为彩色辅助线或纸斑'
                : localChromaThreshold <= 0.5
                ? '默认过滤：适合常见红蓝格线、印章色与轻微纸斑'
                : localChromaThreshold <= 0.75
                ? '温和过滤：允许少量通道偏差，减少误伤墨迹边缘'
                : '最宽容过滤：只过滤更明显的色度差异'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50/40 p-3 rounded-xl border border-amber-200/70">
            <div className="flex-1 flex items-center gap-3">
              <input
                id="result-chroma-sensitivity-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localChromaThreshold}
                onChange={(e) => handleChromaThresholdChange(Number(e.target.value))}
                onMouseUp={() => handleApplyChromaThreshold()}
                onTouchEnd={() => handleApplyChromaThreshold()}
                className="w-full accent-amber-500"
              />
              <button
                type="button"
                id="result-apply-chroma-btn"
                onClick={() => handleApplyChromaThreshold()}
                disabled={isProcessing}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                {isProcessing ? '重算中...' : '应用色度过滤'}
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-stone-500 font-medium">阈值预设:</span>
              {[
                { label: '关闭 (0%)', val: 0 },
                { label: '0.25%', val: 0.25 },
                { label: '默认 0.50%', val: 0.5 },
                { label: '0.75%', val: 0.75 },
                { label: '1.00%', val: 1 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => {
                    setLocalChromaThreshold(preset.val);
                    handleApplyChromaThreshold(preset.val);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    localChromaThreshold === preset.val
                      ? 'bg-amber-500 text-white border-amber-500 font-bold'
                      : 'bg-white hover:bg-amber-100/60 text-stone-700 border-amber-200/80'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Small Noise / Speckle Removal Threshold Slider Row */}
        <div className="pt-3 border-t border-stone-100 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-stone-100 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-3 h-3" />
              </div>
              <span className="text-xs font-bold text-stone-900">
                小噪点去除阈值 (Small Noise / Speckle Filter):
              </span>
              <span className="font-mono text-xs font-bold text-stone-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-xs">
                {localMinNoiseArea === 0 ? '已关闭 (0 px)' : `${localMinNoiseArea} 像素`}
              </span>
            </div>

            <span className="text-[11px] font-medium text-stone-500">
              {localMinNoiseArea === 0
                ? '关闭降噪：保留所有单点像素与微小笔触'
                : localMinNoiseArea <= 6
                ? '轻度去杂：仅清除极微小的扫描浮尘与孤立单像素'
                : localMinNoiseArea <= 15
                ? '标准去噪：清除纸张纤维杂质、微小污点，完好保护笔锋'
                : localMinNoiseArea <= 30
                ? '强力去尘：清除明显墨滴溅射、纸张破损点与灰尘团'
                : '深度净化：强力消除较大杂斑，仅保留主干笔画'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-stone-50/70 p-3 rounded-xl border border-stone-200/80">
            <div className="flex-1 flex items-center gap-3">
              <input
                id="result-noise-threshold-slider"
                type="range"
                min="0"
                max="50"
                step="1"
                value={localMinNoiseArea}
                onChange={(e) => handleMinNoiseAreaChange(Number(e.target.value))}
                onMouseUp={() => handleApplyMinNoiseArea()}
                onTouchEnd={() => handleApplyMinNoiseArea()}
                className="w-full accent-amber-500"
              />
              <button
                type="button"
                id="result-apply-noise-btn"
                onClick={() => handleApplyMinNoiseArea()}
                disabled={isProcessing}
                className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                {isProcessing ? '重算中...' : '应用降噪'}
              </button>
            </div>

            {/* Noise Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-stone-500 font-medium">降噪预设:</span>
              {[
                { label: '关闭 0px', val: 0 },
                { label: '轻微 5px', val: 5 },
                { label: '推荐 10px', val: 10 },
                { label: '强力 20px', val: 20 },
                { label: '深度 35px', val: 35 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => {
                    setLocalMinNoiseArea(preset.val);
                    handleApplyMinNoiseArea(preset.val);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    localMinNoiseArea === preset.val
                      ? 'bg-stone-900 text-white border-stone-900 font-bold'
                      : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Morphological Erosion - Dilation & Stroke Boldness Row */}
        <div className="pt-3 border-t border-stone-100 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-stone-100 text-amber-600 flex items-center justify-center">
                <Minimize2 className="w-3 h-3" />
              </div>
              <span className="text-xs font-bold text-stone-900">
                侵蚀 - 扩张 (形态学笔画粗细微调):
              </span>
              <span className="font-mono text-xs font-bold text-stone-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-xs">
                {localMorphMode === 'none'
                  ? '原始笔画 (无形态学处理)'
                  : localMorphMode === 'erode'
                  ? `侵蚀细化 -${localMorphStrength} px`
                  : localMorphMode === 'dilate'
                  ? `膨胀加粗 +${localMorphStrength} px`
                  : localMorphMode === 'open'
                  ? `开运算 (平滑去刺) ${localMorphStrength} px`
                  : `闭运算 (修补微裂) ${localMorphStrength} px`}
              </span>
            </div>

            <span className="text-[11px] font-medium text-stone-500">
              {localMorphMode === 'none'
                ? '保持手写笔画原始粗细与边缘质感'
                : localMorphMode === 'erode'
                ? '剥离边缘轮廓，细化笔触，消除笔画粘连与渗墨毛边'
                : localMorphMode === 'dilate'
                ? '向外扩展轮廓，加粗笔画，增强浅淡笔迹并连接微小断笔'
                : localMorphMode === 'open'
                ? '先侵蚀后膨胀：消除边缘孤立细小毛刺，保持笔画粗细'
                : '先膨胀后侵蚀：弥合断墨微孔与反光缝隙，保持笔画粗细'}
            </span>
          </div>

          <div className="bg-stone-50/70 p-3 rounded-xl border border-stone-200/80 space-y-3">
            {/* Mode selection buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-stone-600 font-medium mr-1 text-[11px]">处理模式:</span>
                <div className="inline-flex bg-white p-0.5 rounded-lg border border-stone-200 text-[11px] shadow-2xs flex-wrap">
                  {(
                    [
                      { id: 'none', label: '无 (原始)' },
                      { id: 'erode', label: '侵蚀 (细化/收缩)' },
                      { id: 'dilate', label: '膨胀 (加粗/扩张)' },
                      { id: 'open', label: '开运算 (去毛刺)' },
                      { id: 'close', label: '闭运算 (修补裂隙)' },
                    ] as const
                  ).map((m) => {
                    const isActive = localMorphMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleMorphModeChange(m.id)}
                        disabled={isProcessing}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          isActive
                            ? 'bg-amber-500 text-white font-bold shadow-xs'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-stone-500 font-medium">快捷笔触:</span>
                {[
                  { label: '原始', mode: 'none' as const, strength: 1 },
                  { label: '微细化 -1px', mode: 'erode' as const, strength: 1 },
                  { label: '中细化 -2px', mode: 'erode' as const, strength: 2 },
                  { label: '强细化 -3px', mode: 'erode' as const, strength: 3 },
                  { label: '微加粗 +1px', mode: 'dilate' as const, strength: 1 },
                  { label: '中加粗 +2px', mode: 'dilate' as const, strength: 2 },
                  { label: '强加粗 +3px', mode: 'dilate' as const, strength: 3 },
                  { label: '去刺平滑', mode: 'open' as const, strength: 1 },
                  { label: '断笔修补', mode: 'close' as const, strength: 1 },
                ].map((p) => {
                  const isCur =
                    localMorphMode === p.mode &&
                    (p.mode === 'none' || localMorphStrength === p.strength);
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleQuickMorphPreset(p.mode, p.strength)}
                      disabled={isProcessing}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        isCur
                          ? 'bg-stone-900 text-white border-stone-900 font-bold'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Strength Slider (Visible when mode is not 'none') */}
            {localMorphMode !== 'none' && (
              <div className="pt-2 border-t border-stone-200/60 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 min-w-[150px]">
                  <span className="text-xs font-bold text-stone-800">
                    形态学运算半径 / 强度:
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                    {localMorphStrength} px ({
                      localMorphStrength === 1
                        ? '微调 0.04mm'
                        : localMorphStrength === 2
                        ? '轻度 0.08mm'
                        : localMorphStrength === 3
                        ? '中度 0.13mm'
                        : localMorphStrength <= 4
                        ? '较强 0.17mm'
                        : '强力 0.25mm'
                    })
                  </span>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <input
                    id="result-morph-strength-slider"
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={localMorphStrength}
                    onChange={(e) => handleMorphStrengthChange(Number(e.target.value))}
                    onMouseUp={() => handleApplyMorphStrength()}
                    onTouchEnd={() => handleApplyMorphStrength()}
                    className="w-full accent-amber-500"
                  />
                  <button
                    type="button"
                    id="result-apply-morph-btn"
                    onClick={() => handleApplyMorphStrength()}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
                  >
                    {isProcessing ? '重算中...' : '应用运算'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Background preview switcher toolbar */}
      <div className="flex items-center justify-between bg-stone-50 px-4 py-2.5 rounded-xl border border-stone-200 text-xs">
        <span className="text-stone-600 font-medium flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-stone-400" />
          透明度预览底色:
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBgMode('checker')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              bgMode === 'checker'
                ? 'bg-white shadow-xs text-stone-900 border border-stone-300'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            棋盘透明网格
          </button>
          <button
            type="button"
            onClick={() => setBgMode('light')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              bgMode === 'light'
                ? 'bg-white shadow-xs text-stone-900 border border-stone-300'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            纯白底色
          </button>
          <button
            type="button"
            onClick={() => setBgMode('dark')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              bgMode === 'dark'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            暗黑底色
          </button>
          <button
            type="button"
            onClick={() => setBgMode('cream')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              bgMode === 'cream'
                ? 'bg-amber-100 text-amber-900 shadow-xs border border-amber-300'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            宣纸暖色
          </button>
        </div>
      </div>

      {/* Row Cards List */}
      <div className="space-y-4">
        {result.rows.map((row) => (
          <div
            key={row.rowIndex}
            id={`result-row-card-${row.rowIndex}`}
            className={`bg-white rounded-2xl border transition-all overflow-hidden ${
              row.isEmpty
                ? 'border-stone-200/60 opacity-60 bg-stone-50/50'
                : 'border-stone-200 shadow-xs hover:border-stone-300'
            }`}
          >
            {/* Row Card Header */}
            <div className="p-4 bg-stone-50/80 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                  {row.rowIndex + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    {row.title}
                  </h3>
                  <span className="text-[11px] text-stone-500">
                    {row.isEmpty
                      ? '字迹密度低于 0.3% 容错阈值，已自动丢弃'
                      : `字迹像素占比: ${row.inkDensityPercent}% (${row.inkPixelCount} px) · 标准 ${row.width}×${row.height}px`}
                  </span>
                </div>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex items-center gap-2">
                {row.isEmpty ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-200 text-stone-600">
                    空行跳过
                  </span>
                ) : (
                  <>
                    <button
                      id={`copy-row-btn-${row.rowIndex}`}
                      type="button"
                      onClick={() => handleCopyImage(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 shadow-xs transition-colors"
                      title="复制 PNG 图像"
                    >
                      {copiedRowIdx === row.rowIndex ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-stone-500" />
                          <span>复制图像</span>
                        </>
                      )}
                    </button>

                    <button
                      id={`download-row-btn-${row.rowIndex}`}
                      type="button"
                      onClick={() => handleDownloadSingle(row)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 shadow-xs transition-colors"
                      title="下载单张透明 PNG"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      下载 PNG
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Row Image Preview Area */}
            <div className="p-4">
              {row.isEmpty ? (
                <div className="h-28 rounded-xl border border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400 text-xs">
                  <AlertCircle className="w-6 h-6 mb-1 text-stone-300" />
                  <span>此行未书写内容，符合需求 3.5 空行过滤规则</span>
                </div>
              ) : (
                <div
                  style={getBackgroundStyle()}
                  className="rounded-xl border border-stone-200/80 p-3 sm:p-5 flex items-center justify-center overflow-x-auto shadow-inner transition-colors"
                >
                  <img
                    src={row.dataUrl}
                    alt={row.title}
                    className="max-h-28 object-contain drop-shadow-sm select-none"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
