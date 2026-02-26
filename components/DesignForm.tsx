import React, { useState, ChangeEvent } from 'react';
import { DesignRequest, GenerationStatus, ReferenceImage } from '../types';

interface DesignFormProps {
  onGenerate: (req: DesignRequest) => void;
  status: GenerationStatus;
}

export const DesignForm: React.FC<DesignFormProps> = ({ onGenerate, status }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [size, setSize] = useState<'5cm' | '11cm'>('5cm');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);

  const isGenerating = status === GenerationStatus.GENERATING;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Content = base64String.split(',')[1];
          
          setReferenceImages(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(7),
              name: file.name,
              mimeType: file.type,
              data: base64Content
            }
          ]);
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input value to allow selecting the same file again if needed
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      prompt,
      style,
      size,
      referenceImages
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 md:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Size Selection */}
        <div>
           <label className="block text-sm font-bold text-stone-700 mb-2">
            達磨のサイズ（フォーマット）
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={`
              cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all
              ${size === '5cm' ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 hover:border-stone-300 text-stone-600'}
            `}>
              <input 
                type="radio" 
                name="size" 
                value="5cm" 
                checked={size === '5cm'} 
                onChange={() => setSize('5cm')}
                className="hidden"
              />
              <span className="font-bold text-lg">5cm</span>
              <span className="text-xs">可愛いらしい・密度高め</span>
            </label>
            
            <label className={`
              cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all
              ${size === '11cm' ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 hover:border-stone-300 text-stone-600'}
            `}>
              <input 
                type="radio" 
                name="size" 
                value="11cm" 
                checked={size === '11cm'} 
                onChange={() => setSize('11cm')}
                className="hidden"
              />
              <span className="font-bold text-lg">11cm</span>
              <span className="text-xs">迫力重視・詳細な描き込み</span>
            </label>
          </div>
        </div>

        {/* Reference Images Upload (Multiple) */}
        <div>
          <label className="block text-sm font-bold text-stone-700 mb-2">
            参考素材（ロゴ、キャラクター、色彩など）
          </label>
          
          <div className="space-y-3">
             {/* Image List */}
             {referenceImages.length > 0 && (
               <div className="grid grid-cols-2 gap-3 mb-3">
                 {referenceImages.map((img) => (
                   <div key={img.id} className="relative group border border-stone-200 rounded-lg p-2 bg-stone-50 flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded border border-stone-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                         <img src={`data:${img.mimeType};base64,${img.data}`} alt="preview" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-stone-700 truncate" title={img.name}>{img.name}</p>
                        <p className="text-[10px] text-stone-400">参考画像</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="p-1 hover:bg-stone-200 rounded-full text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                   </div>
                 ))}
               </div>
             )}

            {/* Upload Button */}
            <label className="block">
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                multiple
                onChange={handleFileChange}
                disabled={isGenerating}
              />
              <div className={`
                border-2 border-dashed rounded-xl p-6 text-center transition-all
                ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:border-red-400 hover:bg-red-50 cursor-pointer'}
                border-stone-300 bg-stone-50
              `}>
                <div className="text-stone-500">
                  <div className="flex justify-center mb-2 text-stone-400">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                     </svg>
                  </div>
                  <p className="font-medium">クリックして素材を追加</p>
                  <p className="text-xs mt-1 text-stone-400">ロゴ、キャラ、配色見本など複数選択可</p>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Tone & Manner */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">
              デザインのトーン＆マナー
            </label>
            <textarea
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              disabled={isGenerating}
              rows={3}
              className="w-full bg-stone-50 border border-stone-300 text-stone-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-3 resize-y"
              placeholder="例：サイバーパンク風、ネオンカラー、未来的、メタリックな質感"
            />
          </div>

          {/* Prompt */}
          <div>
             <label className="block text-sm font-bold text-stone-700 mb-2">
              具体的な指示（モチーフ、詳細）
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例：背面に大きな龍の刺繍、顔は厳めしく、右手に扇子を持たせる。全体的に暗めのトーンで。"
              disabled={isGenerating}
              rows={4}
              className="w-full bg-stone-50 border border-stone-300 text-stone-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block p-3 resize-y"
            />
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isGenerating}
            className={`
              w-full py-4 px-6 rounded-xl font-bold text-lg text-white shadow-lg transition-all
              ${isGenerating 
                ? 'bg-stone-400 cursor-wait' 
                : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 hover:shadow-red-200 transform hover:-translate-y-0.5'}
            `}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {size}デザイン案を生成中...
              </span>
            ) : (
              `${size}用デザイン案を3つ生成`
            )}
          </button>
        </div>

      </form>
    </div>
  );
};