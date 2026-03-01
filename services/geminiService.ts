import { GoogleGenAI } from "@google/genai";
import { DesignRequest, GeneratedDesign, GeneratedPhotorealistic, PhotorealisticStyle, PhotorealisticOptions } from "../types";

export const generateDarumaDesigns = async (
  request: DesignRequest
): Promise<GeneratedDesign[]> => {
  // Always initialize with the latest key from env
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const patternCount = 6;
  const promises = [];

  for (let i = 0; i < patternCount; i++) {
    promises.push(generateSinglePattern(ai, request, i));
  }

  const results = await Promise.all(promises);
  return results.filter((res): res is GeneratedDesign => res !== null);
};

const generateSinglePattern = async (
  ai: GoogleGenAI, 
  request: DesignRequest, 
  index: number
): Promise<GeneratedDesign | null> => {
  try {
    const parts: any[] = [];

    // Add All Reference Images (Multimodal prompt)
    if (request.referenceImages && request.referenceImages.length > 0) {
      request.referenceImages.forEach(img => {
        parts.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType,
          },
        });
      });

      const refImageInstruction = request.brandColors && request.brandColors.length > 0
        ? `Analyze these reference images with extreme attention to detail.
CHARACTER FACE — MANDATORY FAITHFUL REPRODUCTION: If the image contains a character, you MUST reproduce every facial detail precisely onto the Daruma face: exact eye shape and size, pupil style, eyelash details, eyebrow thickness and curve, nose shape, mouth expression, any markings, scars, accessories (glasses, piercings, etc.), and hair framing the face. Do NOT simplify, omit, or replace any facial feature. The character must be immediately recognizable.
BODY MOTIFS & PATTERNS: Extract all decorative elements, clothing patterns, symbols, and design details. Apply them faithfully to the Daruma body surfaces without omission.
COLOR: DO NOT carry over any original colors. Colors are strictly defined by the Brand Colors below — replace all original colors entirely.`
        : `Analyze these reference images with extreme attention to detail.
CHARACTER FACE — MANDATORY FAITHFUL REPRODUCTION: If the image contains a character, you MUST reproduce every facial detail precisely onto the Daruma face: exact eye shape and size, pupil style, eyelash details, eyebrow thickness and curve, nose shape, mouth expression, any markings, scars, accessories (glasses, piercings, etc.), and hair framing the face. Do NOT simplify, omit, or replace any facial feature. The character must be immediately recognizable.
BODY MOTIFS, PATTERNS & COLORS: Extract all decorative elements, clothing patterns, symbols, colors, and design details. Apply them all faithfully to the Daruma design without omission.`;

      parts.push({ text: refImageInstruction });
    }

    // Determine layout instructions based on size
    // 5cm is typically simpler/cute, 11cm allows for more detail.
    // However, the user request focuses on "Format". 
    // We will ask for a standard multi-view sheet but specify the intended physical scale to influence detail level.
    const sizeContext = request.size === '5cm' 
      ? "Target Product Size: 5cm height (Small). Design should be bold, readable at small scale, slightly deformed or 'chibi' proportions if appropriate, but maintain traditional Daruma silhouette."
      : "Target Product Size: 11cm height (Medium/Large). Design should include intricate details, fine patterns, and high-fidelity textures suitable for a larger surface area.";

    const glossyInstruction = request.glossy
      ? `Material & Surface: The doll must have a traditional Japanese lacquer (urushi) finish with a rich, glossy sheen. Show realistic light reflections and subtle specular highlights on the curved surface. The texture should look like hand-painted, high-quality lacquerware with depth and warmth in the gloss.`
      : `Material & Surface: The doll should have a matte, non-reflective finish. Smooth surface with subtle texture but no gloss or sheen.`;

    const brandColorRoles = ['main body (dominant/primary color)', 'sub color (sash, decorative bands, secondary surfaces)', 'accent color (fine details, outlines, highlights)'];
    const brandColorInstruction = request.brandColors && request.brandColors.length > 0
      ? `BRAND COLOR OVERRIDE — HIGHEST PRIORITY:
The following colors MUST be applied to the daruma doll. These completely override any colors seen in the reference images.
${request.brandColors.map((color, i) => `  - ${brandColorRoles[i]}: ${color}`).join('\n')}
Do NOT use any color from the reference images. Reference images provide shape and motif only.
The face area may use traditional white/black, but all body surfaces must use only the colors listed above.`
      : '';

    const faceInstruction = request.referenceImages && request.referenceImages.length > 0
      ? `Face Design — CRITICAL: The Daruma's face MUST be a faithful, detailed reproduction of the character from the reference images. Reproduce every detail: eyes (shape, size, color, pupils, lashes), eyebrows, nose, mouth, facial markings, accessories. Do NOT default to a standard Daruma face. Do NOT simplify or omit details. Anyone familiar with the character must immediately recognize the face.`
      : `Face Design: Use a stylized Daruma face appropriate to the style direction.`;

    const mainPrompt = `
      Design a Japanese Daruma doll.
      Variation: Pattern ${index + 1}.
      Style Direction: ${request.style}.
      Specific Details: ${request.prompt}.
      ${faceInstruction}
      ${sizeContext}
      ${glossyInstruction}
      ${brandColorInstruction}

      Required Layout: Create a high-quality "Character Sheet" or "Product Design Sheet" containing EXACTLY 4 views of the SAME Daruma doll:
      1. Front View
      2. Back View
      3. Right Side View
      4. Left Side View

      Arrange them in a clean horizontal line or a 2x2 grid on a neutral background.
      Ensure high consistency in the design across all 4 views.
      The design should be production-ready, suitable for 3D modeling or printing.
      High resolution, sharp details.
    `;
    
    parts.push({ text: mainPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: parts,
      },
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
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      },
      {
        text: `Edit this design based on the following instruction. Maintain the 4-view character sheet layout (Front, Back, Right Side, Left Side) and high quality style. Instruction: ${instruction}`
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: parts,
      },
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
        imageConfig: {
          imageSize: '2K',
          aspectRatio: '1:1',
        },
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
        return {
          designId,
          imageUrl,
          style,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Photorealistic generation failed:', error);
    throw error;
  }
};