import { GoogleGenAI } from "@google/genai";
import { DesignRequest, GeneratedDesign, GeneratedPhotorealistic, PhotorealisticStyle, PhotorealisticOptions, ReferenceImage } from "../types";

// ─────────────────────────────────────────────
// Step 1: キャラクター特徴をテキストに変換
// ─────────────────────────────────────────────
const extractCharacterDescription = async (
  ai: GoogleGenAI,
  referenceImages: ReferenceImage[]
): Promise<string> => {
  const parts: any[] = [];

  referenceImages.forEach(img => {
    parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
  });

  parts.push({
    text: `You are a character design analyst. Analyze the character(s) in these reference images with extreme precision. This description will be used to faithfully recreate the character as a Daruma doll design.

Output the following sections in detail:

## FACE
- Eye shape, exact color, pupil style, iris details, eyelash style
- Eyebrow thickness, curve, color
- Skin tone
- Nose shape
- Mouth/lip style and expression
- Facial markings, tattoos, scars, or unique features
- Face-mounted accessories (glasses, piercings, face horns, etc.)

## HAIR
- Color(s) including any gradients
- Style, length, texture
- Hair ornaments or accessories

## BODY DECORATIONS
- Clothing patterns, symbols, emblems, logos
- Distinctive design elements on body/clothing
- Recurring motifs or icons

## APPENDAGES (will be rendered as painted surface decorations on the doll — NOT physical protrusions)
- Horns: exact shape, size, color, placement
- Tail: shape, length, color
- Wings: shape, color
- Animal ears: shape, color, placement
- Any other non-human features

## COLOR PALETTE
List every distinct color with approximate hex codes.

Be extremely detailed. Do not omit or simplify anything.`
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts },
    });
    const text = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    return text || '';
  } catch (error) {
    console.error('Step 1 — character description extraction failed:', error);
    return '';
  }
};

// ─────────────────────────────────────────────
// フォーマットPDF読み込み
// ─────────────────────────────────────────────
const loadFormatPDF = async (size: string): Promise<{ data: string; mimeType: string } | null> => {
  try {
    const res = await fetch(`/formats/format-${size}.pdf`);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return {
      data: btoa(binary),
      mimeType: 'application/pdf',
    };
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────
// Step 1 (似顔絵): 人物写真から顔の特徴をテキスト化
// ─────────────────────────────────────────────
const extractPortraitFeatures = async (
  ai: GoogleGenAI,
  portrait: { data: string; mimeType: string }
): Promise<string> => {
  const parts = [
    { inlineData: { data: portrait.data, mimeType: portrait.mimeType } },
    {
      text: `Analyze this person's photo for creating a caricature bust portrait illustrated inside a Daruma egg shape. Describe concisely (max 150 words):

FACE: face shape, skin tone, eye shape/color, eyebrow style, nose shape, mouth/lips, distinctive features (beard, glasses, moles, etc.), hair color and style.
UPPER BODY & CLOTHING: clothing type (suit, shirt, tie, etc.), jacket color, shirt color, tie color/pattern, any visible accessories (pin, pocket square, etc.).

Focus on the most recognizable features for caricature reproduction. Output only the description.`
    }
  ];
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts },
    });
    const text = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    return text || '';
  } catch (error) {
    console.error('Portrait feature extraction failed:', error);
    return '';
  }
};

// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────
export const generateDarumaDesigns = async (
  request: DesignRequest
): Promise<GeneratedDesign[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Step 1: 参考画像があればキャラクター特徴を先にテキスト化
  let characterDescription = '';
  if (request.referenceImages && request.referenceImages.length > 0) {
    characterDescription = await extractCharacterDescription(ai, request.referenceImages);
  }

  // Step 1 (似顔絵): 人物写真の顔の特徴をテキスト化
  let portraitDescription = '';
  if (request.portrait) {
    portraitDescription = await extractPortraitFeatures(ai, request.portrait);
  }

  // フォーマットPDFを1回だけ読み込み（全パターンで共有）
  // 似顔絵モード時は似顔絵用PDFも追加読み込み
  const formatPDF = await loadFormatPDF(request.size);
  const portraitPDF = request.portrait ? await loadFormatPDF('portrait') : null;

  // Step 2: 指定枚数を並列生成
  const patternCount = request.patternCount ?? 3;
  const promises = [];
  for (let i = 0; i < patternCount; i++) {
    promises.push(generateSinglePattern(ai, request, i, characterDescription, formatPDF, portraitDescription, portraitPDF));
  }

  const results = await Promise.all(promises);
  return results.filter((res): res is GeneratedDesign => res !== null);
};

