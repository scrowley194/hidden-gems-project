import React, { useState, useEffect } from 'react';
import { X, Save, MapPin, Sparkles, Loader2, Utensils, Coffee, Martini, Ticket, HelpCircle } from 'lucide-react';
import { Location, Category, Coordinate, PlaceType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (location: Omit<Location, 'id'>) => void;
  currentCenter: Coordinate;
  prefillData?: Partial<Location> | null;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({ isOpen, onClose, onAdd, currentCenter, prefillData }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Hidden Gem');
  const [placeType, setPlaceType] = useState<PlaceType>('Other');
  const [coordinate, setCoordinate] = useState<Coordinate>(currentCenter);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Initialize form state when modal opens
  useEffect(() => {
    if (isOpen) {
        if (prefillData) {
            setName(prefillData.name || '');
            setDescription(prefillData.description || '');
            setCategory(prefillData.category || 'Hidden Gem');
            setPlaceType(prefillData.placeType || 'Other');
            
            // Use provided coordinate OR fallback to current center
            const targetCoord = prefillData.coordinate || currentCenter;
            setCoordinate(targetCoord);

            // Case 1: Name provided, but no coords (Chat) -> Geocode Name or Address
            if (prefillData.name && !prefillData.coordinate) {
                performGeocode(prefillData.name, prefillData.address);
            }
            // Case 2: Coords provided, but no name (Map Click) -> Reverse Geocode
            else if (prefillData.coordinate && !prefillData.name) {
                performReverseGeocode(prefillData.coordinate);
            }
        } else {
            // Fresh open (e.g. from FAB), use current center
            setCoordinate(currentCenter);
            setName('');
            setDescription('');
            setCategory('Hidden Gem');
            setPlaceType('Other');
        }
    }
  }, [isOpen, prefillData, currentCenter]);

  // Robust geocoding that prioritizes specific POIs and Addresses
  const performGeocode = async (queryName: string, queryAddress?: string) => {
    setIsGeocoding(true);
    try {
        let q = queryName + ' Singapore';
        
        // Strategy: If address contains a 6-digit postal code, USE IT. It is the most accurate.
        if (queryAddress) {
            const postalMatch = queryAddress.match(/\d{6}/);
            if (postalMatch) {
                q = postalMatch[0] + ' Singapore';
            } else if (queryAddress.length > 5) {
                q = queryAddress + ' Singapore';
            }
        }

        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`);
        const data = await res.json();
        
        let bestMatch = null;

        if (data && data.length > 0) {
            if (queryAddress && queryAddress.match(/\d{6}/)) {
                // Postal code match is gold
                bestMatch = data[0];
            } else if (queryAddress) {
                bestMatch = data[0];
            } else {
                // Name search logic
                bestMatch = data.find((d: any) => 
                    d.class === 'amenity' || 
                    d.class === 'tourism' || 
                    d.class === 'shop' || 
                    d.class === 'leisure' ||
                    d.type === 'restaurant' ||
                    d.type === 'cafe' ||
                    d.type === 'bar'
                );
                if (!bestMatch) bestMatch = data[0];
            }
        }

        if (bestMatch) {
            setCoordinate({ lat: parseFloat(bestMatch.lat), lng: parseFloat(bestMatch.lon) });
        }
    } catch (e) {
        console.error("Geocode failed", e);
    } finally {
        setIsGeocoding(false);
    }
  };

  const performReverseGeocode = async (coord: Coordinate) => {
      setIsGeocoding(true);
      try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coord.lat}&lon=${coord.lng}&zoom=18&addressdetails=1`);
          const data = await res.json();
          if (data) {
              // Try to find the best name
              const placeName = data.name || 
                                data.address?.amenity || 
                                data.address?.building || 
                                data.address?.tourism || 
                                data.address?.shop || 
                                data.address?.road ||
                                "Unknown Location";
              
              setName(placeName);
              
              // Try to infer type
              if (data.address?.amenity === 'restaurant') setPlaceType('Restaurant');
              else if (data.address?.amenity === 'cafe') setPlaceType('Cafe');
              else if (data.address?.amenity === 'bar') setPlaceType('Bar');
          }
      } catch (e) {
          console.error("Reverse Geocode failed", e);
      } finally {
          setIsGeocoding(false);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name,
      description,
      category,
      placeType,
      coordinate: coordinate,
      image: `https://picsum.photos/seed/${Date.now()}/600/400`,
      visited: false,
    });
    // Reset form
    setName('');
    setDescription('');
    setCategory('Hidden Gem');
    setPlaceType('Other');
    onClose();
  };

  const handleAiAutoFill = async () => {
    if (!name.trim()) return;
    setIsAiLoading(true);
    setIsGeocoding(true);

    // AI Logic: Fetch Content AND Address for accurate pinning
    const aiPromise = (async () => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Analyze the place named "${name}" in Singapore.
                
                I need specific details and its EXACT location.
                If it's a specific venue (restaurant, shop, etc.), find its address.
                
                Return JSON.`,
                config: {
                    tools: [{ googleSearch: {} }],
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            category: { type: Type.STRING, enum: ['Hidden Gem', 'Tourist Trap'] },
                            placeType: { type: Type.STRING, enum: ['Restaurant', 'Bar', 'Cafe', 'Activity', 'Other'] },
                            address: { type: Type.STRING },
                            coordinates: {
                                type: Type.OBJECT,
                                properties: {
                                    lat: { type: Type.NUMBER },
                                    lng: { type: Type.NUMBER }
                                },
                                nullable: true
                            }
                        },
                        required: ['description', 'category', 'placeType', 'address']
                    }
                },
            });
            return JSON.parse(response.text || "{}");
        } catch (error: any) {
            console.error("AI Content gen failed", error);
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                 throw new Error("QUOTA_EXCEEDED");
            }
            return null;
        }
    })();

    try {
        const result = await aiPromise;

        if (result) {
            setDescription(result.description || "");
            setCategory((result.category as Category) || 'Hidden Gem');
            setPlaceType((result.placeType as PlaceType) || 'Other');
            
            // Prioritize AI coordinates if they exist (Google Search is smart)
            if (result.coordinates && result.coordinates.lat && result.coordinates.lng) {
                setCoordinate({ lat: result.coordinates.lat, lng: result.coordinates.lng });
                setIsGeocoding(false); // We have coords, skip nominatim
            } else {
                // Fallback to geocoding the address
                let addressToGeocode = result.address || name + ' Singapore';
                performGeocode(name, addressToGeocode);
            }
        } else {
            setDescription("Could not fetch AI details. Please enter manually.");
            setIsGeocoding(false);
        }
    } catch (error: any) {
        console.error("Autofill error", error);
        if (error.message === "QUOTA_EXCEEDED") {
             setDescription("Auto-fill unavailable: AI quota exceeded. Please enter details manually.");
        } else {
             setDescription("Error during auto-fill.");
        }
        setIsGeocoding(false);
    } finally {
        setIsAiLoading(false);
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
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Add Location</h3>
                <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name & Auto-fill */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Place Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all placeholder-zinc-600"
                      placeholder={isGeocoding ? "Identifying place..." : "e.g. Secret Beach"}
                    />
                    <button
                      type="button"
                      onClick={handleAiAutoFill}
                      disabled={!name.trim() || isAiLoading}
                      className="px-3 bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 rounded-xl hover:bg-indigo-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      title="Auto-fill details & location"
                    >
                      {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                    </button>
                  </div>
                </div>

                {/* Place Type */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                    Type
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { type: 'Restaurant', icon: Utensils, label: 'Food' },
                      { type: 'Bar', icon: Martini, label: 'Bar' },
                      { type: 'Cafe', icon: Coffee, label: 'Cafe' },
                      { type: 'Activity', icon: Ticket, label: 'Fun' },
                      { type: 'Other', icon: HelpCircle, label: 'Other' },
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setPlaceType(item.type as PlaceType)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                          placeType === item.type
                            ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                            : 'bg-zinc-800/50 border-transparent text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        <item.icon size={16} />
                        <span className="text-[9px]">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vibe Category */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                    Vibe
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCategory('Hidden Gem')}
                      className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                        category === 'Hidden Gem'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      💎 Hidden Gem
                    </button>
                    <button
                      type="button"
                      onClick={() => setCategory('Tourist Trap')}
                      className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                        category === 'Tourist Trap'
                          ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      📸 Tourist Trap
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all placeholder-zinc-600 resize-none"
                    placeholder="What makes this place special?"
                  />
                </div>

                {/* Coordinates Display */}
                <div className="pt-2 flex items-center justify-between text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                        {isGeocoding ? (
                            <Loader2 size={12} className="animate-spin text-sky-400" />
                        ) : (
                            <MapPin size={12} className={coordinate !== currentCenter ? "text-sky-400" : ""} />
                        )}
                        <span className={coordinate !== currentCenter ? "text-sky-400 font-medium" : ""}>
                            {isGeocoding 
                                ? "Locating..." 
                                : coordinate !== currentCenter 
                                    ? "Location Found" 
                                    : "Using map center"}
                        </span>
                    </div>
                    <div>
                        {coordinate.lat.toFixed(4)}, {coordinate.lng.toFixed(4)}
                    </div>
                </div>

                <button
                  type="submit"
                  disabled={isGeocoding}
                  className="w-full py-4 bg-white text-black rounded-xl font-bold text-base hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  <Save size={18} />
                  Save Location
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};