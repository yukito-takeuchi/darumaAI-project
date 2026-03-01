import React, { useState } from 'react';
import { ApiKeyChecker } from './components/ApiKeyChecker';
import { Hero } from './components/Hero';
import { DesignForm } from './components/DesignForm';
import { ResultsGrid } from './components/ResultsGrid';
import { DesignRequest, GeneratedDesign, GenerationStatus, GeneratedPhotorealistic, PhotorealisticStyle, PhotorealisticOptions } from './types';
import { generateDarumaDesigns, refineDarumaDesign, generatePhotorealisticPhoto } from './services/geminiService';

const App: React.FC = () => {
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [results, setResults] = useState<GeneratedDesign[]>([]);
  const [photorealisticResults, setPhotorealisticResults] = useState<GeneratedPhotorealistic[]>([]);
  const [photorealisticGenerating, setPhotorealisticGenerating] = useState<Array<{ designId: string; style: PhotorealisticStyle }>>([]);

  // Callback when API Key is selected/verified
  const handleApiKeyReady = () => {
    setIsApiKeyReady(true);
  };

  const handleGenerate = async (request: DesignRequest) => {
    setStatus(GenerationStatus.GENERATING);
    setResults([]);
    setPhotorealisticResults([]);
    setPhotorealisticGenerating([]);

    try {
      const generatedDesigns = await generateDarumaDesigns(request);
      setResults(generatedDesigns);
      setStatus(GenerationStatus.COMPLETED);
    } catch (error) {
      console.error("Generation failed", error);
      setStatus(GenerationStatus.ERROR);
      // In a real app, show a toast or error message
      alert("デザインの生成に失敗しました。再試行するか、APIクォータを確認してください。");
    }
  };

  const handleRefine = async (id: string, instruction: string, annotationImage?: { data: string; mimeType: string }): Promise<void> => {
    const designToRefine = results.find(r => r.id === id);
    if (!designToRefine) return;

    try {
      const newImageUrl = await refineDarumaDesign(designToRefine.imageUrl, instruction, annotationImage);
      
      if (newImageUrl) {
        setResults(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              imageUrl: newImageUrl,
              timestamp: Date.now()
            };
          }
          return item;
        }));
        setPhotorealisticResults(prev => prev.filter(p => p.designId !== id));
      }
    } catch (error) {
      console.error("Refinement failed", error);
      throw error;
    }
  };

  const handleGeneratePhotorealistic = async (
    designId: string,
    imageUrl: string,
    style: PhotorealisticStyle,
    options?: PhotorealisticOptions
  ): Promise<void> => {
    const key = { designId, style };
    setPhotorealisticGenerating(prev => [...prev, key]);
    try {
      const photo = await generatePhotorealisticPhoto(imageUrl, designId, style, options);
      if (photo) {
        setPhotorealisticResults(prev => {
          const without = prev.filter(p => !(p.designId === designId && p.style === style));
          return [...without, photo];
        });
      }
    } catch (error) {
      console.error("Photorealistic generation failed", error);
      alert("フォトリアル写真の生成に失敗しました。再試行してください。");
    } finally {
      setPhotorealisticGenerating(prev => prev.filter(p => !(p.designId === designId && p.style === style)));
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      
      {/* 1. API Key Interstitial */}
      {!isApiKeyReady && <ApiKeyChecker onReady={handleApiKeyReady} />}

      {/* 2. Main App Content (Only rendered if API Key is ready) */}
      {isApiKeyReady && (
        <>
          <Hero />
          
          <main className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Left Column: Input */}
              <div className="lg:col-span-4 xl:col-span-3">
                <div className="sticky top-8">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-stone-800">デザイン設定</h3>
                    <p className="text-sm text-stone-500">パラメータを設定してください</p>
                  </div>
                  <DesignForm onGenerate={handleGenerate} status={status} />
                  
                  {/* Status Indicator */}
                  {status === GenerationStatus.GENERATING && (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                        高精細なテクスチャを生成しています... 最大30秒ほどかかる場合があります。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Output */}
              <div className="lg:col-span-8 xl:col-span-9">
                
                {status === GenerationStatus.IDLE && (
                   <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-2xl bg-white/50 text-stone-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4 opacity-50">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.077-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                      </svg>
                      <p className="font-medium">詳細を入力し、ロゴをアップロードして開始してください</p>
                   </div>
                )}

                <ResultsGrid
                  results={results}
                  onRefine={handleRefine}
                  photorealisticResults={photorealisticResults}
                  photorealisticGenerating={photorealisticGenerating}
                  onGeneratePhotorealistic={handleGeneratePhotorealistic}
                />

              </div>
            </div>
          </main>
        </>
      )}
    </div>
  );
};

export default App;