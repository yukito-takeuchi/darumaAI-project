import { GoogleGenAI } from "@google/genai";
import { DesignRequest, GeneratedDesign, GeneratedPhotorealistic, PhotorealisticStyle, PhotorealisticOptions } from "../types";

export const generateDarumaDesigns = async (
  request: DesignRequest
): Promise<GeneratedDesign[]> => {
  // Always initialize with the latest key from env
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const patternCount = 3;
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
      
      parts.push({
        text: "Please analyze these reference images. They may contain logos, brand colors, character designs, or style references. Incorporate these visual elements harmoniously into the Daruma design."
      });
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

    const mainPrompt = `
      Design a Japanese Daruma doll.
      Variation: Pattern ${index + 1}.
      Style Direction: ${request.style}.
      Specific Details: ${request.prompt}.
      ${sizeContext}
      ${glossyInstruction}

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