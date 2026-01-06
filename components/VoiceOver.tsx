import React, { useState, useRef, useEffect } from 'react';
import { generateArabicSpeech } from '../services/gemini';
import { splitTextIntoStrictSections, decodePCM16, concatenateAudioBuffers, audioBufferToWav } from '../utils/audioUtils';
import { AudioChunk, VoiceOption } from '../types';
import { Mic, Play, Pause, Download, Layers, Loader2, Music, Trash2, Settings, RefreshCw, FileAudio, Zap } from 'lucide-react';

interface VoiceOverProps {
  initialText?: string;
}

const VoiceOver: React.FC<VoiceOverProps> = ({ initialText = '' }) => {
  const [text, setText] = useState(initialText);
  const [sections, setSections] = useState<AudioChunk[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VoiceOption.ZEPHYR);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Playback state
  const [playingChunkId, setPlayingChunkId] = useState<string | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Combined audio state
  const [combinedAudioBuffer, setCombinedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isCombining, setIsCombining] = useState(false);
  
  // Batch generation state
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  // Update text if prop changes, but only if we haven't started working
  useEffect(() => {
    if(initialText && sections.length === 0) setText(initialText);
  }, [initialText]);

  // Initialize AudioContext
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const handlePrepareSections = () => {
    if (!text.trim()) return;
    setCombinedAudioBuffer(null);
    
    // Split into 50-100 word sections as requested
    const rawSections = splitTextIntoStrictSections(text, 50, 100);
    const newSections: AudioChunk[] = rawSections.map((sectionText, index) => ({
        id: `section-${Date.now()}-${index}`,
        text: sectionText,
        audioBuffer: null,
        status: 'pending'
    }));
    
    setSections(newSections);
  };

  const generateSectionAudio = async (sectionId: string) => {
    // Find section
    let sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) return false;

    // Update status to loading
    setSections(prev => {
        const newS = [...prev];
        const idx = newS.findIndex(s => s.id === sectionId);
        if (idx !== -1) {
            newS[idx] = { ...newS[idx], status: 'loading', error: undefined };
        }
        return newS;
    });

    try {
        const sectionToProcess = sections.find(s => s.id === sectionId);
        if (!sectionToProcess) return false;

        const base64Audio = await generateArabicSpeech(sectionToProcess.text, selectedVoice);
        
        if (audioContextRef.current) {
            const buffer = await decodePCM16(base64Audio, audioContextRef.current);
            
            setSections(prev => {
                const newS = [...prev];
                const idx = newS.findIndex(s => s.id === sectionId);
                if (idx !== -1) {
                    newS[idx] = { ...newS[idx], audioBuffer: buffer, status: 'completed' };
                }
                return newS;
            });
            setCombinedAudioBuffer(null);
            return true;
        } else {
            throw new Error("Audio Context unavailable");
        }
    } catch (e) {
        console.error("Generation failed", e);
        setSections(prev => {
            const newS = [...prev];
            const idx = newS.findIndex(s => s.id === sectionId);
            if (idx !== -1) {
                 newS[idx] = { ...newS[idx], status: 'error', error: e instanceof Error ? e.message : "Generation failed" };
            }
            return newS;
        });
        return false;
    }
  };

  const handleAutoGenerateAll = async () => {
    if (isBatchGenerating) return;
    setIsBatchGenerating(true);

    // Identify pending or failed sections
    const pendingIds = sections
        .filter(s => s.status !== 'completed')
        .map(s => s.id);

    // Process ALL in parallel using Promise.all
    await Promise.all(pendingIds.map(id => generateSectionAudio(id)));

    setIsBatchGenerating(false);
  };

  const handleCombineAll = () => {
    if (!audioContextRef.current) return;
    setIsCombining(true);

    // Filter only completed buffers in order
    const buffersToCombine = sections
        .filter(s => s.status === 'completed' && s.audioBuffer)
        .map(s => s.audioBuffer!);

    if (buffersToCombine.length === 0) {
        setIsCombining(false);
        return;
    }

    try {
        const combined = concatenateAudioBuffers(buffersToCombine, audioContextRef.current);
        setCombinedAudioBuffer(combined);
    } catch (e) {
        console.error("Combination failed", e);
    } finally {
        setIsCombining(false);
    }
  };

  const playBuffer = (buffer: AudioBuffer, id: string) => {
    if (!audioContextRef.current) return;

    if (activeSourceRef.current) {
      activeSourceRef.current.stop();
      activeSourceRef.current = null;
    }

    if (playingChunkId === id) {
        setPlayingChunkId(null);
        return;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
    activeSourceRef.current = source;
    setPlayingChunkId(id);

    source.onended = () => {
      setPlayingChunkId(null);
      activeSourceRef.current = null;
    };
  };

  const downloadBuffer = (buffer: AudioBuffer, filename: string) => {
    const blob = audioBufferToWav(buffer);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
      setSections([]);
      setText('');
      setCombinedAudioBuffer(null);
      setPlayingChunkId(null);
      if (activeSourceRef.current) {
          activeSourceRef.current.stop();
          activeSourceRef.current = null;
      }
  };

  const resetSections = () => {
      setSections([]);
      setCombinedAudioBuffer(null);
  };

  const allSectionsGenerated = sections.length > 0 && sections.every(s => s.status === 'completed');

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Mic className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
          Voice Over Studio
        </h2>
        <div className="flex gap-2">
            <select 
                value={selectedVoice} 
                onChange={(e) => setSelectedVoice(e.target.value as VoiceOption)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none"
            >
                {Object.values(VoiceOption).map((v) => (
                    <option key={v} value={v}>{v} (Standard)</option>
                ))}
            </select>
            {sections.length > 0 && (
                <button 
                    onClick={clearAll} 
                    className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Clear All"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-6">
        
        {sections.length === 0 ? (
            <div className="flex flex-col gap-4 h-full">
                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Step 1: Enter Arabic Script
                </label>
                <textarea
                    className="flex-1 w-full p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm font-arabic text-right text-lg transition-all placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="أدخل النص العربي هنا..."
                    value={text}
                    dir="rtl"
                    onChange={(e) => setText(e.target.value)}
                />
                <div className="flex justify-end">
                    <button
                        onClick={handlePrepareSections}
                        disabled={!text.trim()}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                        <Settings className="w-5 h-5" />
                        Prepare Sections (50-100 words)
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex flex-col h-full gap-4">
                <div className="flex flex-col md:flex-row justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 gap-4">
                    <div>
                        <h3 className="font-bold text-indigo-900 dark:text-indigo-300">Section Manager</h3>
                        <p className="text-sm text-indigo-700 dark:text-indigo-400">
                            {sections.length} sections created.
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={resetSections}
                            className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Edit Text
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {sections.map((section, idx) => (
                        <div 
                            key={section.id} 
                            className={`p-5 rounded-xl border transition-all ${
                                section.status === 'completed' 
                                ? 'bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-900/50 shadow-sm' 
                                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
                                <div className="flex-1 w-full">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                            SECTION {idx + 1}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {section.text.split(' ').length} words
                                        </span>
                                        {section.status === 'completed' && (
                                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                <Layers className="w-3 h-3" /> Ready
                                            </span>
                                        )}
                                        {section.status === 'error' && (
                                            <span className="text-xs text-red-500 font-medium">
                                                Failed
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-arabic text-right text-lg text-gray-800 dark:text-gray-200 leading-loose" dir="rtl">
                                        {section.text}
                                    </p>
                                    {section.error && (
                                        <p className="text-xs text-red-500 mt-2">{section.error}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end md:justify-start">
                                    {section.status === 'completed' ? (
                                        <>
                                            <button
                                                onClick={() => playBuffer(section.audioBuffer!, section.id)}
                                                className={`p-3 rounded-full transition-colors ${
                                                    playingChunkId === section.id 
                                                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400' 
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                }`}
                                                title={playingChunkId === section.id ? "Pause" : "Play"}
                                            >
                                                {playingChunkId === section.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                            </button>
                                            
                                            <button
                                                onClick={() => generateSectionAudio(section.id)}
                                                className="p-3 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                title="Regenerate"
                                            >
                                                <RefreshCw className="w-5 h-5" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => generateSectionAudio(section.id)}
                                            disabled={section.status === 'loading'}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2 min-w-[140px] justify-center"
                                        >
                                            {section.status === 'loading' ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Mic className="w-4 h-4" />
                                                    Generate
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Controls */}
                <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pt-4 mt-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            {allSectionsGenerated ? (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                    <CheckCircleIcon /> All sections ready for combination
                                </span>
                            ) : (
                                <span>Generate all sections to combine</span>
                            )}
                        </div>

                        <div className="flex gap-3 w-full sm:w-auto justify-end">
                            {/* Primary Action Button: Auto-Generate OR Combine OR Download */}
                            {combinedAudioBuffer ? (
                                <>
                                    <button
                                        onClick={() => playBuffer(combinedAudioBuffer, 'combined')}
                                        className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium border transition-colors flex items-center justify-center gap-2 ${
                                            playingChunkId === 'combined'
                                            ? 'border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                        }`}
                                    >
                                        {playingChunkId === 'combined' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        Preview Final
                                    </button>
                                    
                                    <button
                                        onClick={() => downloadBuffer(combinedAudioBuffer, 'full-voiceover.wav')}
                                        className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-shadow shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download Final
                                    </button>

                                    {!allSectionsGenerated && (
                                         <button
                                            onClick={handleCombineAll}
                                            disabled={isCombining}
                                            className="px-3 py-2.5 text-gray-500 hover:text-indigo-600 transition-colors"
                                            title="Update Combination"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    )}
                                </>
                            ) : allSectionsGenerated ? (
                                <button
                                    onClick={handleCombineAll}
                                    disabled={isCombining}
                                    className="flex-1 sm:flex-none w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    {isCombining ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileAudio className="w-4 h-4" />}
                                    Generate All / Combine Audio
                                </button>
                            ) : (
                                <button 
                                    onClick={handleAutoGenerateAll}
                                    disabled={isBatchGenerating}
                                    className="flex-1 sm:flex-none w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    {isBatchGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-yellow-300" />}
                                    {isBatchGenerating ? 'Generating All...' : 'Auto-Generate All'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

export default VoiceOver;