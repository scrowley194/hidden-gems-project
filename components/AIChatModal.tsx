import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, ExternalLink, PlusCircle, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { Location } from '../types';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlace: (place: Partial<Location>) => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: { uri: string; title: string }[];
  placeSuggestions?: Partial<Location>[];
}

const displayPlacesTool: FunctionDeclaration = {
  name: "display_places",
  description: "Display a list of recommended places to the user with structured details. Use this whenever the user asks for recommendations or mentions specific places.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      places: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['Hidden Gem', 'Tourist Trap'], description: "Infer 'Hidden Gem' or 'Tourist Trap' from context." },
            placeType: { type: Type.STRING, enum: ['Restaurant', 'Bar', 'Cafe', 'Activity', 'Other'] },
            address: { type: Type.STRING, description: "The specific street address or distinct location area of the place." },
          },
          required: ['name', 'description', 'category', 'placeType']
        }
      }
    },
    required: ['places']
  }
};

export const AIChatModal: React.FC<AIChatModalProps> = ({ isOpen, onClose, onAddPlace }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your AI travel assistant. Ask me to recommend some hidden gems or interesting spots in Singapore!' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Step 1: Search for information (Text only)
      // We use gemini-3-flash-preview for better search grounding and reasoning
      const searchResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${userMessage}
        
        IMPORTANT: Provide the response in a clear, informative text format. 
        If recommending places, mention their names, what they are (cafe, park, etc.), and why they are good. 
        If specific addresses are found, mention them.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = searchResponse.text || "I couldn't find any specific recommendations.";
      
      // Extract grounding sources if any
      let sources: { uri: string; title: string }[] = [];
      const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        sources = groundingChunks
          .map((chunk: any) => chunk.web)
          .filter((web: any) => web && web.uri && web.title);
      }

      let placeSuggestions: Partial<Location>[] = [];

      // Step 2: Extract Structured Data (Function Calling)
      // Only attempt extraction if the response is substantial
      if (text.length > 50) {
        try {
            // We use gemini-3-flash-preview again for robust extraction and forcing the tool call
            const extractResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `You are a data extraction assistant.
                Analyze the following text. If it contains specific recommendations for places, restaurants, attractions, or shops, extract them into a structured list using the 'display_places' tool.
                
                - Infer the Category ('Hidden Gem' vs 'Tourist Trap') based on the description (e.g. "popular", "crowded" -> Trap; "quiet", "local" -> Gem).
                - Infer the Place Type ('Restaurant', 'Bar', 'Cafe', 'Activity', 'Other').
                - Extract the Address if present.
                
                TEXT TO ANALYZE:
                ${text}`,
                config: {
                    tools: [{ functionDeclarations: [displayPlacesTool] }],
                    toolConfig: {
                        functionCallingConfig: {
                            mode: 'ANY', // Force the model to try and use the tool
                            allowedFunctionNames: ['display_places']
                        }
                    }
                },
            });

            if (extractResponse.functionCalls) {
                for (const call of extractResponse.functionCalls) {
                    if (call.name === 'display_places') {
                        const args = call.args as any;
                        if (args.places && Array.isArray(args.places)) {
                            placeSuggestions = args.places;
                        }
                    }
                }
            }
        } catch (extractError) {
            console.warn("Structured extraction failed", extractError);
            // Don't fail the whole chat, just log it. The user still sees the text.
        }
      }

      setMessages(prev => [...prev, { role: 'model', text, sources, placeSuggestions }]);

    } catch (error: any) {
      console.error(error);
      let errorMessage = "Sorry, I encountered an error. Please try again.";
      
      if (error.message?.includes('429') || error.message?.includes('quota') || error.toString().includes('429')) {
          errorMessage = "I've reached my daily usage limit for AI responses. Please try again later.";
      } 
      else if (error.message?.includes('400') || error.toString().includes('400')) {
          errorMessage = "I'm having trouble processing that request. Please try rephrasing.";
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px] max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-400" />
                <h3 className="text-lg font-bold text-white">Travel Assistant</h3>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-zinc-950/50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
                  
                  {/* Text Bubble */}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-sky-600 text-white rounded-br-none'
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-700'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Place Suggestions Cards */}
                  {msg.placeSuggestions && msg.placeSuggestions.length > 0 && (
                    <div className="w-full pl-2 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {msg.placeSuggestions.map((place, i) => (
                        <div key={i} className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-3 flex gap-3 hover:bg-zinc-800 transition-colors">
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white text-sm">{place.name}</h4>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  place.category === 'Hidden Gem' 
                                  ? 'border-emerald-500/30 text-emerald-400/80' 
                                  : 'border-rose-500/30 text-rose-400/80'
                                }`}>
                                  {place.category === 'Hidden Gem' ? 'Gem' : 'Trap'}
                                </span>
                             </div>
                             <p className="text-xs text-zinc-400 line-clamp-2">{place.description}</p>
                             {place.address && (
                                 <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
                                     <MapPin size={10} /> {place.address}
                                 </div>
                             )}
                          </div>
                          <button 
                            onClick={() => {
                                onAddPlace(place);
                                onClose();
                            }}
                            className="flex flex-col items-center justify-center gap-1 px-3 bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 rounded-lg transition-colors border border-sky-500/20"
                            title="Add to Map"
                          >
                             <PlusCircle size={18} />
                             <span className="text-[10px] font-medium">Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-w-[85%]">
                      {msg.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 px-2 py-1 rounded-full transition-colors truncate max-w-full"
                        >
                          <ExternalLink size={10} />
                          {source.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-zinc-800 rounded-2xl rounded-bl-none px-4 py-3 border border-zinc-700">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-zinc-900 border-t border-zinc-800">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Suggest 3 hidden gems for dinner..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-4 pr-12 py-3 text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all placeholder-zinc-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-sky-600 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-500 transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1">
                <Sparkles size={10} />
                Powered by Gemini 3 Flash Preview & Google Search
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};