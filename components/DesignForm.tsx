import React, { useState, ChangeEvent, DragEvent } from 'react';
import { DesignRequest, GenerationStatus, ReferenceImage } from '../types';

interface DesignFormProps {
  onGenerate: (req: DesignRequest) => void;
  status: GenerationStatus;
}

export const DesignForm: React.FC<DesignFormProps> = ({ onGenerate, status }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [size, setSize] = useState<'5cm' | '11cm' | '17cm'>('5cm');
  const [glossy, setGlossy] = useState(true);
  const [brandColorEnabled, setBrandColorEnabled] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [brandColors, setBrandColors] = useState<[string, string, string]>(['#E60012', '#FFFFFF', '#000000']);
  const [patternCount, setPatternCount] = useState<3 | 6>(3);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const isGenerating = status === GenerationStatus.GENERATING;

  const processFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setReferenceImages(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            name: file.name,
            mimeType: file.type,
            data: base64String.split(',')[1],
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isGenerating) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isGenerating) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
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
      glossy,
      brandColors: brandColorEnabled.some(e => e)
        ? brandColors.filter((_, i) => brandColorEnabled[i])
        : undefined,
      patternCount,
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
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: '5cm',  label: '5cm',  desc: '可愛いらしい\n密度高め' },
              { value: '11cm', label: '11cm', desc: '迫力重視\n詳細な描き込み' },
              { value: '17cm', label: '17cm', desc: '最大サイズ\n精緻な仕上げ' },
            ] as const).map(({ value, label, desc }) => (
              <label key={value} className={`
                cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition-all
                ${size === value ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 hover:border-stone-300 text-stone-600'}
              `}>
                <input
                  type="radio"
                  name="size"
                  value={value}
                  checked={size === value}
                  onChange={() => setSize(value)}
                  className="hidden"
                />
                <span className="font-bold text-lg">{label}</span>
                <span className="text-[10px] text-center whitespace-pre-line leading-tight">{desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Glossy Toggle */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              role="switch"
              aria-checked={glossy}
              onClick={() => setGlossy(!glossy)}
              className={`
                relative w-11 h-6 rounded-full transition-colors
                ${glossy ? 'bg-red-500' : 'bg-stone-300'}
              `}
            >
              <div className={`
                absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                ${glossy ? 'translate-x-5' : 'translate-x-0'}
              `} />
            </div>
            <div>
              <span className="text-sm font-bold text-stone-700">光沢感（漆風グロス仕上げ）</span>
              <p className="text-[10px] text-stone-400">{glossy ? 'ON — 艶やかな漆塗り風の光沢' : 'OFF — マットな質感'}</p>
            </div>
          </label>
        </div>

        {/* Brand Colors */}
        <div>
          <p className="text-sm font-bold text-stone-700 mb-3">ブランドカラー指定（最大3色）</p>
          <div className="space-y-3">
            {(['メイン', 'サブ', 'アクセント'] as const).map((label, i) => (
              <div key={i}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    role="switch"
                    aria-checked={brandColorEnabled[i]}
                    onClick={() => {
                      const next: [boolean, boolean, boolean] = [...brandColorEnabled] as [boolean, boolean, boolean];
                      next[i] = !next[i];
                      setBrandColorEnabled(next);
                    }}
                    className={`
                      relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                      ${brandColorEnabled[i] ? 'bg-red-500' : 'bg-stone-300'}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                      ${brandColorEnabled[i] ? 'translate-x-5' : 'translate-x-0'}
                    `} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-stone-700">カラー{i + 1}（{label}）</span>
                    <p className="text-[10px] text-stone-400">{brandColorEnabled[i] ? 'ON — 指定色を使用' : 'OFF — AI任せ'}</p>
                  </div>
                </label>

                {brandColorEnabled[i] && (
                  <div className="mt-2 flex items-center gap-3 pl-14">
                    <input
                      type="color"
                      value={brandColors[i]}
                      onChange={(e) => {
                        const next: [string, string, string] = [...brandColors] as [string, string, string];
                        next[i] = e.target.value;
                        setBrandColors(next);
                      }}
                      disabled={isGenerating}
                      className="w-10 h-10 rounded-lg border border-stone-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={brandColors[i].toUpperCase()}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                          const next: [string, string, string] = [...brandColors] as [string, string, string];
                          next[i] = v;
                          setBrandColors(next);
                        }
                      }}
                      disabled={isGenerating}
                      maxLength={7}
                      className="w-24 bg-stone-50 border border-stone-300 text-stone-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 p-2 font-mono"
                      placeholder="#FF0000"
                    />
                    <div
                      className="w-8 h-8 rounded-full border border-stone-200 shadow-inner flex-shrink-0"
                      style={{ backgroundColor: brandColors[i] }}
                    />
                  </div>
                )}
              </div>
            ))}
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
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-6 text-center transition-all
                ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${isDragging ? 'border-red-500 bg-red-50 scale-[1.01]' : 'border-stone-300 bg-stone-50 hover:border-red-400 hover:bg-red-50'}
              `}
            >
              <label className="block cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={isGenerating}
                />
                <div className="text-stone-500 pointer-events-none">
                  <div className="flex justify-center mb-2 text-stone-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  {isDragging
                    ? <p className="font-medium text-red-600">ここにドロップ</p>
                    : <>
                        <p className="font-medium">クリックまたはドラッグ&amp;ドロップで素材を追加</p>
                        <p className="text-xs mt-1 text-stone-400">ロゴ、キャラ、配色見本など複数可</p>
                      </>
                  }
                </div>
              </label>
            </div>
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

        {/* Pattern Count & Submit */}
        <div className="pt-2 space-y-3">
          {/* 枚数切り替え */}
          <div>
            <p className="text-xs font-bold text-stone-500 mb-2">生成枚数</p>
            <div className="grid grid-cols-2 gap-2">
              {([3, 6] as const).map(n => (
                <label key={n} className={`
                  cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-1 transition-all
                  ${patternCount === n ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 hover:border-stone-300 text-stone-500'}
                `}>
                  <input
                    type="radio"
                    name="patternCount"
                    value={n}
                    checked={patternCount === n}
                    onChange={() => setPatternCount(n)}
                    className="hidden"
                  />
                  <span className="font-bold text-base">{n}枚</span>
                  <span className="text-[10px]">{n === 3 ? 'スタンダード（推奨）' : 'ワイド（クレジット消費大）'}</span>
                </label>
              ))}
            </div>
          </div>

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
              `${size}用デザイン案を${patternCount}枚生成`
            )}
          </button>
        </div>

      </form>
    </div>
  );
};