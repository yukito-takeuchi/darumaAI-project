<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# だるまデザイン生成プロ (DARUMA GEN PRO)

企業品質のだるまデザインジェネレーター。**Gemini 3 Pro Image** を使用し、ブランドロゴやキャラクターを統合した4面図のデザインシートを生成します。

- **AI Studio**: [アプリを開く](https://ai.studio/apps/drive/1bV3ZSC0K-n9aN3P3P3EJpPGMWz0PoFYQ)

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| **技術スタック** | React 19 + Vite 6 + TypeScript |
| **AI モデル** | Gemini 2.0 Flash（テキスト分析）、Gemini 3 Pro Image（画像生成） |
| **スタイリング** | Tailwind CSS（CDN） |
| **主要ライブラリ** | @google/genai, jspdf |

### アーキテクチャ

```
index.tsx → App.tsx
    ├── ApiKeyChecker（APIキー検証・選択）
    ├── Hero（ヘッダー）
    ├── DesignForm（入力フォーム）
    └── ResultsGrid（生成結果表示・編集・ダウンロード）
```

---

## 実装済み機能

### 1. API キー管理 (`components/ApiKeyChecker.tsx`)
- **AI Studio 環境**: `window.aistudio.hasSelectedApiKey()` / `openSelectKey()` でキー選択
- **一般環境**: 環境変数 `GEMINI_API_KEY` または `API_KEY` を使用
- キー未設定時はモーダル表示、設定後はメイン画面へ遷移

### 2. デザイン入力フォーム (`components/DesignForm.tsx`)
| 項目 | 説明 |
|------|------|
| **サイズ** | 5cm / 11cm / 17cm（`public/formats/format-*.pdf` を参照） |
| **似顔絵モード** | 人物写真 → フラット2Dイラスト風だるま（4面図） |
| **光沢感** | ON=漆風グロス / OFF=マット |
| **ブランドカラー** | メイン・サブ・アクセントの3色指定（顔は除外） |
| **参考素材** | ロゴ・キャラ画像のドラッグ&ドロップ（複数可） |
| **トーン＆マナー** | スタイル方向（例: サイバーパンク風） |
| **具体的な指示** | モチーフ・詳細のテキスト |
| **生成枚数** | 3枚 or 6枚 |

### 3. デザイン生成 (`services/geminiService.ts`)
- **`generateDarumaDesigns(request)`**: メイン生成
  - 参考画像 → `extractCharacterDescription()` でキャラ特徴をテキスト化
  - 人物写真 → `extractPortraitFeatures()` で似顔絵用特徴を抽出
  - PDF フォーマットを読み込み、4面図レイアウトを指定
  - 指定枚数を並列生成
- **`refineDarumaDesign(imageUrl, instruction, annotationImage?)`**: 既存デザインの修正
- **`generatePhotorealisticPhoto(imageUrl, designId, style, options?)`**: フォトリアル写真生成
  - `style`: `'sample'`（サンプル風） / `'product'`（商品写真風）
  - `options.withKeychain`: キーホルダーパーツ付き

### 4. 結果表示・操作 (`components/ResultsGrid.tsx`)
- 生成デザインのグリッド表示
- **ダウンロード**: PDF / AI形式（jsPDF）、PNG
- **修正**: テキスト指示 + 任意で注釈画像（修正箇所の指摘）
- **フォトリアル写真**: サンプル風・商品写真風の生成、キーホルダーオプション

### 5. 型定義 (`types.ts`)
- `DesignRequest`, `GeneratedDesign`, `ReferenceImage`
- `GenerationStatus` (IDLE / GENERATING / COMPLETED / ERROR)
- `PhotorealisticStyle`, `PhotorealisticOptions`, `GeneratedPhotorealistic`

---

## ディレクトリ構成

```
darumaAI-project/
├── App.tsx                 # メインアプリ・状態管理
├── index.tsx               # エントリーポイント
├── index.html              # HTML + Tailwind CDN + importmap
├── types.ts                # 型定義
├── components/
│   ├── ApiKeyChecker.tsx   # APIキー検証
│   ├── Hero.tsx            # ヘッダー
│   ├── DesignForm.tsx      # 入力フォーム
│   └── ResultsGrid.tsx     # 結果グリッド
├── services/
│   └── geminiService.ts    # Gemini API 呼び出し
├── public/
│   └── formats/            # サイズ別PDFフォーマット
│       ├── format-5cm.pdf
│       ├── format-11cm.pdf
│       ├── format-17cm.pdf
│       └── format-portrait.pdf
├── vite.config.ts          # API_KEY を GEMINI_API_KEY から注入
└── package.json
```

---

## セットアップ・実行

**前提**: Node.js

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **環境変数の設定**
   - プロジェクト直下に `.env` または `.env.local` を作成
   - `GEMINI_API_KEY=your_gemini_api_key` を記述
   - `vite.config.ts` により `process.env.API_KEY` に注入される

3. **開発サーバー起動**
   ```bash
   npm run dev
   ```
   - デフォルト: http://localhost:3000

---

## 開発・デプロイフロー

このプロジェクトは次の流れを想定しています。

```
AI Studio でプロトタイプ作成
        ↓
ローカルで修正・拡張（このリポジトリ）
        ↓
AI Studio に反映
        ↓
本番環境にデプロイ
```

### 各ステップのポイント

| ステップ | 説明 |
|----------|------|
| **AI Studio でプロトタイプ** | アプリの骨組み・UI・API 呼び出しを AI Studio 上で作成 |
| **ローカルで修正** | Vite + npm で詳細実装・リファクタ・新機能を追加。編集しやすい環境で開発 |
| **AI Studio に反映** | 変更したソースを AI Studio のプロジェクトに戻す（Git 連携やファイルアップロードなど） |
| **本番デプロイ** | AI Studio のデプロイ機能、または別ホスト（Vercel 等）へデプロイ |

### 注意事項

- **ビルドの違い**: AI Studio はブラウザの importmap（ESM CDN）で `@google/genai` 等を読み込む。ローカルは `npm install` で `node_modules` に置き Vite がバンドル。同じ `import` 文で動くが、AI Studio に戻す際は CDN で提供されているバージョンに合わせると安全。
- **環境変数**: ローカルは `.env` の `GEMINI_API_KEY`、AI Studio は `window.aistudio` でキー選択。`ApiKeyChecker` が両方に対応している。
- **本番が別ホストの場合**: ローカル ⇔ そのリポジトリで CI/CD を回し、AI Studio はプロトタイプ・プレビュー用と割り切る運用も可能。

---

## 開発時の参照（バイブコーディング向け）

| 変更したい内容 | 主に触るファイル |
|----------------|------------------|
| プロンプト・生成ロジック | `services/geminiService.ts` |
| 入力フォームの項目・UI | `components/DesignForm.tsx` |
| 結果表示・ダウンロード・修正UI | `components/ResultsGrid.tsx` |
| API キー周りの挙動 | `components/ApiKeyChecker.tsx` |
| 型・リクエスト/レスポンス形状 | `types.ts` |
| サイズ別フォーマット | `public/formats/*.pdf` |

---

## ビルド・プレビュー

```bash
npm run build    # 本番ビルド
npm run preview  # ビルド成果物のプレビュー
```
