export interface ReferenceImage {
  id: string;
  data: string; // Base64
  mimeType: string;
  name: string;
}

export interface DesignRequest {
  prompt: string;
  style: string;
  size: '5cm' | '11cm' | '17cm';
  glossy: boolean;
  brandColors?: string[];
  patternCount: 1 | 3 | 6;
  portrait?: { data: string; mimeType: string };
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

/** フォトリアル写真の種類: サンプル風 / 実物・商品写真風 */
export type PhotorealisticStyle = 'sample' | 'product';

export interface PhotorealisticOptions {
  withKeychain?: boolean;
}

export interface GeneratedPhotorealistic {
  designId: string;
  imageUrl: string;
  style: PhotorealisticStyle;
  timestamp: number;
}