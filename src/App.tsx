import React, { useState, useRef, useEffect } from 'react';
import {
  LadderPoints,
  ProcessingConfig,
  ProcessingResult,
} from './types';
import {
  autoPredictLadderMesh,
  estimateGlobalManualThreshold,
  runStandardizationPipeline,
} from './utils/cvEngine';
import { PRESET_SCENARIOS } from './utils/presetGenerators';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { LadderGridEditor } from './components/LadderGridEditor';
import { ResultViewer } from './components/ResultViewer';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const [currentStep, setCurrentStep] = useState<'upload' | 'mesh' | 'result'>('upload');

  // Images state
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
  const [scaleRatio, setScaleRatio] = useState<number>(1);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // 8-point ladder mesh in PREVIEW canvas coordinates
  const [ladderMesh, setLadderMesh] = useState<LadderPoints>([
    { x: 100, y: 100 },
    { x: 700, y: 100 },
    { x: 100, y: 220 },
    { x: 700, y: 220 },
    { x: 100, y: 340 },
    { x: 700, y: 340 },
    { x: 100, y: 460 },
    { x: 700, y: 460 },
  ]);

  // CV Pipeline parameters
  const [config, setConfig] = useState<ProcessingConfig>({
    rowCount: 3,                // Default 3 rows (100x20mm each)
    targetWidth: 2364,          // 600 DPI @ 100mm (Ultra-high precision for morphological editing)
    targetHeight: 472,          // 600 DPI @ 20mm
    outputDpi: 600,             // Embed PNG density metadata
    paddingCutPxX: 24,          // Fixed-pixel dead zone cut
    paddingCutPxY: 24,
    thresholdMode: 'manual',    // Manual global threshold seeded by CV auto-detection
    manualThreshold: 140,       // Replaced with detected threshold after image load
    autoThreshold: 140,         // Latest CV-detected global threshold suggestion
    thresholdSource: 'auto',    // Preserve user edits once the slider is changed
    enableMorphClose: true,     // Morph repair
    morphMode: 'none',          // 'none' | 'erode' | 'dilate' | 'open' | 'close'
    morphStrength: 1,           // 1 to 6 px for 600 DPI
    minNoiseArea: 16,           // 16px speckle/noise removal for 600 DPI
    emptyRowThresholdPercent: 0.3, // <0.3% empty discard
    invertResult: false,
    inkColor: '#000000',
    chromaSensitivity: 0,        // 0-100: 0 = off, 1-100 = chroma filter sensitivity
  });

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Active scenario description
  const activeScenario = PRESET_SCENARIOS.find((p) => p.id === activePresetId);

  // Handle Image Selected
  const handleImageSelected = (
    origImg: HTMLImageElement,
    prevImg: HTMLImageElement,
    ratio: number,
    presetId?: string
  ) => {
    setOriginalImage(origImg);
    setPreviewImage(prevImg);
    setScaleRatio(ratio);
    setActivePresetId(presetId || null);

    // Auto predict mesh on preview image with edge detection
    let initialMesh: LadderPoints;
    const currentRows = config.rowCount || 3;
    try {
      const cvs = document.createElement('canvas');
      cvs.width = prevImg.naturalWidth;
      cvs.height = prevImg.naturalHeight;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        ctx.drawImage(prevImg, 0, 0);
        const imgData = ctx.getImageData(0, 0, prevImg.naturalWidth, prevImg.naturalHeight);
        initialMesh = autoPredictLadderMesh(prevImg.naturalWidth, prevImg.naturalHeight, imgData, currentRows);
      } else {
        initialMesh = autoPredictLadderMesh(prevImg.naturalWidth, prevImg.naturalHeight, undefined, currentRows);
      }
    } catch {
      initialMesh = autoPredictLadderMesh(prevImg.naturalWidth, prevImg.naturalHeight, undefined, currentRows);
    }
    setLadderMesh(initialMesh);

    try {
      const scaleX = origImg.naturalWidth / prevImg.naturalWidth;
      const scaleY = origImg.naturalHeight / prevImg.naturalHeight;
      const fullResInitialMesh: LadderPoints = initialMesh.map((pt) => ({
        x: Math.round(pt.x * scaleX),
        y: Math.round(pt.y * scaleY),
      })) as LadderPoints;
      const imageCanvas = document.createElement('canvas');
      imageCanvas.width = origImg.naturalWidth;
      imageCanvas.height = origImg.naturalHeight;
      const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
      if (imageCtx) {
        imageCtx.drawImage(origImg, 0, 0);
        const imageData = imageCtx.getImageData(0, 0, origImg.naturalWidth, origImg.naturalHeight);
        const detectedThreshold = estimateGlobalManualThreshold(
          imageData,
          fullResInitialMesh,
          { ...config, thresholdMode: 'manual' }
        );
        setConfig((prev) => ({
          ...prev,
          thresholdMode: 'manual',
          manualThreshold: detectedThreshold,
          autoThreshold: detectedThreshold,
          thresholdSource: 'auto',
        }));
      }
    } catch (err) {
      console.warn('Automatic threshold estimation failed; keeping existing manual threshold:', err);
      setConfig((prev) => ({ ...prev, thresholdMode: 'manual' }));
    }

    setCurrentStep('mesh');
  };

  // Run Standardization Pipeline (Web Worker with Async Fallback)
  const handleRunProcessing = async (overrideConfig?: ProcessingConfig) => {
    if (!originalImage || !previewImage) return;

    const currentConfig = overrideConfig || config;

    setIsProcessing(true);

    try {
      // 1. Map preview points back to ORIGINAL image space.
      // Preview dimensions can be rounded independently, so keep X/Y scales separate.
      const scaleX = originalImage.naturalWidth / previewImage.naturalWidth;
      const scaleY = originalImage.naturalHeight / previewImage.naturalHeight;
      const fullResMesh: LadderPoints = ladderMesh.map((pt) => ({
        x: Math.round(pt.x * scaleX),
        y: Math.round(pt.y * scaleY),
      })) as LadderPoints;

      // 2. Prepare original image ImageData
      const canvas = document.createElement('canvas');
      canvas.width = originalImage.naturalWidth;
      canvas.height = originalImage.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas 2D context creation failed');

      ctx.drawImage(originalImage, 0, 0);
      const originalImageData = ctx.getImageData(
        0,
        0,
        originalImage.naturalWidth,
        originalImage.naturalHeight
      );

      const detectedThreshold = estimateGlobalManualThreshold(
        originalImageData,
        fullResMesh,
        { ...currentConfig, thresholdMode: 'manual' }
      );
      const shouldUseDetectedThreshold =
        currentConfig.thresholdSource !== 'manual' &&
        (currentConfig.autoThreshold === undefined ||
          currentConfig.manualThreshold === undefined ||
          currentConfig.manualThreshold === currentConfig.autoThreshold ||
          currentConfig.thresholdSource === 'auto');
      const processingConfig: ProcessingConfig = {
        ...currentConfig,
        thresholdMode: 'manual',
        manualThreshold: shouldUseDetectedThreshold
          ? detectedThreshold
          : currentConfig.manualThreshold,
        autoThreshold: detectedThreshold,
        thresholdSource: shouldUseDetectedThreshold ? 'auto' : 'manual',
      };
      setConfig(processingConfig);

      // 3. Attempt Web Worker execution for non-blocking UI
      let result: ProcessingResult;

      try {
        result = await new Promise<ProcessingResult>((resolve, reject) => {
          // Construct inline or module Web Worker
          const worker = new Worker(
            new URL('./workers/cvWorker.ts', import.meta.url),
            { type: 'module' }
          );

          worker.onmessage = (e) => {
            if (e.data.type === 'PROCESS_SUCCESS') {
              worker.terminate();
              resolve(e.data.result);
            } else {
              worker.terminate();
              reject(new Error(e.data.error || 'Worker error'));
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            reject(err);
          };

          worker.postMessage({
            type: 'PROCESS_IMAGE',
            imageData: originalImageData,
            mesh: fullResMesh,
            config: processingConfig,
          });
        });
      } catch (workerErr) {
        console.warn('Web Worker execution fallback to microtask:', workerErr);
        // Fallback directly using CV Engine
        result = await runStandardizationPipeline(originalImageData, fullResMesh, processingConfig);
      }

      setProcessingResult(result);
      setCurrentStep('result');
    } catch (err: any) {
      console.error('Processing failed:', err);
      alert(`处理失败: ${err?.message || '未知错误'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = (newConfig: ProcessingConfig) => {
    setConfig(newConfig);
    if (currentStep === 'result' && originalImage && previewImage) {
      handleRunProcessing(newConfig);
    }
  };

  const handleReset = () => {
    setOriginalImage(null);
    setPreviewImage(null);
    setProcessingResult(null);
    setActivePresetId(null);
    setCurrentStep('upload');
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans antialiased">
      {/* Navigation Header */}
      <Header
        currentStep={currentStep}
        onReset={handleReset}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {currentStep === 'upload' && (
          <ImageUploader
            onImageSelected={handleImageSelected}
            isLoadingPresets={isLoadingPresets}
            setIsLoadingPresets={setIsLoadingPresets}
          />
        )}

        {currentStep === 'mesh' && previewImage && (
          <LadderGridEditor
            previewImg={previewImage}
            scaleRatio={scaleRatio}
            ladderMesh={ladderMesh}
            config={config}
            onMeshChange={setLadderMesh}
            onConfigChange={setConfig}
            onGenerate={() => handleRunProcessing()}
            isProcessing={isProcessing}
            onCancel={() => setCurrentStep('upload')}
            scenarioNotes={activeScenario?.notes}
          />
        )}

        {currentStep === 'result' && processingResult && (
          <ResultViewer
            result={processingResult}
            config={config}
            onUpdateConfigAndRerun={handleRunProcessing}
            onUpdateResult={setProcessingResult}
            onBackToEdit={() => setCurrentStep('mesh')}
            onNewImage={handleReset}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isProcessing={isProcessing}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveSettings}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
