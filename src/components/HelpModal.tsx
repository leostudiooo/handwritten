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
              1. 8 点阶梯网格联动与放大镜微调 (Section 3.2)
            </h4>
            <p className="text-[11px] leading-relaxed text-stone-600">
              纸张由于卷曲或透视会产生非均匀畸变。8 点网格分为 3 个连体矩形，其中 <strong>P2、P3</strong> 和 <strong>P4、P5</strong> 为相邻行的共用锚点。移动任一共用锚点，上下两行无缝联动。
              <br />
              <span className="text-amber-700 font-semibold">移动端优化：</span> 拖拽锚点时，上方 50px 自动弹出 2× 放大镜与十字准星，彻底解决手指遮挡视线问题。
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
              3. 高斯自适应除影与空行过滤 (Section 3.4 & 3.5)
            </h4>
            <p className="text-[11px] leading-relaxed text-stone-600">
              采用高斯积分自适应二值化算法，动态计算局部灰度均值，彻底剔除手机俯拍产生的大面积倾斜阴影。
              若字迹像素占比低于 0.3%（容错阈值），判定为空行并自动丢弃，不输出多余图片。
            </p>
          </div>

          {/* Step 4 */}
          <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/50">
            <h4 className="font-bold text-stone-900 mb-1.5 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-cyan-600" />
              4. 300 PPI 标准透明 PNG 导出 (Section 3.6)
            </h4>
            <p className="text-[11px] leading-relaxed text-stone-600">
              字迹居中缩放至标准尺寸（100mm × 20mm 对应 1182 × 236 px），白色背景转换为 100% 透明 Alpha 通道，支持单张下载、复制图像与批量 ZIP 打包。
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
