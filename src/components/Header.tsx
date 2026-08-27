import React from 'react';
import { Layers, Sparkles, Sliders, RefreshCw, HelpCircle } from 'lucide-react';

interface HeaderProps {
  currentStep: 'upload' | 'mesh' | 'result';
  onReset: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onReset,
  onOpenSettings,
  onOpenHelp,
}) => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-sm font-bold text-lg">
            <Layers className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold text-stone-900 tracking-tight">
                手写素材标准化提取
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
                8点分段透视 · CV
              </span>
            </div>
            <p className="text-xs text-stone-500 hidden sm:block">
              3框无缝堆叠 (60×100mm) · 自动除影去框 · 标准透明PNG导出
            </p>
          </div>
        </div>

        {/* Steps Indicator */}
        <div className="hidden md:flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200/60 text-xs font-medium">
          <span
            className={`px-3 py-1 rounded-md transition-colors ${
              currentStep === 'upload'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500'
            }`}
          >
            1. 导入图片
          </span>
          <span className="text-stone-300">/</span>
          <span
            className={`px-3 py-1 rounded-md transition-colors ${
              currentStep === 'mesh'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500'
            }`}
          >
            2. 8点阶梯网格微调
          </span>
          <span className="text-stone-300">/</span>
          <span
            className={`px-3 py-1 rounded-md transition-colors ${
              currentStep === 'result'
                ? 'bg-white text-stone-900 shadow-xs font-semibold'
                : 'text-stone-500'
            }`}
          >
            3. 标准化素材导出
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {currentStep !== 'upload' && (
            <button
              id="header-restart-btn"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors border border-stone-200"
              title="重新选择图片"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">重选图片</span>
            </button>
          )}

          <button
            id="header-settings-btn"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 transition-colors border border-stone-200"
            title="算法参数调优"
          >
            <Sliders className="w-3.5 h-3.5 text-stone-600" />
            <span className="hidden sm:inline">参数配置</span>
          </button>

          <button
            id="header-help-btn"
            onClick={onOpenHelp}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            title="使用说明与测试规范"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
