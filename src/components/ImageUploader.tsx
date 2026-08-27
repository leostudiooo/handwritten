import React, { useRef, useState, useEffect } from 'react';
import { Upload, Camera, Sparkles, Clipboard, ArrowRight, ShieldCheck } from 'lucide-react';
import { PRESET_SCENARIOS, generatePresetImage } from '../utils/presetGenerators';

interface ImageUploaderProps {
  onImageSelected: (
    originalImg: HTMLImageElement,
    previewImg: HTMLImageElement,
    scaleRatio: number,
    presetId?: string
  ) => void;
  isLoadingPresets: boolean;
  setIsLoadingPresets: (val: boolean) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageSelected,
  isLoadingPresets,
  setIsLoadingPresets,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const processLoadedImage = (dataUrl: string, presetId?: string) => {
    const origImg = new Image();
    origImg.onload = () => {
      const origW = origImg.naturalWidth;
      const origH = origImg.naturalHeight;

      // Downsample preview image: max edge 1024px
      const maxEdge = 1024;
      let prevW = origW;
      let prevH = origH;

      if (origW > maxEdge || origH > maxEdge) {
        if (origW >= origH) {
          prevW = maxEdge;
          prevH = Math.round((origH * maxEdge) / origW);
        } else {
          prevH = maxEdge;
          prevW = Math.round((origW * maxEdge) / origH);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = prevW;
      canvas.height = prevH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(origImg, 0, 0, prevW, prevH);
      const previewDataUrl = canvas.toDataURL('image/jpeg', 0.9);

      const prevImg = new Image();
      prevImg.onload = () => {
        const scaleRatio = origW / prevW;
        setIsLoadingPresets(false);
        onImageSelected(origImg, prevImg, scaleRatio, presetId);
      };
      prevImg.src = previewDataUrl;
    };
    origImg.src = dataUrl;
  };

  // Support global Ctrl+V / Command+V image pasting
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setIsLoadingPresets(true);
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                processLoadedImage(dataUrl);
              }
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleClipboardButtonClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            setIsLoadingPresets(true);
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                processLoadedImage(dataUrl);
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      // If no image in clipboard items or restricted, provide friendly hint
      alert('请使用截图快捷键 (Win+Shift+S 或 ⌘+Shift+4) 截取图片，然后直接按 Ctrl + V (或 ⌘ + V) 即可粘贴到此处！');
    } catch {
      alert('已就绪：请直接按下键盘 Ctrl + V (或 ⌘ + V) 粘贴剪贴板图片！');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingPresets(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        processLoadedImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setIsLoadingPresets(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        processLoadedImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = async (id: string) => {
    setActivePreset(id);
    setIsLoadingPresets(true);
    try {
      const sampleDataUrl = await generatePresetImage(id);
      processLoadedImage(sampleDataUrl, id);
    } catch (err) {
      console.error('Failed to generate preset image:', err);
      setIsLoadingPresets(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Introduction Card */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-stone-700/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              纸张规格：h60mm × w100mm (三框堆叠)
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              导入手写纸张照片
            </h2>
            <p className="text-sm text-stone-300 max-w-xl leading-relaxed">
              支持直接拍摄、相册上传或 <strong>Ctrl + V 剪贴板快速粘贴</strong>。针对纸张微卷、手机阴影、彩色米字格/红印与粗糙手绘框线，系统秒级提取透明背景素材。
            </p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Photo Upload Dropzone */}
        <div
          id="upload-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-8 flex flex-col items-center justify-center text-center group bg-white shadow-xs ${
            dragOver
              ? 'border-amber-500 bg-amber-50/50 scale-[0.99]'
              : 'border-stone-300 hover:border-stone-400 hover:bg-stone-50/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-base font-semibold text-stone-900 mb-1">
            选择本地照片、拖拽或按 Ctrl + V 粘贴
          </h3>
          <p className="text-xs text-stone-500 mb-5 max-w-xs">
            支持 JPG、PNG、HEIC 及微信/QQ/剪贴板截图。原图在本地浏览器内存中即时处理。
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              id="upload-browse-btn"
              type="button"
              className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              浏览相册
            </button>
            <button
              id="upload-paste-btn"
              type="button"
              onClick={handleClipboardButtonClick}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
            >
              <Clipboard className="w-3.5 h-3.5 text-amber-700" />
              粘贴图像 (Ctrl+V)
            </button>
            <button
              id="upload-camera-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 border border-stone-200"
            >
              <Camera className="w-3.5 h-3.5" />
              拍照
            </button>
          </div>
        </div>

        {/* PRD Acceptance Test Scenarios */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                PRD 验收测试用例预设
              </h3>
              <span className="text-xs text-stone-400">一键即测</span>
            </div>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              即刻生成 PRD 规定的 5 种极限场景照片，无需准备实体纸张即可验证完整算法。
            </p>

            <div className="space-y-2">
              {PRESET_SCENARIOS.map((preset) => (
                <button
                  key={preset.id}
                  id={`preset-btn-${preset.id}`}
                  onClick={() => handleSelectPreset(preset.id)}
                  disabled={isLoadingPresets}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between group ${
                    activePreset === preset.id
                      ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                      : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200 group-hover:bg-amber-100 group-hover:text-amber-800 transition-colors">
                      {preset.badge}
                    </span>
                    <div>
                      <span className="font-semibold text-stone-800 block">
                        {preset.name}
                      </span>
                      <span className="text-[11px] text-stone-500 block line-clamp-1">
                        {preset.description}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
            <span>支持 Web Worker 多线程计算</span>
            <span>剪贴板直粘 · 零等待</span>
          </div>
        </div>
      </div>
    </div>
  );
};
