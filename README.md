# 手写素材标准化模块

一个基于 Vite、React 和 TypeScript 的半自动手写素材标准化前端模块。它可以把手写纸张照片、截图或相机输入校正为标准透明 PNG 行素材，适用于字帖、书法练习、手写识别前处理和素材归档。

## 功能特性

- 支持本地图片上传、相机拍摄、拖拽导入和剪贴板粘贴。
- 使用 8 点阶梯网格进行透视矫正，适配轻微卷曲、倾斜或手机拍摄变形。
- 提供自适应阈值、手动阈值、色度过滤和形态学处理参数。
- 可过滤红色/蓝色参考线、印章色、纸张泛黄和小面积噪点。
- 支持按行导出透明 PNG，并可批量打包为 ZIP。
- 内置预设样例，便于快速测试处理效果。

## 快速开始

本项目包含 `bun.lock`，推荐使用 Bun。

```bash
bun install
bun run dev
```

开发服务器默认运行在 `http://localhost:3000`，并通过 Vite 监听源码更新。

## 常用命令

```bash
bun run dev       # 启动本地开发服务器
bun run build     # 生成生产构建到 dist/
bun run preview   # 本地预览生产构建
bun run lint      # 执行 TypeScript 类型检查
bun run clean     # 清理 dist/ 和 server.js
```

## 使用流程

1. 在首页上传图片、拍照、拖拽文件，或直接粘贴剪贴板图片。
2. 在网格编辑器中拖动控制点，让阶梯网格贴合纸张行框。
3. 根据素材质量调整行数、阈值、色度过滤、噪点过滤和形态学参数。
4. 生成标准化结果后，复制单行 PNG、下载单张图片，或批量导出 ZIP。

## 项目结构

```text
src/
  App.tsx                    # 主应用状态与处理流程
  main.tsx                   # React 入口
  index.css                  # 全局样式与 Tailwind 引入
  components/                # UI 组件
  types/                     # 共享 TypeScript 类型
  utils/cvEngine.ts          # 图像处理与透视矫正核心逻辑
  utils/presetGenerators.ts  # 示例图片生成逻辑
  workers/cvWorker.ts        # Web Worker 图像处理入口
assets/                      # 静态或参考资源
```

## 配置

参考 `.env.example` 创建本地环境变量文件。`GEMINI_API_KEY` 和 `APP_URL` 主要用于 AI Studio 或部署环境注入。`vite.config.ts` 中的 `DISABLE_HMR=true` 会关闭 HMR 和文件监听，适合需要降低编辑期资源占用的环境。

## 开发约定

- UI 组件使用 React 函数组件和 TypeScript。
- 组件文件使用 PascalCase，例如 `ResultViewer.tsx`。
- 工具函数和变量使用 camelCase，例如 `runStandardizationPipeline`。
- 样式优先使用 Tailwind utility classes。
- 图像处理逻辑应放在 `src/utils/` 或 `src/workers/`，避免塞入 UI 组件。

## 验证

当前仓库还没有独立测试脚本。提交前至少运行：

```bash
bun run lint
bun run build
```

涉及 UI 或图像处理效果的改动，建议附带前后截图、样例图片或导出的 PNG/ZIP 结果，方便审核输出质量。
