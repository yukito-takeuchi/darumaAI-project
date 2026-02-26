export interface ReferenceImage {
  id: string;
  data: string; // Base64
  mimeType: string;
  name: string;
}

export interface DesignRequest {
  prompt: string;
  style: string;
  size: '5cm' | '11cm';
  referenceImages: ReferenceImage[];
}

export interface GeneratedDesign {
  id: string;
  imageUrl: string;
  promptUsed: string;
  timestamp: number;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}