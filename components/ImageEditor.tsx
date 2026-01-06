import React, { useState, useRef } from 'react';
import { editImage } from '../services/gemini';
import { Image as ImageIcon, Wand2, Upload, Loader2, Download, RefreshCw, X } from 'lucide-react';

const ImageEditor: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceImageFile, setSourceImageFile] = useState<{ base64: string, mimeType: string } | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please upload a valid image file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setSourceImage(result);
        setResultImage(null); // Clear previous result
        
        // Extract base64 data and mime type for API
        // result is like "data:image/png;base64,....."
        const matches = result.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            setSourceImageFile({
                mimeType: matches[1],
                base64: matches[2]
            });
            setError(null);
        } else {
            setError("Failed to process image.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async () => {
    if (!sourceImageFile || !prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const resultBase64 = await editImage(
        sourceImageFile.base64,
        sourceImageFile.mimeType,
        prompt
      );
      setResultImage(`data:image/png;base64,${resultBase64}`);
    } catch (err) {
      setError("Image editing failed. Please try again with a different prompt or image.");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearAll = () => {
    setSourceImage(null);
    setSourceImageFile(null);
    setResultImage(null);
    setPrompt('');
    setError(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const downloadImage = () => {
    if (resultImage) {
      const a = document.createElement('a');
      a.href = resultImage;
      a.download = `edited-image-${Date.now()}.png`;
      a.click();
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-sky-600 dark:text-sky-500" />
          AI Image Editor
        </h2>
        {sourceImage && (
             <button onClick={clearAll} className="text-red-500 hover:text-red-600 text-sm flex items-center gap-1">
                 <RefreshCw className="w-4 h-4" /> Reset
             </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
        
        {/* Left Column: Source Image & Controls */}
        <div className="flex flex-col gap-6 h-full">
            
            {/* Upload Area */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center relative overflow-hidden group hover:border-sky-400 dark:hover:border-sky-500 transition-colors">
                {sourceImage ? (
                    <>
                        <img src={sourceImage} alt="Source" className="w-full h-full object-contain p-4" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-white text-gray-800 px-4 py-2 rounded-lg font-medium shadow-lg"
                            >
                                Change Image
                            </button>
                        </div>
                    </>
                ) : (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-center cursor-pointer p-8 w-full h-full flex flex-col items-center justify-center"
                    >
                        <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-full flex items-center justify-center mb-4">
                            <Upload className="w-8 h-8" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 font-medium">Click to upload an image</p>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">PNG, JPG up to 10MB</p>
                    </div>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                />
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Edit Instruction</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="E.g., Add a retro filter, Remove the background person..."
                        className="flex-1 p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-sky-500 outline-none placeholder-gray-400 dark:placeholder-gray-400"
                    />
                    <button
                        onClick={handleEdit}
                        disabled={isGenerating || !sourceImage || !prompt.trim()}
                        className="bg-sky-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-sky-700 dark:hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                        Generate
                    </button>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
        </div>

        {/* Right Column: Result */}
        <div className="flex flex-col gap-2 h-full">
            <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex justify-between items-center h-6">
                <span>Result</span>
                {resultImage && (
                    <button onClick={downloadImage} className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 text-xs">
                        <Download className="w-4 h-4" /> Download
                    </button>
                )}
            </label>
            <div className="flex-1 bg-gray-900 dark:bg-black/80 rounded-xl flex items-center justify-center relative overflow-hidden border border-gray-800 dark:border-gray-700">
                {resultImage ? (
                    <img src={resultImage} alt="Result" className="w-full h-full object-contain p-4" />
                ) : (
                    <div className="text-center text-gray-600 dark:text-gray-500">
                        {isGenerating ? (
                             <div className="flex flex-col items-center">
                                <Loader2 className="w-10 h-10 text-sky-500 animate-spin mb-2" />
                                <p className="text-gray-400">Transforming your image...</p>
                             </div>
                        ) : (
                             <div className="flex flex-col items-center">
                                <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                                <p className="text-sm opacity-50">Edited image will appear here</p>
                             </div>
                        )}
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default ImageEditor;