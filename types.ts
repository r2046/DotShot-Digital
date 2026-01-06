export enum AppMode {
  TRANSLATOR = 'TRANSLATOR',
  VOICEOVER = 'VOICEOVER',
  IMAGE_EDITOR = 'IMAGE_EDITOR'
}

export enum VoiceOption {
  ZEPHYR = 'Zephyr',
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  FENRIR = 'Fenrir'
}

export interface AudioChunk {
  id: string;
  text: string;
  audioBuffer: AudioBuffer | null;
  status: 'pending' | 'loading' | 'completed' | 'error';
  error?: string;
}

export interface TranslationState {
  sourceText: string;
  translatedText: string;
  isLoading: boolean;
  error: string | null;
}