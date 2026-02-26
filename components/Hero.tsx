import React from 'react';

export const Hero: React.FC = () => {
  return (
    <div className="relative bg-stone-900 text-white overflow-hidden rounded-b-3xl shadow-2xl mb-8">
      <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/1920/600?grayscale')] bg-cover bg-center mix-blend-overlay pointer-events-none"></div>
      <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-20 lg:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
          <span className="text-red-600">DARUMA</span> GEN PRO
        </h1>
        <p className="text-lg md:text-xl text-stone-300 max-w-2xl mx-auto mb-2">
          AI搭載 だるまデザイン生成システム
        </p>
        <div className="flex justify-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-widest">
           <span>Gemini 3 Pro</span>
           <span>•</span>
           <span>四面図生成</span>
           <span>•</span>
           <span>エンタープライズ</span>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-x-1/2 translate-y-1/2"></div>
    </div>
  );
};