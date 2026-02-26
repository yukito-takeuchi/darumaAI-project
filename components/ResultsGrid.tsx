import React, { useState } from 'react';
import { GeneratedDesign } from '../types';
import { jsPDF } from "jspdf";

interface ResultsGridProps {
  results: GeneratedDesign[];
  onRefine?: (id: string, instruction: string) => Promise<void>;
}

export const ResultsGrid: React.FC<ResultsGridProps> = ({ results, onRefine }) => {
  // State to track which card is currently being edited
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState<string>('');
  const [refiningIds, setRefiningIds] = useState<Set<string>>(new Set());

  if (results.length === 0) return null;

  const handleDownloadPDF = (imageUrl: string, filename: string, extension: 'pdf' | 'ai') => {
    // A4 Landscape size in mm
    // A4 is 297 x 210 mm
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const imgProps = doc.getImageProperties(imageUrl);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    
    // Scale image to fit page with some margin
    const margin = 10;
    const availableWidth = pdfWidth - (margin * 2);
    const availableHeight = pdfHeight - (margin * 2);
    
    const ratio = Math.min(availableWidth / imgProps.width, availableHeight / imgProps.height);
    const w = imgProps.width * ratio;
    const h = imgProps.height * ratio;
    const x = (pdfWidth - w) / 2;
    const y = (pdfHeight - h) / 2;

    doc.addImage(imageUrl, 'PNG', x, y, w, h);
    doc.save(`${filename}.${extension}`);
  };

  const handleRefineSubmit = async (id: string) => {
    if (!refinePrompt.trim() || !onRefine) return;

    setRefiningIds(prev => new Set(prev).add(id));
    try {
      await onRefine(id, refinePrompt);
      // Close edit mode and clear prompt on success
      setEditModeId(null);
      setRefinePrompt('');
    } catch (e) {
      alert("修正に失敗しました。");
    } finally {
      setRefiningIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleEditMode = (id: string) => {
    if (editModeId === id) {
      setEditModeId(null);
    } else {
      setEditModeId(id);
      setRefinePrompt('');
    }
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-stone-800">生成されたデザイン案</h2>
        <span className="text-sm font-mono text-stone-500">{results.length}件のデザインが完成</span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {results.map((design, index) => {
            const isRefining = refiningIds.has(design.id);
            const isEditing = editModeId === design.id;

            return (
              <div key={design.id} className="group bg-white rounded-2xl overflow-hidden shadow-lg border border-stone-200 transition-all hover:shadow-2xl hover:border-red-200 flex flex-col">
                {/* Header */}
                <div className="bg-stone-100 px-4 py-3 border-b border-stone-200 flex justify-between items-center">
                  <span className="font-bold text-stone-600">パターン {String.fromCharCode(65 + index)}</span>
                  <span className="text-xs bg-stone-200 text-stone-600 px-2 py-1 rounded">2K RES</span>
                </div>

                {/* Image Container */}
                <div className="relative aspect-video bg-stone-900 overflow-hidden">
                   <img 
                     src={design.imageUrl} 
                     alt={`Design Pattern ${index + 1}`} 
                     className={`w-full h-full object-cover transition-transform duration-700 ${isRefining ? 'opacity-50 blur-sm' : 'group-hover:scale-105'}`}
                   />
                   
                   {/* Refining Overlay */}
                   {isRefining && (
                     <div className="absolute inset-0 flex items-center justify-center">
                       <div className="bg-stone-900/80 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                         <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         修正中...
                       </div>
                     </div>
                   )}
                </div>

                {/* Footer & Actions */}
                <div className="p-4 bg-white flex-1 flex flex-col">
                   <div className="flex gap-2 mb-4">
                     <div className="h-2 w-2 rounded-full bg-red-500"></div>
                     <div className="h-2 w-2 rounded-full bg-stone-300"></div>
                     <div className="h-2 w-2 rounded-full bg-stone-300"></div>
                     <div className="h-2 w-2 rounded-full bg-stone-300"></div>
                   </div>
                   
                   <div className="flex flex-col gap-2 mt-auto">
                     {/* Download Buttons */}
                     <div className="grid grid-cols-2 gap-2">
                       <button 
                          onClick={() => handleDownloadPDF(design.imageUrl, `daruma-design-${index + 1}`, 'pdf')}
                          disabled={isRefining}
                          className="py-2 px-2 bg-stone-800 text-white rounded-lg text-xs font-bold hover:bg-stone-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                       >
                          PDF
                       </button>
                       <button 
                          onClick={() => handleDownloadPDF(design.imageUrl, `daruma-design-${index + 1}`, 'ai')}
                          disabled={isRefining}
                          className="py-2 px-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-500 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                       >
                          AI形式
                       </button>
                     </div>
                      <a 
                        href={design.imageUrl} 
                        download={`daruma-design-${index + 1}.png`}
                        className={`w-full py-2 px-4 border border-stone-200 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 ${isRefining ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        PNG (オリジナル)
                      </a>
                      
                      {/* Refine Toggle */}
                      {onRefine && (
                        <button
                          onClick={() => toggleEditMode(design.id)}
                          disabled={isRefining}
                          className={`mt-2 text-xs font-bold flex items-center justify-center gap-1 py-2 rounded-lg transition-colors
                            ${isEditing 
                              ? 'bg-red-50 text-red-600 border border-red-200' 
                              : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                            }
                          `}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l2.846-.813a1.126 1.126 0 00.417-.15l4.383-4.383a1.126 1.126 0 000-1.591l-1.666-1.666a1.126 1.126 0 00-1.591 0L9 15.487a1.126 1.126 0 00-.187.417zM18.75 8.25l-2.25 2.25" />
                          </svg>
                          {isEditing ? '修正をキャンセル' : 'このデザインを修正'}
                        </button>
                      )}
                   </div>
                   
                   {/* Refine Input Area */}
                   {isEditing && (
                     <div className="mt-4 pt-4 border-t border-stone-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <textarea
                          value={refinePrompt}
                          onChange={(e) => setRefinePrompt(e.target.value)}
                          placeholder="例: 背景を青に変更、目の色を金にして"
                          className="w-full text-sm p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none bg-stone-50"
                          rows={2}
                          disabled={isRefining}
                        />
                        <button
                          onClick={() => handleRefineSubmit(design.id)}
                          disabled={!refinePrompt.trim() || isRefining}
                          className="mt-2 w-full bg-red-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-red-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {isRefining ? '修正中...' : '修正を適用'}
                        </button>
                     </div>
                   )}

                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};