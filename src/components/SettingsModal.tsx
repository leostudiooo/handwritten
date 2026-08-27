import React from 'react';
import { ProcessingConfig } from '../types';
import { X, Sliders, RotateCcw, Check, Sparkles } from 'lucide-react';

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
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setLocalConfig({
      targetWidth: 1182,
      targetHeight: 236,
      paddingCutPercentX: 5,
      paddingCutPercentY: 5,
      adaptiveBlockSize: 37,
      adaptiveC: 8,
      enableMorphClose: true,
      emptyRowThresholdPercent: 0.3,
      invertResult: false,
      inkColor: '#000000',
    });
  };

  const handleSave = () => {
    onSaveConfig(localConfig);
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
                算法与导出参数配置
              </h3>
              <p className="text-[11px] text-stone-500">
                微调计算机视觉管线超参数与输出规格
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
          {/* Section 1: Standard Resolution */}
          <div className="space-y-2">
            <label className="font-bold text-stone-800 block">
              标准输出分辨率 (Target Resolution)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setLocalConfig({ ...localConfig, targetWidth: 1182, targetHeight: 236 })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.targetWidth === 1182
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold text-stone-900">300 PPI 高清印刷级</div>
                <div className="text-[11px] text-stone-500">1182 × 236 px (100×20mm)</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setLocalConfig({ ...localConfig, targetWidth: 1000, targetHeight: 200 })
                }
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.targetWidth === 1000
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                    : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold text-stone-900">1000px 紧凑基准</div>
                <div className="text-[11px] text-stone-500">1000 × 200 px (5:1 比例)</div>
              </button>
            </div>
          </div>

          {/* Section 2: Dead Zone Padding Cut */}
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">
                死区裁切比例 (Padding Cut %，去边框)
              </label>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                {localConfig.paddingCutPercentX}%
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              PRD 3.3 规则：向内收缩裁除手绘墨水框线。范围建议 3%~8%。
            </p>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={localConfig.paddingCutPercentX}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  paddingCutPercentX: Number(e.target.value),
                  paddingCutPercentY: Number(e.target.value),
                })
              }
              className="w-full accent-amber-500"
            />
          </div>

          {/* Section 3: Adaptive Threshold Block Size */}
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">
                高斯自适应局部窗口 (Block Size)
              </label>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                {localConfig.adaptiveBlockSize} px
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              PRD 3.4 规则：消除大面积阴影与渐变光。建议 31~51 之间奇数。
            </p>
            <input
              type="range"
              min="21"
              max="65"
              step="2"
              value={localConfig.adaptiveBlockSize}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  adaptiveBlockSize: Number(e.target.value),
                })
              }
              className="w-full accent-amber-500"
            />
          </div>

          {/* Section 4: Adaptive Constant C */}
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">
                二值化阈值偏移常数 (Constant C)
              </label>
              <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                {localConfig.adaptiveC}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              数值越大背景越干净，数值越小笔划保留越细腻。建议 6~12。
            </p>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={localConfig.adaptiveC}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  adaptiveC: Number(e.target.value),
                })
              }
              className="w-full accent-amber-500"
            />
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

          {/* Section 6: Morphological Closing Toggle */}
          <div className="flex items-center justify-between border-t border-stone-100 pt-4">
            <div>
              <span className="font-bold text-stone-800 block">
                形态学 2×2 闭运算修补
              </span>
              <span className="text-[11px] text-stone-500">
                修补因断墨或反光导致的笔画微小空洞
              </span>
            </div>
            <input
              type="checkbox"
              checked={localConfig.enableMorphClose}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  enableMorphClose: e.target.checked,
                })
              }
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
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
