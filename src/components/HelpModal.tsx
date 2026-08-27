import React from 'react';
import { X, BookOpen, CheckCircle, ShieldCheck, Zap, Grid } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                半自动手写标准化 · 技术与操作规范
              </h3>
              <p className="text-[11px] text-stone-500">
                固定尺寸 (h60mm × w100mm) 三框堆叠图像算法说明
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs text-stone-600">
          {/* Step 1 */}
          <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/50">
            <h4 className="font-bold text-stone-900 mb-1.5 flex items-center gap-1.5">
              <Grid className="w-4 h-4 text-amber-600" />
              1. 四角驱动等分与中间点微调 (Section 3.2)
            </h4>
            <p className="text-[11px] leading-relaxed text-stone-600">
              <strong>第一步</strong>：优先调整 4 个最外角点（<strong>P0, P1, P6, P7</strong>），系统自动按 1/3 与 2/3 线性带算中间点；
              <strong>第二步</strong>：如有纸张卷曲或格子高矮不一，再直接拖拽或方向键微调中间共用点（<strong>P2/P3, P4/P5</strong>）。
              <br />
              <span className="text-amber-700 font-semibold">精准微调：</span> 拖拽任意锚点时，上方自动弹出 2.4× 高清放大镜与十字准星，支持方向键 1px 级微调。
            </p>
          </div>

          {/* Step 2 */}
          <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/50">
            <h4 className="font-bold text-stone-900 mb-1.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-indigo-600" />
              2. 独立分块透视与死区裁切 (Section 3.3)
            </h4>
            <p className="text-[11px] leading-relaxed text-stone-600">
              Box 1 (P0,P1,P3,P2)、Box 2 (P2,P3,P5,P4)、Box 3 (P4,P5,P7,P6) 分别进行独立 <code>warpPerspective</code> 双线性插值映射，解决中部拱起卷曲。
              随后向内收缩 5%（Padding Cut）物理裁切手绘墨水框线。
            </p>
          </div>

          {/* Step 3 */}
          <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/50">
            <h4 className="font-bold text-stone-900 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              3. 二值化除影（自适应/手动阈值）与空行过滤 (Section 3.4 & 3.5)
            </h4>
            <p className="text-[11px] leading-relaxed text-stone-600">
              默认采用<strong>高斯积分自适应二值化</strong>算法，动态计算局部灰度均值，彻底消除手机俯拍产生的倾斜阴影；
              同时支持<strong>手动指定全局灰度阈值</strong>（0~255），方便精细控制墨迹深浅与干枯断笔。
              <br />
              若字迹像素占比低于 0.3%（容错阈值），判定为空行并自动丢弃，不输出多余图片。
            </p>
          </div>

          {/* Step 4 */}
          <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/50">
            <h4 className="font-bold text-stone-900 mb-1.5 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-cyan-600" />
              4. 600 DPI / 300 DPI 超清透明 PNG 导出 (Section 3.6)
            </h4>
            <p className="text-[11px] leading-relaxed text-stone-600">
              字迹居中缩放至超清出版级 600 DPI（100mm × 20mm 对应 2364 × 472 px）或 300 DPI 规格，白色背景转换为 100% 透明 Alpha 通道，支持单张下载、复制图像与批量 ZIP 打包。结合 600 DPI 高密度像素，形态学侵蚀/加粗支持亚毫米级（0.04mm）极致微调。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-lg shadow-xs transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};
