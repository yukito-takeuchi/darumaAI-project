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
const loadFormatImage = async (size: string): Promise<{ data: string; mimeType: string } | null> => {
  try {
    const res = await fetch(`/formats/format-${size}.png`);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return {
      data: btoa(binary),
      mimeType: 'image/png',
    };
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────
export const generateDarumaDesigns = async (
  request: DesignRequest
): Promise<GeneratedDesign[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Step 1: 参考画像 or 似顔絵2Dイラストからキャラクター特徴をテキスト化
  let characterDescription = '';
  if (request.portrait) {
    // 似顔絵モード: 2Dイラストをキャラデザと同様に処理
    const portraitAsRef = [{ id: 'portrait', name: 'portrait', data: request.portrait.data, mimeType: request.portrait.mimeType }];
    characterDescription = await extractCharacterDescription(ai, portraitAsRef);
  } else if (request.referenceImages && request.referenceImages.length > 0) {
    characterDescription = await extractCharacterDescription(ai, request.referenceImages);
  }

  // フォーマット画像を読み込み（似顔絵モード時は portrait フォーマットを使用）
  const formatPDF = request.portrait ? await loadFormatImage('portrait') : await loadFormatImage(request.size);

  // Step 2: 指定枚数を並列生成
  const patternCount = request.patternCount ?? 3;
  const promises = [];
  for (let i = 0; i < patternCount; i++) {
    promises.push(generateSinglePattern(ai, request, i, characterDescription, formatPDF));
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
  formatPDF: { data: string; mimeType: string } | null = null
): Promise<GeneratedDesign | null> => {
  try {
    const parts: any[] = [];

    // フォーマット画像（サイズ or 似顔絵）
    if (formatPDF) {
      parts.push({ inlineData: { data: formatPDF.data, mimeType: formatPDF.mimeType } });
      const formatLabel = request.portrait
        ? `FORMAT REFERENCE IMAGE (Portrait/似顔絵): This image shows the official layout and style for the portrait Daruma doll. Follow this composition, proportions, and illustration style exactly.`
        : `FORMAT REFERENCE IMAGE (${request.size}): This image shows the official format specification for the ${request.size} Daruma doll. You MUST faithfully reproduce: the exact 3D body shape and proportions, all surface contours and indentations (凹凸), the face area recess depth, the bottom flat base, and any structural details visible in this image.`;
      parts.push({ text: formatLabel });
    }

    // 似顔絵2Dイラスト / 通常の参考画像（視覚的グラウンディング用）
    if (request.portrait) {
      parts.push({ inlineData: { data: request.portrait.data, mimeType: request.portrait.mimeType } });
      parts.push({ text: `The above 2D illustration is the character design reference for the portrait Daruma. Reproduce the face, hair, and clothing faithfully in the same flat 2D illustration style.` });
    } else if (request.referenceImages && request.referenceImages.length > 0) {
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

    // ── 通常モード用変数 ──────────────────────────────────
    const faceInstruction = request.referenceImages && request.referenceImages.length > 0
      ? `Face Design — CRITICAL:
${characterDescription
  ? `Reproduce the character's face exactly as described in the CHARACTER DESCRIPTION above. Every facial feature (eyes, eyebrows, skin tone, mouth, markings, accessories) must match precisely. The character must be immediately recognizable. Brand colors do NOT apply to the face.`
  : `Base the Daruma face on the character from the reference images. Reproduce eyes, eyebrows, expression, and distinctive facial features faithfully. Do NOT default to a standard Daruma face.`}`
      : `Face Design: Use a stylized Daruma face appropriate to the style direction.`;

    const silhouetteInstruction = `Silhouette — STRICT CONSTRAINT:
The Daruma body MUST maintain its traditional smooth oval/egg shape. Physical protrusions are FORBIDDEN.
Any character appendages (horns, tail, wings, animal ears) MUST be rendered as painted/illustrated decorations ON the surface — not physically extending beyond the oval outline.
Final silhouette must be a clean, smooth Daruma oval from all 4 angles.`;

    // ── プロンプト分岐 ────────────────────────────────────
    const mainPrompt = request.portrait
      ? `Design a Portrait (似顔絵) Daruma doll. Variation: Pattern ${index + 1}.

FOLLOW THE FORMAT REFERENCE IMAGE AND CHARACTER REFERENCE ILLUSTRATION provided above.
Reproduce the same flat 2D illustration style, composition, and proportions shown in those reference images.

CHARACTER DESCRIPTION (extracted from the 2D illustration reference):
${characterSection}

Reproduce the character's face, hair, and clothing faithfully in the same flat 2D illustration style as the reference.

Layout: 4 views (Front / Back / Right Side / Left Side) in a SINGLE HORIZONTAL ROW on a clean white background. Equal size and spacing. No text, no labels, no annotations.`
      : `Design a Japanese Daruma doll. Variation: Pattern ${index + 1}.
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
      ? `\nKeychain Attachment: The daruma doll is displayed as a finished keychain product. Structure from top to bottom: (1) a large round spring-snap O-ring (trigger clasp) at the very top — silver metallic finish with realistic reflections, (2) a short curb-link chain of 4–5 oval interlocking links hanging down from the O-ring, (3) a small connecting O-ring linking the chain to the daruma's head, (4) the daruma doll itself at the bottom — its head top connects to the small ring. The entire keychain hangs vertically. No key charm or any other element at the bottom. All metal parts are silver/chrome. The doll is miniature/compact sized.\nOrientation: The daruma doll MUST face directly forward toward the camera (front view). The face design must be fully visible and centered. Do NOT show a side view, angled view, or back view of the doll.\n`
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
