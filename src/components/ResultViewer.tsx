import React, { useState, useEffect } from 'react';
import { ProcessedRow, ProcessingResult } from '../types';
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
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';

interface ResultViewerProps {
  result: ProcessingResult;
  onBackToEdit: () => void;
  onNewImage: () => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  result,
  onBackToEdit,
  onNewImage,
}) => {
  const [bgMode, setBgMode] = useState<'checker' | 'light' | 'dark' | 'cream'>('checker');
  const [copiedRowIdx, setCopiedRowIdx] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);

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
    link.download = `handwriting_row_${row.rowIndex + 1}_300ppi.png`;
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
            原图分辨率 {result.originalWidth} × {result.originalHeight} · 标准 300 PPI 规格 (1182 × 236 px) · 背景已转透明 Alpha
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
