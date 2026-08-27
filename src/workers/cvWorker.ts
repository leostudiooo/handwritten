import { LadderPoints, ProcessingConfig, ProcessingResult } from '../types';
import { runStandardizationPipeline } from '../utils/cvEngine';

export interface WorkerInputMessage {
  type: 'PROCESS_IMAGE';
  imageData: ImageData;
  mesh: LadderPoints;
  config: ProcessingConfig;
}

export interface WorkerOutputMessage {
  type: 'PROCESS_SUCCESS' | 'PROCESS_ERROR';
  result?: ProcessingResult;
  error?: string;
}

// Check if running in worker context
if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('message', async (e: MessageEvent<WorkerInputMessage>) => {
    if (e.data.type === 'PROCESS_IMAGE') {
      try {
        const { imageData, mesh, config } = e.data;
        const result = await runStandardizationPipeline(imageData, mesh, config);
        
        // Explicitly clean up reference
        const response: WorkerOutputMessage = {
          type: 'PROCESS_SUCCESS',
          result,
        };
        self.postMessage(response);
      } catch (err: any) {
        const errorResponse: WorkerOutputMessage = {
          type: 'PROCESS_ERROR',
          error: err?.message || 'Processing failed inside Web Worker',
        };
        self.postMessage(errorResponse);
      }
    }
  });
}