// ─────────────────────────────────────────────
// フォーマットラベルを画像の左上に追加
// ─────────────────────────────────────────────
const addFormatLabel = (imageDataUrl: string, size: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageDataUrl); return; }

      ctx.drawImage(img, 0, 0);

      const label = `${size} 達磨`;
      const fontSize = Math.max(28, Math.round(img.width * 0.022));
      const padding = Math.round(fontSize * 0.55);
      const x = Math.round(img.width * 0.025);
      const y = Math.round(img.height * 0.03);

      ctx.font = `bold ${fontSize}px 'Helvetica Neue', Arial, sans-serif`;
      const textW = ctx.measureText(label).width;
      const boxW = textW + padding * 2;
      const boxH = fontSize + padding * 2;
      const radius = 6;

      // 白背景ボックス
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#222222';
      ctx.lineWidth = Math.max(2, Math.round(img.width * 0.0015));
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + boxW - radius, y);
      ctx.arcTo(x + boxW, y, x + boxW, y + radius, radius);
      ctx.lineTo(x + boxW, y + boxH - radius);
      ctx.arcTo(x + boxW, y + boxH, x + boxW - radius, y + boxH, radius);
      ctx.lineTo(x + radius, y + boxH);
      ctx.arcTo(x, y + boxH, x, y + boxH - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // テキスト
      ctx.fillStyle = '#111111';
      ctx.fillText(label, x + padding, y + padding + fontSize * 0.82);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
};

