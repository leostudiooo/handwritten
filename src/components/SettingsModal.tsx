import React from 'react';
import { ProcessingConfig, MorphMode } from '../types';
import { X, Sliders, RotateCcw, Check, Palette, ShieldCheck, Minimize2, Maximize2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ProcessingConfig;
  onSaveConfig: (newConfig: ProcessingConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [localConfig, setLocalConfig] = React.useState<ProcessingConfig>(config);

  React.useEffect(() => {
    setLocalConfig({
      ...config,
      thresholdMode: 'manual',
      autoThreshold: config.autoThreshold ?? config.manualThreshold ?? 140,
      thresholdSource: config.thresholdSource ?? 'auto',
      chromaSensitivity: config.chromaSensitivity ?? 0,
    });
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setLocalConfig({
      rowCount: 3,
      targetWidth: 2364,
      targetHeight: 472,
      outputDpi: 600,
      paddingCutPxX: 24,
      paddingCutPxY: 24,
      thresholdMode: 'manual',
      manualThreshold: 140,
      autoThreshold: 140,
      thresholdSource: 'auto',
      enableMorphClose: true,
      morphMode: 'none',
      morphStrength: 1,
      minNoiseArea: 16,
      emptyRowThresholdPercent: 0.3,
      invertResult: false,
      inkColor: '#000000',
      chromaSensitivity: 0,
    });
  };

  const handleSave = () => {
    onSaveConfig({ ...localConfig, thresholdMode: 'manual' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                算法与色度通道过滤配置
              </h3>
              <p className="text-[11px] text-stone-500">
                微调计算机视觉管线、色度过滤与导出规格
              </p>
            </div>
          </div>
          <button
            id="settings-close-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto text-xs">
          {/* Section 0: Unified Chroma Filter Sensitivity (0-100) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-600" />
                色度过滤灵敏度 (Chroma / Color Filter: 0 ~ 100)
              </label>
              <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                {(localConfig.chromaSensitivity ?? 0) === 0
                  ? '0% (已关闭 / 标准灰度)'
                  : `${localConfig.chromaSensitivity ?? 0}% (${
                      (localConfig.chromaSensitivity ?? 0) <= 25
                        ? '轻度除色'
                        : (localConfig.chromaSensitivity ?? 0) <= 50
                        ? '标准除色'
                        : (localConfig.chromaSensitivity ?? 0) <= 75
                        ? '强力除色'
                        : '极致除色'
                    })`}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              默认关闭；打开后按原来的 0-100 灵敏度过滤米字格/田字格红线、印章朱文、蓝色参考线与泛黄纸斑。
            </p>

            <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/70 space-y-2.5">
              <input
                id="settings-chroma-sensitivity-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={localConfig.chromaSensitivity ?? 0}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    chromaSensitivity: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500"
              />

              <div className="flex items-center justify-between text-[10px] text-stone-400">
                <span>0% (关闭/原样)</span>
                <span>25% (轻度)</span>
                <span>50% (标准)</span>
                <span>75% (强力除暗红)</span>
                <span>100% (极限纯黑)</span>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-amber-200/50">
                <span className="text-[10px] text-stone-500 font-medium">快捷档位:</span>
                {[
                  { label: '默认关闭 (0%)', val: 0 },
                  { label: '轻度 (25%)', val: 25 },
                  { label: '标准 (50%)', val: 50 },
                  { label: '强力 (75%)', val: 75 },
                  { label: '极致 (95%)', val: 95 },
                ].map((preset) => {
                  const isCur = (localConfig.chromaSensitivity ?? 0) === preset.val;
                  return (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() =>
                        setLocalConfig({
                          ...localConfig,
                          chromaSensitivity: preset.val,
                        })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        isCur
                          ? 'bg-amber-500 text-white border-amber-500 font-bold'
                          : 'bg-white hover:bg-amber-100 text-stone-700 border-amber-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 0.5: Row Count Setting (行数设置) */}
          <div className="space-y-2 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800 block">
                模版行数设置 (Row Count)
              </label>
              <span className="text-[10px] text-stone-400">支持 1 ~ 6 行自定义模版</span>
            </div>
            <p className="text-[11px] text-stone-500">
              根据练习纸的实际行数自动调整透视网格与标准化切片数量。
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {[1, 2, 3, 4, 5, 6].map((num) => {
                const isSelected = (localConfig.rowCount || 3) === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      setLocalConfig({
                        ...localConfig,
                        rowCount: num,
                      })
                    }
                    className={`py-2 px-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs ring-1 ring-amber-400'
                        : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div>{num} 行</div>
                    <div className="text-[9px] font-normal text-stone-400">
                      {num === 3 ? '标准(3框)' : `${num} 框`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: Standard Resolution */}
          <div className="space-y-2 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800 block">
                标准输出分辨率 (Target Resolution)
              </label>
              <span className="text-[10px] text-stone-400">更高分辨率支持更细腻的形态学微调</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                id="res-600dpi-btn"
                onClick={() =>
                  setLocalConfig({ ...localConfig, targetWidth: 2364, targetHeight: 472, outputDpi: 600 })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.targetWidth === 2364
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-400'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">600 DPI 超清出版级</span>
                  <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded font-bold">
                    推荐 · 极细形态学
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">2364 × 472 px (100×20mm 标准比例)</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setLocalConfig({ ...localConfig, targetWidth: 2400, targetHeight: 480, outputDpi: 600 })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.targetWidth === 2400
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-400'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold text-stone-900">600 DPI 标称 5:1</div>
                <div className="text-[11px] text-stone-500 mt-0.5">2400 × 480 px (5:1 整数画幅)</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setLocalConfig({ ...localConfig, targetWidth: 1182, targetHeight: 236, outputDpi: 300 })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.targetWidth === 1182
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-400'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold text-stone-900">300 DPI 高清印刷级</div>
                <div className="text-[11px] text-stone-500 mt-0.5">1182 × 236 px (100×20mm)</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setLocalConfig({ ...localConfig, targetWidth: 1000, targetHeight: 200, outputDpi: undefined })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.targetWidth === 1000
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-400'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold text-stone-900">1000px 紧凑基准</div>
                <div className="text-[11px] text-stone-500 mt-0.5">1000 × 200 px (快速低负载)</div>
              </button>
            </div>
          </div>

          {/* Section 2: Global Threshold Controls */}
          <div className="space-y-3 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60">
            <div className="flex items-center justify-between gap-3">
              <label className="font-bold text-amber-950">
                全局灰度阈值 (CV 自动建议 + 手动微调)
              </label>
              <span className="font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-300 shadow-xs">
                {localConfig.manualThreshold ?? 140} / 255
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80">
              默认值由当前网格的高分辨率矫正结果自动估算；滑块仍是唯一生效阈值，便于按墨色手动收紧或放宽。
            </p>
            <input
              id="manual-threshold-slider"
              type="range"
              min="30"
              max="230"
              step="1"
              value={localConfig.manualThreshold ?? 140}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  thresholdMode: 'manual',
                  manualThreshold: Number(e.target.value),
                  thresholdSource: 'manual',
                })
              }
              className="w-full accent-amber-600"
            />
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[11px] text-amber-900/70 font-medium">快速预设:</span>
              {localConfig.autoThreshold !== undefined && (
                <button
                  type="button"
                  onClick={() =>
                    setLocalConfig({
                      ...localConfig,
                      thresholdMode: 'manual',
                      manualThreshold: localConfig.autoThreshold ?? localConfig.manualThreshold,
                      thresholdSource: 'auto',
                    })
                  }
                  className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-[10px] font-bold text-white border border-amber-500"
                >
                  CV 建议 ({localConfig.autoThreshold})
                </button>
              )}
              <button
                type="button"
                onClick={() => setLocalConfig({ ...localConfig, thresholdMode: 'manual', manualThreshold: 110, thresholdSource: 'manual' })}
                className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-medium text-stone-700 border border-amber-200"
              >
                极细/淡墨 (110)
              </button>
              <button
                type="button"
                onClick={() => setLocalConfig({ ...localConfig, thresholdMode: 'manual', manualThreshold: 140, thresholdSource: 'manual' })}
                className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-medium text-stone-700 border border-amber-200"
              >
                标准墨迹 (140)
              </button>
              <button
                type="button"
                onClick={() => setLocalConfig({ ...localConfig, thresholdMode: 'manual', manualThreshold: 170, thresholdSource: 'manual' })}
                className="px-2 py-0.5 rounded bg-white hover:bg-amber-100 text-[10px] font-medium text-stone-700 border border-amber-200"
              >
                浓重饱满 (170)
              </button>
            </div>
          </div>

          {/* Section 4: Dead Zone Padding Cut */}
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">
                死区裁切像素 (Padding Cut px，去边框)
              </label>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                左右 {localConfig.paddingCutPxX}px / 上下 {localConfig.paddingCutPxY}px
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              按目标分辨率的固定像素向内裁除手绘框线，不随画幅宽高比例缩放。默认 24px。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-stone-600">
                  <span>左右裁切</span>
                  <span>{localConfig.paddingCutPxX}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.min(240, Math.max(0, Math.floor(((localConfig.targetWidth || 1000) - 1) / 2)))}
                  step="1"
                  value={localConfig.paddingCutPxX}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      paddingCutPxX: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-stone-600">
                  <span>上下裁切</span>
                  <span>{localConfig.paddingCutPxY}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.min(120, Math.max(0, Math.floor(((localConfig.targetHeight || 200) - 1) / 2)))}
                  step="1"
                  value={localConfig.paddingCutPxY}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      paddingCutPxY: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-stone-400 font-medium">快捷档位:</span>
              {[
                { label: '关闭 0px', x: 0, y: 0 },
                { label: '细框 12px', x: 12, y: 12 },
                { label: '默认 24px', x: 24, y: 24 },
                { label: '粗框 40px', x: 40, y: 40 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setLocalConfig({
                      ...localConfig,
                      paddingCutPxX: preset.x,
                      paddingCutPxY: preset.y,
                    })
                  }
                  className="px-2 py-0.5 rounded bg-white hover:bg-stone-100 text-[10px] font-medium text-stone-700 border border-stone-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: Empty Row Threshold */}
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">
                空行容错阈值 (Empty Row Threshold %)
              </label>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                {localConfig.emptyRowThresholdPercent}%
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              PRD 3.5 规则：字迹黑色像素比例低于此阈值时直接丢弃该行。默认 0.3%。
            </p>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.05"
              value={localConfig.emptyRowThresholdPercent}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  emptyRowThresholdPercent: Number(e.target.value),
                })
              }
              className="w-full accent-amber-500"
            />
          </div>

          {/* Section 5.5: Small Noise / Speckle Filter Threshold */}
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">
                小噪点去除阈值 (Noise Filter Area Threshold)
              </label>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                {(localConfig.minNoiseArea ?? 8) === 0
                  ? '0 px (已关闭)'
                  : `${localConfig.minNoiseArea ?? 8} px`}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              通过 8-连通域分析，自动清除像素面积小于该阈值的孤立墨点、扫描纸灰和微小噪点。建议 6~15 像素（保护极细笔锋）。
            </p>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={localConfig.minNoiseArea ?? 8}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  minNoiseArea: Number(e.target.value),
                })
              }
              className="w-full accent-amber-500"
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-stone-400 font-medium">快捷档位:</span>
              {[
                { label: '0 px (关闭)', val: 0 },
                { label: '5 px (微弱)', val: 5 },
                { label: '8 px (默认)', val: 8 },
                { label: '15 px (标准)', val: 15 },
                { label: '25 px (强力)', val: 25 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() =>
                    setLocalConfig({
                      ...localConfig,
                      minNoiseArea: p.val,
                    })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    (localConfig.minNoiseArea ?? 8) === p.val
                      ? 'bg-amber-500 text-white border-amber-500 font-bold'
                      : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 6: Morphological Erosion & Dilation / Stroke Boldness (侵蚀-扩张形态学微调) */}
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800 flex items-center gap-1.5">
                <Minimize2 className="w-4 h-4 text-amber-600" />
                <span>形态学侵蚀 - 扩张 (笔画粗细微调)</span>
              </label>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 text-[11px]">
                {(localConfig.morphMode || 'none') === 'none'
                  ? '原始笔画 (0 px)'
                  : (localConfig.morphMode || 'none') === 'erode'
                  ? `侵蚀细化 -${localConfig.morphStrength || 1} px`
                  : (localConfig.morphMode || 'none') === 'dilate'
                  ? `膨胀加粗 +${localConfig.morphStrength || 1} px`
                  : (localConfig.morphMode || 'none') === 'open'
                  ? `开运算去刺 ${localConfig.morphStrength || 1} px`
                  : `闭运算补缝 ${localConfig.morphStrength || 1} px`}
              </span>
            </div>

            <p className="text-[11px] text-stone-500">
              通过形态学核操作，针对性细化或加粗手写笔触，或在保持原有笔画粗细的前提下消除边缘毛刺或修补断笔裂纹。
            </p>

            {/* Mode Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {[
                {
                  id: 'none' as const,
                  name: '无形态学处理',
                  desc: '保持原始笔锋与粗细质感',
                },
                {
                  id: 'erode' as const,
                  name: '侵蚀 / 细化收缩 (Erode)',
                  desc: '向内剥离边缘，细化粗重笔触，分离文字粘连与墨水洇染',
                },
                {
                  id: 'dilate' as const,
                  name: '膨胀 / 加粗扩张 (Dilate)',
                  desc: '向外扩张轮廓，加粗淡墨虚线，弥合细小断笔',
                },
                {
                  id: 'open' as const,
                  name: '开运算 (Opening: 蚀后胀)',
                  desc: '先侵蚀后膨胀：剔除边缘突刺与细碎毛边，保持原始笔画粗细',
                },
                {
                  id: 'close' as const,
                  name: '闭运算 (Closing: 胀后蚀)',
                  desc: '先膨胀后侵蚀：填补笔画内部断墨小孔与纸纹裂缝，保持粗细',
                },
              ].map((m) => {
                const isSelected = (localConfig.morphMode || 'none') === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setLocalConfig({
                        ...localConfig,
                        morphMode: m.id,
                        enableMorphClose: m.id === 'close',
                      })
                    }
                    className={`text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-50/80 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-white hover:bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-amber-900' : 'text-stone-800'
                        }`}
                      >
                        {m.name}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-stone-500 mt-0.5 leading-snug">
                      {m.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Morph Strength Slider when mode is not 'none' */}
            {(localConfig.morphMode || 'none') !== 'none' && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 text-[11px]">
                    形态学运算半径 / 强度 (Kernel Radius: 1 ~ 6 px)
                  </span>
                  <span className="font-mono font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                    {localConfig.morphStrength || 1} 像素 ({
                      (localConfig.morphStrength || 1) === 1
                        ? '微调 (0.04mm)'
                        : (localConfig.morphStrength || 1) === 2
                        ? '轻度 (0.08mm)'
                        : (localConfig.morphStrength || 1) === 3
                        ? '中度 (0.13mm)'
                        : (localConfig.morphStrength || 1) <= 4
                        ? '较强 (0.17mm)'
                        : '强力 (0.25mm)'
                    })
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="1"
                  value={localConfig.morphStrength || 1}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      morphStrength: Number(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-stone-400 font-medium">快捷预设:</span>
              {[
                { label: '原始 (无)', mode: 'none' as const, strength: 1 },
                { label: '微细化 1px', mode: 'erode' as const, strength: 1 },
                { label: '中细化 2px', mode: 'erode' as const, strength: 2 },
                { label: '强细化 3px', mode: 'erode' as const, strength: 3 },
                { label: '微加粗 1px', mode: 'dilate' as const, strength: 1 },
                { label: '中加粗 2px', mode: 'dilate' as const, strength: 2 },
                { label: '强加粗 3px', mode: 'dilate' as const, strength: 3 },
                { label: '去刺平滑', mode: 'open' as const, strength: 1 },
                { label: '断墨修复', mode: 'close' as const, strength: 1 },
              ].map((p) => {
                const isCur =
                  (localConfig.morphMode || 'none') === p.mode &&
                  (p.mode === 'none' || (localConfig.morphStrength || 1) === p.strength);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      setLocalConfig({
                        ...localConfig,
                        morphMode: p.mode,
                        enableMorphClose: p.mode === 'close',
                        morphStrength: p.strength,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                      isCur
                        ? 'bg-amber-500 text-white border-amber-500 font-bold'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            恢复默认配置
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              id="settings-save-btn"
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-amber-400" />
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
