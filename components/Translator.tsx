import React, { useState } from 'react';
import { translateToArabic } from '../services/gemini';
import { TranslationState } from '../types';
import { ArrowRight, Copy, Check, Sparkles, Loader2, Send } from 'lucide-react';

interface TranslatorProps {
  onSendToVoiceOver: (text: string) => void;
}

const Translator: React.FC<TranslatorProps> = ({ onSendToVoiceOver }) => {
  const [state, setState] = useState<TranslationState>({
    sourceText: '',
    translatedText: '',
    isLoading: false,
    error: null,
  });
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    if (!state.sourceText.trim()) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await translateToArabic(state.sourceText);
      setState(prev => ({ ...prev, translatedText: result, isLoading: false }));
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, error: "Translation failed. Please try again." }));
    }
  };

  const handleCopy = () => {
    if (!state.translatedText) return;
    navigator.clipboard.writeText(state.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
          Strict Translation Mode
        </h2>
        {state.translatedText && (
          <button
            onClick={() => onSendToVoiceOver(state.translatedText)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
          >
            <Send className="w-4 h-4" />
            Send to Voice Over
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Source Input */}
        <div className="flex flex-col gap-2 h-full">
          <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source Text</label>
          <textarea
            className="flex-1 w-full p-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:focus:border-transparent outline-none shadow-sm transition-all placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Paste your transcript here (English, Bangla, etc.)"
            value={state.sourceText}
            onChange={(e) => setState(prev => ({ ...prev, sourceText: e.target.value }))}
          />
        </div>

        {/* Action Button (Mobile only mostly, or middle) */}
        <div className="lg:hidden flex justify-center">
          <button
            onClick={handleTranslate}
            disabled={state.isLoading || !state.sourceText}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {state.isLoading ? 'Translating...' : 'Translate to Arabic'}
          </button>
        </div>

        {/* Target Output */}
        <div className="flex flex-col gap-2 h-full relative">
          <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex justify-between">
            <span>Arabic Output (Fusha)</span>
            {state.translatedText && (
              <button onClick={handleCopy} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 text-xs">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </label>
          <div className="relative flex-1">
             <textarea
              className="w-full h-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl resize-none bg-gray-50 dark:bg-gray-800/50 dark:text-emerald-50 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm font-arabic text-right text-lg leading-relaxed placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="الترجمة ستظهر هنا..."
              value={state.translatedText}
              readOnly
              dir="rtl"
            />
            {state.isLoading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm flex items-center justify-center rounded-xl">
                 <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex justify-end">
        <button
          onClick={handleTranslate}
          disabled={state.isLoading || !state.sourceText}
          className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          {state.isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Translating...
            </>
          ) : (
            <>
              Translate
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
      
      {state.error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-900/30">
          {state.error}
        </div>
      )}
    </div>
  );
};

export default Translator;