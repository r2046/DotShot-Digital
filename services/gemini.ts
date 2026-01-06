import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceOption } from '../types';

// Ensure API Key exists
if (!process.env.API_KEY) {
  console.error("Missing API_KEY in environment variables.");
}

const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const translateToArabic = async (text: string): Promise<string> => {
  const ai = getAIClient();
  const model = "gemini-3-pro-preview"; // High quality for strict translation

  const prompt = `
  STRICT INSTRUCTION:
  You are a professional Arabic translator.
  Translate the following transcript into Modern Standard Arabic (Fusha) strictly.
  
  RULES:
  1. Translate 100% of the provided text. No line, word, or sentence may be skipped.
  2. The translation must be A to Z same-to-same with the original meaning.
  3. Do NOT paraphrase, summarize, or add new information.
  4. Do NOT remove repetitions if they exist.
  5. Correct grammar/spelling in source ONLY if it doesn't change meaning.
  6. Maintain the structure, order, and tone.
  7. Output MUST be Arabic ONLY. No notes, no explanations.

  INPUT TEXT:
  ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        thinkingConfig: { thinkingBudget: 1024 }, // Encourage careful thought for translation accuracy
        temperature: 0.3, // Lower temperature for more deterministic output
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Translation Error:", error);
    throw new Error("Failed to translate text.");
  }
};

export const generateArabicSpeech = async (
  text: string, 
  voiceName: VoiceOption
): Promise<string> => {
  const ai = getAIClient();
  const model = "gemini-2.5-flash-preview-tts";

  try {
    const response = await ai.models.generateContent({
      model,
      // Wrap in array to match SDK expected type for 'contents' strictly
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
            // Removed speakingRate as it causes 400 Invalid Argument in the current API version
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    
    // Check for safety finish reason which commonly causes non-audio response errors in TTS
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
         console.warn(`Gemini TTS finished with reason: ${candidate.finishReason}`);
         if (candidate.finishReason === 'SAFETY') {
             throw new Error("Speech generation blocked by safety filters. Please verify the content.");
         }
    }

    // Iterate through parts to find the audio part
    const parts = candidate?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }

    throw new Error("No audio data received. The model may have returned a text response instead of audio.");
  } catch (error) {
    console.error("Speech Generation Error:", error);
    // Extract meaningful message from API error if possible
    let errorMessage = "Failed to generate speech.";
    if (error instanceof Error) {
        errorMessage = error.message;
        // Check for the specific 400 error regarding non-audio response or invalid arguments
        if (errorMessage.includes("non-audio response")) {
            errorMessage = "The model refused to generate audio for this text (Safety or Policy).";
        } else if (errorMessage.includes("invalid argument") || errorMessage.includes("400")) {
             errorMessage = "API Error: Invalid Argument (400). Please check text content or length.";
        }
    }
    throw new Error(errorMessage);
  }
};

export const editImage = async (
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  const ai = getAIClient();
  const model = "gemini-2.5-flash-image";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    // Iterate through parts to find the image part
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    
    throw new Error("No image data returned from Gemini.");
  } catch (error) {
    console.error("Image Edit Error:", error);
    throw new Error("Failed to edit image.");
  }
};