// ─────────────────────────────────────────────
// Step 2: だるまデザイン生成
// ─────────────────────────────────────────────
const generateSinglePattern = async (
  ai: GoogleGenAI,
  request: DesignRequest,
  index: number,
  characterDescription: string = '',
  formatPDF: { data: string; mimeType: string } | null = null,
  portraitDescription: string = '',
  portraitPDF: { data: string; mimeType: string } | null = null
): Promise<GeneratedDesign | null> => {
  try {
    const parts: any[] = [];

    // 似顔絵フォーマットPDF（似顔絵モード時）
    if (portraitPDF) {
      parts.push({ inlineData: { data: portraitPDF.data, mimeType: portraitPDF.mimeType } });
      parts.push({ text: `The above PDF is the official portrait (似顔絵) format specification for this Daruma doll. Follow its layout and artistic style precisely.` });
    }

    // サイズフォーマットPDFを先頭に追加
    if (formatPDF) {
      parts.push({ inlineData: { data: formatPDF.data, mimeType: formatPDF.mimeType } });
      parts.push({ text: `The above PDF is the official format specification for the ${request.size} Daruma doll. Follow its dimensions, layout guidelines, and structural specifications precisely.` });
    }

    // 似顔絵用の人物写真（視覚的参照）
    if (request.portrait) {
      parts.push({ inlineData: { data: request.portrait.data, mimeType: request.portrait.mimeType } });
      parts.push({ text: `The above photo shows the person whose likeness should be captured in the Daruma doll's face as a portrait caricature.` });
    }

    // 参考画像を追加（視覚的グラウンディング用）
    if (request.referenceImages && request.referenceImages.length > 0) {
      request.referenceImages.forEach(img => {
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
      });
    }

    const sizeContext = request.size === '5cm'
      ? "Target Product Size: 5cm (Small). Bold, readable at small scale, maintain traditional Daruma silhouette."
      : request.size === '11cm'
      ? "Target Product Size: 11cm (Medium). Intricate details and high-fidelity textures."
      : "Target Product Size: 17cm (Large). Maximum detail, elaborate patterns, fine textures suitable for the largest surface area.";

    const glossyInstruction = request.glossy
      ? `Material & Surface: Traditional Japanese lacquer (urushi) finish with rich glossy sheen. Realistic light reflections and specular highlights. Hand-painted lacquerware look.`
      : `Material & Surface: Matte, non-reflective finish. Smooth surface with no gloss.`;

    const brandColorRoles = ['main body (dominant/primary color)', 'sub color (sash, decorative bands, secondary surfaces)', 'accent color (fine details, outlines, highlights)'];
    const brandColorInstruction = request.brandColors && request.brandColors.length > 0
      ? `══════════════════════════════════════
FINAL COLOR OVERRIDE — HIGHEST PRIORITY
This instruction overrides ALL color information above, including the CHARACTER DESCRIPTION color palette.
══════════════════════════════════════
BODY SURFACES (main body, sash, back, sides, decorative bands):
${request.brandColors.map((color, i) => `  - ${brandColorRoles[i]}: ${color}`).join('\n')}
You MUST use ONLY these colors on all body surfaces. Any original character body colors are REPLACED entirely.

FACE AREA EXCEPTION (eyes, skin tone, eyebrows, mouth, markings, hair):
Preserve the character's original face colors for recognition. Brand colors do NOT apply here.
══════════════════════════════════════`
      : '';

    // Step 1 のテキスト記述をプロンプトに組み込む
    const characterSection = characterDescription
      ? request.brandColors && request.brandColors.length > 0
        ? `CHARACTER DESCRIPTION (extracted from reference images — use for FACE, MOTIFS, and PATTERNS only):
${characterDescription}

IMPORTANT: Use this description for face details, motifs, patterns, and design elements ONLY.
The "COLOR PALETTE" section of this description is COMPLETELY OVERRIDDEN by the Brand Colors defined at the end of this prompt. Do NOT use any color from this description for body surfaces.`
        : `CHARACTER DESCRIPTION (extracted from reference images — use as primary reference):
${characterDescription}

The attached reference images are provided for visual confirmation. Reproduce all features including colors faithfully.`
      : '';

    const faceInstruction = request.portrait && portraitDescription
      ? `Portrait Caricature Design — CRITICAL:
CONCEPT: A flat 2D illustrated caricature bust portrait of the real person fills the front of the Daruma egg shape. Think of it like a "person inside an egg" — the daruma's oval silhouette becomes the outer boundary of the figure, and the person's caricature (face + upper body) naturally fills the interior.

Person's features to reproduce (from the photo above):
${portraitDescription}

Illustration requirements:
- Style: flat 2D cartoon/illustration (NOT photorealistic). Clean outlines, simplified shapes, solid color fills.
- Caricature: slightly rounded and exaggerated proportions. Face takes up the upper ~60%, clothing fills the lower ~40%.
- FACE: Reproduce the person's actual face — eyes, eyebrows, nose, mouth, skin tone, hairstyle — faithfully as a caricature. Make them recognizable.
- CLOTHING: Include neck, shoulders, and upper body clothing (jacket, shirt, tie, etc.) in the person's actual colors from the photo. The clothing fills the lower portion of the egg naturally.
- The caricature bust is contained entirely within the smooth Daruma oval. Nothing extends beyond the silhouette.

Back and side views: Show the Daruma egg shape from those angles. Back view may show the back of the figure's head/hair. Side views show the egg profile with a natural side silhouette of the caricature.

Do NOT draw a generic blank Daruma face. Do NOT show only the face without clothing. Do NOT make it photorealistic.`
      : request.referenceImages && request.referenceImages.length > 0
      ? `Face Design — CRITICAL:
${characterDescription
  ? `Reproduce the character's face exactly as described in the CHARACTER DESCRIPTION above. Every facial feature (eyes, eyebrows, skin tone, mouth, markings, accessories) must match precisely. The character must be immediately recognizable. Brand colors do NOT apply to the face.`
  : `Base the Daruma face on the character from the reference images. Reproduce eyes, eyebrows, expression, and distinctive facial features faithfully. Do NOT default to a standard Daruma face.`}`
      : `Face Design: Use a stylized Daruma face appropriate to the style direction.`;

    const silhouetteInstruction = `Silhouette — STRICT CONSTRAINT:
The Daruma body MUST maintain its traditional smooth oval/egg shape. Physical protrusions are FORBIDDEN.
Any character appendages (horns, tail, wings, animal ears) MUST be rendered as painted/illustrated decorations ON the surface — not physically extending beyond the oval outline.
Final silhouette must be a clean, smooth Daruma oval from all 4 angles.`;

    const mainPrompt = `Design a${request.portrait ? ' Portrait (似顔絵)' : ''} Japanese Daruma doll.
Variation: Pattern ${index + 1}.
Style Direction: ${request.style}.
Specific Details: ${request.prompt}.

${characterSection}

${silhouetteInstruction}

${faceInstruction}

${sizeContext}
${glossyInstruction}

Required Layout — STRICT:
Arrange EXACTLY 4 views of the SAME Daruma doll in a SINGLE HORIZONTAL ROW, evenly spaced, on a clean white background.
Left to right order:  [1. Front]  [2. Back]  [3. Right Side]  [4. Left Side]
All 4 dolls must be the same size and vertical alignment. Equal gaps between each view.
No 2×2 grid. No stacking. Horizontal line only.
Do NOT include any text, labels, titles, captions, or annotations anywhere in the image.
Production-ready, high resolution, sharp details.

${brandColorInstruction}`;

    parts.push({ text: mainPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          imageSize: '2K',
          aspectRatio: '16:9',
        },
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) return null;

    const contentParts = candidates[0].content.parts;
    let imageUrl = '';
    for (const part of contentParts) {
      if (part.inlineData) {
        const base64Str = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mimeType};base64,${base64Str}`;
        break;
      }
    }

    if (!imageUrl) return null;

    // フォーマットラベルを左上に追加
    const labeledImageUrl = await addFormatLabel(imageUrl, request.size);

    return {
      id: `design-${Date.now()}-${index}`,
      imageUrl: labeledImageUrl,
      promptUsed: mainPrompt,
      timestamp: Date.now(),
    };

  } catch (error) {
    console.error(`Error generating pattern ${index + 1}:`, error);
    return null;
  }
};

