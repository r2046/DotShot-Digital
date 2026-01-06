import React, { useState, useEffect } from 'react';
import { AppMode } from './types';
import Translator from './components/Translator';
import VoiceOver from './components/VoiceOver';
import ImageEditor from './components/ImageEditor';
import { Languages, Mic, Menu, X, Image as ImageIcon, Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TRANSLATOR);
  const [voiceOverInitialText, setVoiceOverInitialText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize dark mode based on system preference
  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleSendToVoiceOver = (text: string) => {
    setVoiceOverInitialText(text);
    setMode(AppMode.VOICEOVER);
  };

  const NavButton = ({ targetMode, icon: Icon, label }: { targetMode: AppMode, icon: any, label: string }) => {
    const isActive = mode === targetMode;
    let activeClass = '';
    let iconClass = '';

    if (isActive) {
        if (targetMode === AppMode.TRANSLATOR) {
            activeClass = 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30';
            iconClass = 'text-emerald-600 dark:text-emerald-400';
        } else if (targetMode === AppMode.VOICEOVER) {
            activeClass = 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/30';
            iconClass = 'text-indigo-600 dark:text-indigo-400';
        } else if (targetMode === AppMode.IMAGE_EDITOR) {
            activeClass = 'bg-sky-50 text-sky-700 shadow-sm border border-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-900/30';
            iconClass = 'text-sky-600 dark:text-sky-400';
        }
    } else {
        activeClass = 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200';
        iconClass = 'text-gray-400 dark:text-gray-500';
    }

    return (
        <button
          onClick={() => {
            setMode(targetMode);
            setIsSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeClass}`}
        >
          <Icon className={`w-5 h-5 ${iconClass}`} />
          {label}
        </button>
    );
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 transform transition-transform duration-200 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white text-lg font-serif">ض</span>
            Fusha Flow
          </h1>
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <nav className="px-4 space-y-2 mt-4">
          <NavButton targetMode={AppMode.TRANSLATOR} icon={Languages} label="Translator" />
          <NavButton targetMode={AppMode.VOICEOVER} icon={Mic} label="Voice Over" />
          <NavButton targetMode={AppMode.IMAGE_EDITOR} icon={ImageIcon} label="Image Editor" />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6">
            <button 
                onClick={toggleDarkMode}
                className="w-full mb-4 flex items-center justify-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <div className="text-xs text-gray-400 dark:text-gray-600 text-center">
                Powered by Gemini AI
                <br/>
                v1.2.0
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50/50 dark:bg-gray-950">
        <header className="lg:hidden p-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
             <h1 className="font-bold text-gray-900 dark:text-white">Fusha Flow</h1>
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600 dark:text-gray-400">
                <Menu className="w-6 h-6" />
             </button>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-hidden">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 h-full p-6 lg:p-8 transition-colors duration-200">
            {mode === AppMode.TRANSLATOR && <Translator onSendToVoiceOver={handleSendToVoiceOver} />}
            {mode === AppMode.VOICEOVER && <VoiceOver initialText={voiceOverInitialText} />}
            {mode === AppMode.IMAGE_EDITOR && <ImageEditor />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;