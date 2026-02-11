import React, { useEffect, useState } from 'react';
import { Location, PlaceType } from '../types';
import { Navigation, X, Lightbulb, Loader2, Star, Globe, Utensils, Coffee, Martini, Ticket, CheckCircle2, Circle, Plus, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";

interface LocationCardProps {
  location: Location | null;
  onClose: () => void;
  onToggleVisited: (id: string) => void;
  onAdd: (location: Location) => void;
  onRemove: (id: string) => void;
  isSaved: boolean;
}

const TypeBadge = ({ type }: { type: PlaceType }) => {
  const iconMap = {
    Restaurant: Utensils,
    Bar: Martini,
    Cafe: Coffee,
    Activity: Ticket,
    Other: Star,
  };
  const Icon = iconMap[type] || Star;
  
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300">
      <Icon size={12} />
      <span className="text-xs font-medium">{type}</span>
    </div>
  );
};

export const LocationCard: React.FC<LocationCardProps> = ({ location, onClose, onToggleVisited, onAdd, onRemove, isSaved }) => {
  const [tip, setTip] = useState<string | null>(null);
  const [webInsights, setWebInsights] = useState<{rating?: string, summary: string, sources: any[]} | null>(null);
  const [loadingTip, setLoadingTip] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    if (location) {
      setTip(null);
      setWebInsights(null);
      setQuotaExceeded(false);
      setLoadingTip(true);
      setLoadingInsights(true);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 1. Fetch Quick Tip (Flash Lite)
      const fetchTip = async () => {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: `Give me exactly one interesting, short, unique travel tip (under 20 words) for visiting ${location.name} in Singapore.`,
          });
          setTip(response.text || "Enjoy your visit!");
        } catch (error: any) {
          // If quota exceeded or other error, provide generic fallback
          if (error.message?.includes('429') || error.message?.includes('quota')) {
             setTip("Discovering this place is half the fun!");
          } else {
             setTip("Enjoy your visit!");
          }
        } finally {
          setLoadingTip(false);
        }
      };
      
      // 2. Fetch Web Ratings (Flash 3 Preview + Google Search)
      const fetchInsights = async () => {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Search for current ratings and reviews of "${location.name}" in Singapore from sources like Google Maps, TripAdvisor, and food blogs. 
            Provide a very brief summary (1-2 sentences) of the general sentiment (e.g., "Highly rated for brunch", "Mixed reviews on service"). 
            If you find a numeric rating out of 5, mention it.`,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });
          
          const text = response.text || "No reviews found.";
          const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
          
          setWebInsights({
            summary: text,
            sources: sources.map((c: any) => c.web).filter((w: any) => w),
          });
        } catch (error: any) {
          if (error.message?.includes('429') || error.message?.includes('quota')) {
              setQuotaExceeded(true);
          }
          setWebInsights(null);
        } finally {
          setLoadingInsights(false);
        }
      };

      fetchTip();
      fetchInsights();
    }
  }, [location]);

  return (
    <AnimatePresence>
      {location && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute bottom-0 left-0 right-0 z-[1000] p-2 sm:p-6"
        >
          <div className="mx-auto max-w-md bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative max-h-[85vh] overflow-y-auto">
            
            {/* Image Header */}
            <div className="h-48 w-full relative">
              <img 
                src={location.image} 
                alt={location.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
              
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {isSaved && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onRemove(location.id);
                    }}
                    className="p-2 bg-black/40 hover:bg-rose-900/80 text-white/80 hover:text-rose-200 rounded-full backdrop-blur-sm transition-colors"
                    title="Remove Location"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-sm transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="absolute bottom-4 left-5 right-5">
                <div className="flex gap-2 mb-2">
                    <TypeBadge type={location.placeType} />
                    {location.category && (
                        <span className={`inline-block px-2 py-1 rounded-lg text-xs font-semibold ${
                            location.category === 'Hidden Gem' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                            {location.category === 'Hidden Gem' ? '💎 Hidden Gem' : '📸 Tourist Trap'}
                        </span>
                    )}
                </div>
                <h2 className="text-3xl font-bold text-white shadow-black drop-shadow-lg">{location.name}</h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              
              {/* Actions Row */}
              <div className="flex gap-3">
                {isSaved ? (
                     <button 
                     onClick={() => onToggleVisited(location.id)}
                     className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                       location.visited 
                         ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                         : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                     }`}
                   >
                     {location.visited ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                     {location.visited ? 'Visited' : 'Mark Visited'}
                   </button>
                ) : (
                    <button 
                    onClick={() => onAdd(location)}
                    className="flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
                  >
                    <Plus size={18} />
                    Add to Map
                  </button>
                )}
               
                <button 
                  className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-900/20"
                  onClick={() => alert(`Navigating to ${location.name}...`)}
                >
                  <Navigation size={18} />
                  Directions
                </button>
              </div>

              <p className="text-zinc-400 text-sm leading-relaxed">
                {location.description || "No description available."}
              </p>

              {/* AI Quick Tip */}
              <div className="p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex items-start gap-3">
                <div className="mt-0.5 p-1 bg-indigo-500/20 rounded-full text-indigo-300">
                  <Lightbulb size={14} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-0.5">Gemini Tip</div>
                  {loadingTip ? (
                     <div className="flex items-center gap-2 text-xs text-zinc-500">
                       <Loader2 size={12} className="animate-spin" /> Thinking...
                     </div>
                  ) : (
                    <p className="text-xs text-zinc-300 italic">"{tip}"</p>
                  )}
                </div>
              </div>

              {/* Web Ratings & Insights */}
              <div className="p-4 bg-zinc-800/40 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                   <Globe size={14} className="text-emerald-400" />
                   <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Web Ratings & Reviews</h4>
                </div>
                
                {loadingInsights ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
                       <Loader2 size={14} className="animate-spin" /> Checking Google & TripAdvisor...
                    </div>
                ) : quotaExceeded ? (
                    <div className="flex items-center gap-2 text-xs text-amber-500/80 py-1">
                       <AlertCircle size={14} />
                       <span>AI usage limit reached. Please try again later.</span>
                    </div>
                ) : webInsights ? (
                    <div className="space-y-2">
                        <p className="text-sm text-zinc-300">{webInsights.summary}</p>
                        {webInsights.sources.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {webInsights.sources.slice(0, 3).map((source: any, i: number) => (
                                    <a 
                                        key={i} 
                                        href={source.uri} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-[10px] text-zinc-500 hover:text-emerald-400 underline truncate max-w-[100px]"
                                    >
                                        {source.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-zinc-500">No recent ratings found.</p>
                )}
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};