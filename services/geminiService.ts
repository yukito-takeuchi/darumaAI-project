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

  // Step 2: テキスト記述を使って6枚並列生成
  const patternCount = 6;
  const promises = [];
  for (let i = 0; i < patternCount; i++) {
    promises.push(generateSinglePattern(ai, request, i, characterDescription));
  }

  const results = await Promise.all(promises);
  return results.filter((res): res is GeneratedDesign => res !== null);
};

// ─────────────────────────────────────────────
// Step 2: だるまデザイン生成
// ─────────────────────────────────────────────
const generateSinglePattern = async (
  ai: GoogleGenAI,
  request: DesignRequest,
  index: number,
  characterDescription: string = ''
): Promise<GeneratedDesign | null> => {
  try {
    const parts: any[] = [];

    // 参考画像を追加（視覚的グラウンディング用）
    if (request.referenceImages && request.referenceImages.length > 0) {
      request.referenceImages.forEach(img => {
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
      });
    }

    const sizeContext = request.size === '5cm'
      ? "Target Product Size: 5cm (Small). Bold, readable at small scale, maintain traditional Daruma silhouette."
      : "Target Product Size: 11cm (Medium/Large). Intricate details and high-fidelity textures.";

    const glossyInstruction = request.glossy
      ? `Material & Surface: Traditional Japanese lacquer (urushi) finish with rich glossy sheen. Realistic light reflections and specular highlights. Hand-painted lacquerware look.`
      : `Material & Surface: Matte, non-reflective finish. Smooth surface with no gloss.`;

    const brandColorRoles = ['main body (dominant/primary color)', 'sub color (sash, decorative bands, secondary surfaces)', 'accent color (fine details, outlines, highlights)'];
    const brandColorInstruction = request.brandColors && request.brandColors.length > 0
      ? `BRAND COLORS — BODY SURFACES ONLY:
${request.brandColors.map((color, i) => `  - ${brandColorRoles[i]}: ${color}`).join('\n')}
IMPORTANT: Apply brand colors to body surfaces only (main body, sash, back, sides, decorative bands).
FACE EXCEPTION: The face area (eyes, skin, eyebrows, mouth, markings, hair) must use the character's original colors as described in the CHARACTER DESCRIPTION. Do NOT apply brand colors to the face.`
      : '';

    // Step 1 のテキスト記述をプロンプトに組み込む
    const characterSection = characterDescription
      ? `CHARACTER DESCRIPTION (extracted from reference images — use as primary reference):
${characterDescription}

The attached reference images are provided for visual confirmation. The description above takes priority for faithful reproduction.`
      : '';

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

    const mainPrompt = `Design a Japanese Daruma doll.
Variation: Pattern ${index + 1}.
Style Direction: ${request.style}.
Specific Details: ${request.prompt}.

${characterSection}

${silhouetteInstruction}

${faceInstruction}

${sizeContext}
${glossyInstruction}
${brandColorInstruction}

Required Layout: A high-quality "Character Sheet" with EXACTLY 4 views of the SAME Daruma doll:
1. Front View
2. Back View
3. Right Side View
4. Left Side View

Arrange in a clean horizontal line or 2x2 grid on a neutral background.
Ensure high consistency across all 4 views.
Production-ready design suitable for 3D modeling or printing.
High resolution, sharp details.`;

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

    return {
      id: `design-${Date.now()}-${index}`,
      imageUrl,
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
  instruction: string
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const base64Data = currentImageUrl.split(',')[1];
    const mimeMatch = currentImageUrl.match(/^data:(.*);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    const parts = [
      { inlineData: { data: base64Data, mimeType } },
      { text: `Edit this design based on the following instruction. Maintain the 4-view character sheet layout (Front, Back, Right Side, Left Side) and high quality style. Instruction: ${instruction}` }
    ];

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