export const refineDarumaDesign = async (
  currentImageUrl: string,
  instruction: string,
  annotationImage?: { data: string; mimeType: string }
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const base64Data = currentImageUrl.split(',')[1];
    const mimeMatch = currentImageUrl.match(/^data:(.*);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    const parts: any[] = [
      { inlineData: { data: base64Data, mimeType } },
    ];

    if (annotationImage) {
      parts.push({ inlineData: { data: annotationImage.data, mimeType: annotationImage.mimeType } });
      parts.push({
        text: `The first image is the current Daruma design sheet. The second image is an annotation provided by the user to indicate the specific area or element to modify.
Refer to the second image to identify exactly what needs to be changed, then apply the following instruction to the design.
Maintain the 4-view character sheet layout (Front, Back, Right Side, Left Side) and overall quality.
Instruction: ${instruction}`
      });
    } else {
      parts.push({
        text: `Edit this design based on the following instruction. Maintain the 4-view character sheet layout (Front, Back, Right Side, Left Side) and high quality style. Instruction: ${instruction}`
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: { imageSize: '2K', aspectRatio: '16:9' },
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) return null;

    const contentParts = candidates[0].content.parts;
    for (const part of contentParts) {
      if (part.inlineData) {
        const base64Str = part.inlineData.data;
        const newMimeType = part.inlineData.mimeType || 'image/png';
        return `data:${newMimeType};base64,${base64Str}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Refine failed:", error);
    throw error;
  }
};

/**
 * デザイン案からフォトリアルな商品写真を生成する。
 * 用途: クライアントプレゼン・サンプル製造前のプレビュー。
 */
export const generatePhotorealisticPhoto = async (
  designImageUrl: string,
  designId: string,
  style: PhotorealisticStyle,
  options?: PhotorealisticOptions
): Promise<GeneratedPhotorealistic | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const base64Data = designImageUrl.split(',')[1];
    const mimeMatch = designImageUrl.match(/^data:(.*);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    const styleInstruction =
      style === 'sample'
        ? 'Create a photorealistic photo as if this is a sample/prototype daruma doll. Soft studio lighting, neutral or light gray background, slight imperfections acceptable. Suitable for internal preview or early client presentation.'
        : 'Create a high-end product photography image of this daruma doll as if it were a finished product. Professional studio lighting, clean white or subtle gradient background, sharp focus, commercial quality. Suitable for catalogs and client presentations.';

    const keychainInstruction = options?.withKeychain
      ? `\nKeychain Attachment: The daruma doll has a small metal ring attached to the top of its head, connected to a ball chain (bead chain) keychain. The metal ring and ball chain should look realistic with a silver/chrome metallic finish. The chain hangs naturally with gravity. The doll itself should be miniature/compact sized, suitable as a keychain accessory.\n`
      : '';

    const prompt = `
This image is a design sheet (multiple views) of a Japanese Daruma doll.
Generate a SINGLE photorealistic photograph that shows this Daruma design as if it were a real, physical doll.

${styleInstruction}
${keychainInstruction}
Material & Surface: The doll must have a traditional Japanese lacquer (urushi) finish with a rich, glossy sheen. Show realistic light reflections and subtle specular highlights on the curved surface. The texture should look like hand-painted, high-quality lacquerware with depth and warmth in the gloss.

Output: One photorealistic image only. The doll should look three-dimensional and real, with natural shadows and lighting. Preserve the design's colors, patterns, and character from the reference. No text or watermarks.
    `.trim();

    const parts = [
      { inlineData: { data: base64Data, mimeType } },
      { text: prompt },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: { imageSize: '2K', aspectRatio: '1:1' },
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) return null;

    const contentParts = candidates[0].content.parts;
    for (const part of contentParts) {
      if (part.inlineData) {
        const base64Str = part.inlineData.data;
        const outMime = part.inlineData.mimeType || 'image/png';
        const imageUrl = `data:${outMime};base64,${base64Str}`;
        return { designId, imageUrl, style, timestamp: Date.now() };
      }
    }
    return null;
  } catch (error) {
    console.error('Photorealistic generation failed:', error);
    throw error;
  }
};
