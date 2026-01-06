/**
 * Decodes a base64 string (Raw PCM 16-bit, 24kHz, Mono) into an AudioBuffer.
 * Gemini API returns raw PCM data without headers.
 */
export const decodePCM16 = async (
  base64Data: string,
  audioContext: AudioContext
): Promise<AudioBuffer> => {
  try {
    // 1. Clean Base64 string
    const cleanBase64 = base64Data.replace(/\s/g, '');
    
    // 2. Decode Base64 string to a binary string
    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    
    // 3. Convert binary string to Uint8Array
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 4. Handle odd byte lengths (PCM 16-bit must be even)
    // If odd, drop the last byte to avoid RangeError
    const evenLen = len % 2 === 0 ? len : len - 1;
    
    // 5. Create Int16Array view
    // using bytes.buffer, offset 0, and length in elements (bytes / 2)
    const int16Data = new Int16Array(bytes.buffer, 0, evenLen / 2);
    
    // 6. Create AudioBuffer
    // Gemini TTS standard output is typically 24000Hz, Mono.
    const sampleRate = 24000;
    const numChannels = 1;
    const frameCount = int16Data.length;
    
    const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
    
    // 7. Fill the AudioBuffer with normalized float data (-1.0 to 1.0)
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      // Normalize 16-bit integer (-32768 to 32767) to float range
      channelData[i] = int16Data[i] / 32768.0;
    }

    return buffer;
  } catch (error) {
    console.error("PCM Decoding Error:", error);
    throw new Error("Failed to decode audio data: " + (error instanceof Error ? error.message : String(error)));
  }
};

/**
 * Concatenates multiple AudioBuffers into a single AudioBuffer.
 */
export const concatenateAudioBuffers = (
  buffers: AudioBuffer[],
  audioContext: AudioContext
): AudioBuffer | null => {
  if (buffers.length === 0) return null;

  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const numberOfChannels = buffers[0].numberOfChannels;
  const sampleRate = buffers[0].sampleRate;

  const result = audioContext.createBuffer(
    numberOfChannels,
    totalLength,
    sampleRate
  );

  for (let channel = 0; channel < numberOfChannels; channel++) {
    let offset = 0;
    const resultChannelData = result.getChannelData(channel);
    for (const buffer of buffers) {
      resultChannelData.set(buffer.getChannelData(channel), offset);
      offset += buffer.length;
    }
  }

  return result;
};

/**
 * Encodes an AudioBuffer to a WAV Blob.
 */
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this function)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArray], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

/**
 * Splits text into strict sections based on word count rules.
 * Rule: Min 50 words, Max 100 words (soft limits, respects sentences).
 */
export const splitTextIntoStrictSections = (text: string, minWords: number = 50, maxWords: number = 100): string[] => {
  // Handle empty or very short text
  if (!text.trim()) return [];
  
  // Split by sentence ending punctuation (., !, ?, Arabic question mark) or newlines
  const sentences = text.match(/[^.!?؟\n]+[.!?؟\n]+|[^.!?؟\n]+$/g) || [text];
  
  const sections: string[] = [];
  let currentSection: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sWordCount = sentence.trim().split(/\s+/).length;
    
    // If adding this sentence exceeds maxWords
    if (currentWordCount + sWordCount > maxWords) {
        // If we have content, push it as a section
        if (currentSection.length > 0) {
            sections.push(currentSection.join(" "));
            currentSection = [];
            currentWordCount = 0;
        }
    }
    
    currentSection.push(sentence);
    currentWordCount += sWordCount;
    
    // Check if we can/should split now (e.g. we are between min and max)
    // However, to reduce number of sections, we prefer to fill up to maxWords.
    // So we only split if forced by maxWords (handled above) or at the end of loop.
  }
  
  if (currentSection.length > 0) {
    sections.push(currentSection.join(" "));
  }
  
  return sections;
};

/**
 * Deprecated legacy splitter (kept for reference if needed, but unused in strict mode)
 */
export const splitTextIntoChunks = (text: string, maxWords: number = 500): string[] => {
    return splitTextIntoStrictSections(text, maxWords, maxWords * 2); 
};