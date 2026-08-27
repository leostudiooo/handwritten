import React, { useState, useRef, useEffect } from 'react';
import {
  LadderPoints,
  ProcessingConfig,
  ProcessingResult,
} from './types';
import { autoPredictLadderMesh, runStandardizationPipeline } from './utils/cvEngine';
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
    targetWidth: 1182,          // 300 PPI @ 100mm
    targetHeight: 236,          // 300 PPI @ 20mm
    paddingCutPercentX: 5,      // 5% dead zone cut
    paddingCutPercentY: 5,
    adaptiveBlockSize: 37,      // Odd 31-65
    adaptiveC: 8,               // Constant C 5-20
    enableMorphClose: true,     // 2x2 repair
    emptyRowThresholdPercent: 0.3, // <0.3% empty discard
    invertResult: false,
    inkColor: '#000000',
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

    // Auto predict 8 points on preview image
    const initialMesh = autoPredictLadderMesh(prevImg.naturalWidth, prevImg.naturalHeight);
    setLadderMesh(initialMesh);

    setCurrentStep('mesh');
  };

  // Run Standardization Pipeline (Web Worker with Async Fallback)
  const handleRunProcessing = async () => {
    if (!originalImage || !previewImage) return;

    setIsProcessing(true);

    try {
      // 1. Map preview 8 points back to ORIGINAL image space (point.x * scaleRatio)
      const fullResMesh: LadderPoints = ladderMesh.map((pt) => ({
        x: Math.round(pt.x * scaleRatio),
        y: Math.round(pt.y * scaleRatio),
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
            config,
          });
        });
      } catch (workerErr) {
        console.warn('Web Worker execution fallback to microtask:', workerErr);
        // Fallback directly using CV Engine
        result = await runStandardizationPipeline(originalImageData, fullResMesh, config);
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
            onMeshChange={setLadderMesh}
            onGenerate={handleRunProcessing}
            isProcessing={isProcessing}
            onCancel={() => setCurrentStep('upload')}
            scenarioNotes={activeScenario?.notes}
          />
        )}

        {currentStep === 'result' && processingResult && (
          <ResultViewer
            result={processingResult}
            onBackToEdit={() => setCurrentStep('mesh')}
            onNewImage={handleReset}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={setConfig}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
