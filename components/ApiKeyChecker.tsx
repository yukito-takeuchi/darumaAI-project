import React, { useEffect, useState, useCallback } from 'react';

// Declaration for the AI Studio window object injection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Fix: Make aistudio optional to match potential existing declarations and avoid modifier conflict
    aistudio?: AIStudio;
  }
}

interface ApiKeyCheckerProps {
  onReady: () => void;
}

export const ApiKeyChecker: React.FC<ApiKeyCheckerProps> = ({ onReady }) => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAIStudio, setIsAIStudio] = useState<boolean>(false);

  const checkKey = useCallback(async () => {
    try {
      // 1. 環境変数 (process.env.API_KEY) が設定されているか確認
      // 一般的なデプロイ環境ではここでキーが検出されるはずです
      if (process.env.API_KEY && process.env.API_KEY.length > 0) {
        setHasKey(true);
        onReady();
        // 環境変数が有効ならロード完了とする
        setLoading(false);
        return;
      }

      // 2. AI Studio 環境のチェック
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        setIsAIStudio(true);
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
        if (selected) {
          onReady();
        }
      }
    } catch (e) {
      console.error("Failed to check API key", e);
    } finally {
      setLoading(false);
    }
  }, [onReady]);

  useEffect(() => {
    checkKey();
  }, [checkKey]);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        // Fix: Assume the key selection was successful after triggering openSelectKey()
        // and proceed to the app. Do not add delay to mitigate the race condition.
        onReady();
      } catch (e) {
        console.error("Error opening key selector", e);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-red-600 rounded-full mb-4"></div>
          <p className="text-stone-500 font-medium">初期化中...</p>
        </div>
      </div>
    );
  }

  // キーがなく、アプリの準備ができていない場合
  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-stone-200">
          <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-stone-900 mb-2">APIキーが必要です</h2>

          {isAIStudio ? (
            // AI Studio環境の場合の表示
            <>
              <p className="text-stone-600 mb-8">
                <strong>Gemini 3 Pro</strong> モデルを使用して高品質なだるまデザインを生成するには、課金が有効なAPIキーを選択する必要があります。
              </p>
              
              <button
                onClick={handleSelectKey}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <span>APIキーを選択</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>

              <p className="mt-6 text-xs text-stone-400">
                詳細は <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-stone-500">Google Gemini API 請求ドキュメント</a> をご参照ください。
              </p>
            </>
          ) : (
            // 一般的なWeb環境（デプロイ後など）で環境変数が設定されていない場合の表示
            <div className="text-stone-600">
              <p className="mb-4">
                アプリケーションを実行するためのAPIキーが見つかりません。
              </p>
              <div className="bg-stone-100 p-4 rounded-lg text-left text-sm font-mono mb-6 overflow-x-auto">
                <p className="font-bold text-stone-500 mb-2">設定が必要です:</p>
                <p>ホスティングサービスの環境変数設定で、以下のキーを追加してください。</p>
                <p className="mt-2 text-red-600">API_KEY=your_gemini_api_key</p>
              </div>
              <p className="text-xs text-stone-400">
                ※ 有料プランが有効なプロジェクトのAPIキーが必要です。
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};