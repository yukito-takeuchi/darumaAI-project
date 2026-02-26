import { GoogleGenAI } from "@google/genai";
import { DesignRequest, GeneratedDesign } from "../types";

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

    const mainPrompt = `
      Design a Japanese Daruma doll.
      Variation: Pattern ${index + 1}.
      Style Direction: ${request.style}.
      Specific Details: ${request.prompt}.
      ${sizeContext}
      
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