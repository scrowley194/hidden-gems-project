import React, { useState, useMemo, useEffect } from 'react';
import { Plus, MessageSquare, List, Loader2 } from 'lucide-react';
import { Location, Coordinate, PlaceType } from './types';
import { MOCK_LOCATIONS, INITIAL_VIEW_STATE } from './constants';
import { MapBoard } from './components/MapBoard';
import { SearchBar, SearchSuggestion } from './components/SearchBar';
import { LocationCard } from './components/LocationCard';
import { AddLocationModal } from './components/AddLocationModal';
import { AIChatModal } from './components/AIChatModal';
import { ListView } from './components/ListView';
import { GoogleGenAI, Type } from "@google/genai";

const App = () => {
  // Initialize locations from localStorage to persist data
  const [locations, setLocations] = useState<Location[]>(() => {
    try {
      const saved = localStorage.getItem('hidden_gems_locations');
      return saved ? JSON.parse(saved) : MOCK_LOCATIONS;
    } catch (error) {
      console.error('Error loading locations from localStorage:', error);
      return MOCK_LOCATIONS;
    }
  });

  const [suggestedLocations, setSuggestedLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Location | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isSearchingArea, setIsSearchingArea] = useState(false);
  const [currentMapCenter, setCurrentMapCenter] = useState<Coordinate>(INITIAL_VIEW_STATE.center);
  const [draftLocation, setDraftLocation] = useState<Partial<Location> | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Persist locations to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('hidden_gems_locations', JSON.stringify(locations));
    } catch (error) {
      console.error('Error saving locations to localStorage:', error);
    }
  }, [locations]);

  // Safety cleanup: ensure body styles are reset when no modals are open
  // This fixes issues where Framer Motion drags might leave cursor/select styles on body
  useEffect(() => {
    if (!isListOpen && !isAddModalOpen && !isChatOpen) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.pointerEvents = '';
        // Ensure overflow is correct for standard viewing
        document.body.style.overflow = 'hidden'; 
    }
  }, [isListOpen, isAddModalOpen, isChatOpen]);

  // Filter locations based on search query (local filter)
  const filteredLocations = useMemo(() => {
    if (!searchQuery) return locations;
    return locations.filter(loc => 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [locations, searchQuery]);

  const handleLocationSelect = (location: Location) => {
    setSelectedLocationId(location.id);
  };

  const handleAddLocation = (newLocationData: Omit<Location, 'id'>) => {
    const newLocation: Location = {
      ...newLocationData,
      id: Date.now().toString(),
    };
    setLocations(prev => [...prev, newLocation]);
    
    // Remove from suggestions if it was one
    setSuggestedLocations(prev => prev.filter(l => l.name !== newLocation.name));
    
    setSelectedLocationId(newLocation.id); 
    setSearchResult(null);
  };

  const handleToggleVisited = (id: string) => {
    setLocations(prev => prev.map(loc => 
      loc.id === id ? { ...loc, visited: !loc.visited } : loc
    ));
  };

  const handleRemoveLocation = (id: string) => {
    // 1. Check if it's a saved location
    const isSaved = locations.some(l => l.id === id);
    if (isSaved) {
        setLocations(prev => prev.filter(l => l.id !== id));
        if (selectedLocationId === id) setSelectedLocationId(null);
        return;
    }

    // 2. Check if it's a suggested location (just dismiss it, no confirm needed usually)
    const isSuggested = suggestedLocations.some(l => l.id === id);
    if (isSuggested) {
        setSuggestedLocations(prev => prev.filter(l => l.id !== id));
        if (selectedLocationId === id) setSelectedLocationId(null);
        return;
    }

    // 3. Check if it's the temp search result
    if (searchResult && searchResult.id === id) {
        setSearchResult(null);
        if (selectedLocationId === id) setSelectedLocationId(null);
        return;
    }
  };

  const handleReorder = (newLocations: Location[]) => {
    setLocations(newLocations);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
      // 1. Parse Name
      // Nominatim addresses are detailed. We prefer specific venue names.
      let name = suggestion.display_name.split(',')[0];
      if (suggestion.address) {
          name = suggestion.address.amenity || suggestion.address.building || suggestion.address.shop || suggestion.address.tourism || name;
      }

      // 2. Parse Type
      let placeType: PlaceType = 'Other';
      if (suggestion.type === 'restaurant') placeType = 'Restaurant';
      else if (suggestion.type === 'cafe') placeType = 'Cafe';
      else if (suggestion.type === 'bar' || suggestion.type === 'pub') placeType = 'Bar';
      else if (suggestion.class === 'tourism') placeType = 'Activity';
      
      const newTempLocation: Location = {
          id: 'temp-search-result',
          name: name,
          coordinate: { lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) },
          description: `Found at: ${suggestion.display_name}`,
          category: 'Hidden Gem',
          placeType: placeType,
          image: `https://picsum.photos/seed/${suggestion.place_id}/600/400`,
          visited: false,
          address: suggestion.display_name
      };

      setSearchResult(newTempLocation);
      setSelectedLocationId(newTempLocation.id);
      
      // Update query to match selection
      setSearchQuery(name);
  };

  const handleGlobalSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    // 1. Local Check
    const localMatch = locations.find(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (localMatch) {
        setSelectedLocationId(localMatch.id);
        setSearchResult(null);
        setIsSearching(false);
        return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // 2. AI Search for precise details
        const prompt = `
          Search for the place "${searchQuery}" in Singapore. 
          I need to place a pin on a map.
          
          Return a JSON object with the following fields:
          - name: The official name of the place.
          - address: The full address including postal code.
          - coordinates: { lat: number, lng: number } (Try to find the exact coordinates. If not found, return null).
          - description: A short 1 sentence description.
          - category: "Hidden Gem" or "Tourist Trap" (Guess based on popularity).
          - placeType: "Restaurant", "Bar", "Cafe", "Activity", or "Other".

          Important:
          - If the user searches for a vague name (e.g. "Bunnies"), find the most likely specific place (e.g. "Bunnies Bakery" or "Bunnies Cafe").
          - Singapore postal codes are 6 digits. Finding this is the most accurate way to locate a building.
          
          Response format: JSON only.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    address: { type: Type.STRING },
                    coordinates: {
                      type: Type.OBJECT,
                      properties: {
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER }
                      },
                      nullable: true
                    },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ['Hidden Gem', 'Tourist Trap'] },
                    placeType: { type: Type.STRING, enum: ['Restaurant', 'Bar', 'Cafe', 'Activity', 'Other'] }
                  },
                  required: ['name', 'address', 'description', 'category', 'placeType']
                }
            }
        });

        const jsonText = response.text;
        if (!jsonText) throw new Error("No AI response");
        
        const result = JSON.parse(jsonText);
        
        let finalLat = result.coordinates?.lat;
        let finalLng = result.coordinates?.lng;

        // 3. Validation / Fallback Geocoding
        if (!finalLat || !finalLng) {
            let query = result.address || result.name + " Singapore";
            
            // Prefer postal code if available in address (Standard Singapore 6-digit postal code)
            const postalMatch = result.address?.match(/\d{6}/);
            if (postalMatch) {
                query = postalMatch[0] + " Singapore"; 
                console.log("Geocoding using postal code:", query);
            } else {
                console.log("Geocoding using full address:", query);
            }

            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            const geoData = await geoRes.json();
            
            if (geoData && geoData.length > 0) {
                finalLat = parseFloat(geoData[0].lat);
                finalLng = parseFloat(geoData[0].lon);
            }
        }

        if (finalLat && finalLng) {
             const newTempLocation: Location = {
                id: 'temp-search-result',
                name: result.name || searchQuery,
                coordinate: { lat: finalLat, lng: finalLng },
                description: result.description || `Found at ${result.address}`,
                category: result.category || 'Hidden Gem',
                placeType: result.placeType || 'Other',
                image: `https://picsum.photos/seed/${Date.now()}/600/400`,
                visited: false,
                address: result.address
            };
            setSearchResult(newTempLocation);
            setSelectedLocationId(newTempLocation.id);
        } else {
             const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ' Singapore')}&limit=1`);
             const fallbackData = await fallbackRes.json();
             if (fallbackData && fallbackData.length > 0) {
                 const best = fallbackData[0];
                 const newTempLocation: Location = {
                    id: 'temp-search-result',
                    name: best.name || searchQuery,
                    coordinate: { lat: parseFloat(best.lat), lng: parseFloat(best.lon) },
                    description: `Found: ${best.display_name}`,
                    category: 'Hidden Gem',
                    placeType: 'Other',
                    image: `https://picsum.photos/seed/${Date.now()}/600/400`,
                    visited: false,
                };
                setSearchResult(newTempLocation);
                setSelectedLocationId(newTempLocation.id);
             } else {
                alert(`Could not find a specific location for "${searchQuery}".`);
             }
        }

    } catch (e) {
        console.error("Global search error", e);
        alert("Search failed. Please try again.");
    } finally {
        setIsSearching(false);
    }
  };

  // Fetch places using Overpass API
  const handleSearchArea = async (bounds: any) => {
      setIsSearchingArea(true);
      try {
          const s = bounds.getSouth();
          const w = bounds.getWest();
          const n = bounds.getNorth();
          const e = bounds.getEast();
          
          // Overpass query
          const query = `
            [out:json][timeout:25];
            (
              node["name"]["amenity"~"restaurant|cafe|bar|pub"](${s},${w},${n},${e});
              node["name"]["tourism"~"attraction|viewpoint|museum"](${s},${w},${n},${e});
            );
            out body 20;
          `;

          const response = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: `data=${encodeURIComponent(query)}`
          });
          
          if (!response.ok) {
              throw new Error(`Overpass API Error: ${response.status}`);
          }

          const data = await response.json();
          
          if (data && data.elements) {
              const newSuggestions: Location[] = data.elements
                .filter((el: any) => 
                    // Filter out places already in saved list
                    !locations.some(l => l.name === el.tags.name)
                )
                .map((el: any) => {
                  let type: PlaceType = 'Other';
                  const amenity = el.tags.amenity;
                  const tourism = el.tags.tourism;

                  if (amenity === 'restaurant') type = 'Restaurant';
                  else if (amenity === 'cafe') type = 'Cafe';
                  else if (amenity === 'bar' || amenity === 'pub') type = 'Bar';
                  else if (tourism === 'attraction' || tourism === 'museum') type = 'Activity';

                  return {
                      id: `sugg-${el.id}`,
                      name: el.tags.name,
                      coordinate: { lat: el.lat, lng: el.lon },
                      description: 'Found nearby. Click to view details or add to your list.',
                      category: 'Hidden Gem', // Default assumption
                      placeType: type,
                      image: `https://picsum.photos/seed/${el.id}/600/400`,
                      visited: false
                  } as Location;
              });
              
              setSuggestedLocations(newSuggestions);
              if (newSuggestions.length === 0) {
                  console.log("No new places found here.");
              }
          }
      } catch (error) {
          console.error("Overpass API error", error);
      } finally {
          setIsSearchingArea(false);
      }
  };

  const handleAddSearchResult = (location: Location) => {
      handleAddLocation({
          name: location.name,
          description: location.description,
          category: location.category,
          placeType: location.placeType,
          coordinate: location.coordinate,
          image: location.image,
          visited: false,
          address: location.address
      });
  };

  const handleMapClick = (coordinate: Coordinate) => {
    setDraftLocation({ coordinate });
    setIsAddModalOpen(true);
  };

  const handleAddFromChat = (place: Partial<Location>) => {
    setDraftLocation(place);
    setIsAddModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setDraftLocation(null); 
    setIsAddModalOpen(true);
  };

  // Determine which location object to pass to LocationCard
  const selectedLocation = 
    locations.find(l => l.id === selectedLocationId) || 
    suggestedLocations.find(l => l.id === selectedLocationId) ||
    (selectedLocationId === 'temp-search-result' ? searchResult : null);

  const isSelectedLocationSaved = selectedLocation ? locations.some(l => l.id === selectedLocation.id) : false;

  return (
    <div className="w-full h-full relative overflow-hidden bg-zinc-950">
      {/* Map Background */}
      <div className="absolute inset-0 z-0">
        <MapBoard 
          locations={filteredLocations}
          suggestedLocations={suggestedLocations}
          selectedLocationId={selectedLocationId}
          onMarkerClick={handleLocationSelect}
          onCenterChange={setCurrentMapCenter}
          onMapClick={handleMapClick}
          onSearchArea={handleSearchArea}
          isSearchingArea={isSearchingArea}
          searchResult={searchResult}
        />
      </div>

      {/* UI Overlays */}
      
      {/* Search Bar */}
      <div className="relative z-[1000]">
          <SearchBar 
            value={searchQuery} 
            onChange={setSearchQuery}
            onSearch={handleGlobalSearch}
            onSelectResult={handleSuggestionSelect}
          />
          {isSearching && (
              <div className="absolute top-4 right-8 text-zinc-400">
                  <Loader2 className="animate-spin" size={20} />
              </div>
          )}
      </div>

      {/* Action Buttons Container */}
      <div className="absolute bottom-8 right-6 z-[1000] flex flex-col gap-4">
        {/* List View Button */}
        <button
          onClick={() => setIsListOpen(true)}
          className="group relative flex items-center justify-center w-14 h-14 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-full shadow-lg hover:bg-zinc-800 transition-all active:scale-95"
          title="My List"
        >
           <List size={24} />
        </button>

        {/* Chat Button */}
        <button
          onClick={() => setIsChatOpen(true)}
          className="group relative flex items-center justify-center w-14 h-14 bg-zinc-900 border border-zinc-700 text-sky-400 rounded-full shadow-lg hover:bg-zinc-800 transition-all active:scale-95"
          title="Ask AI Assistant"
        >
           <MessageSquare size={24} />
        </button>

        {/* Add Button */}
        <button
          onClick={handleOpenAddModal}
          className="group relative flex items-center justify-center w-14 h-14 bg-white text-black rounded-full shadow-lg hover:bg-zinc-200 transition-all active:scale-95"
          title="Add Location"
        >
          <div className="absolute -inset-1 bg-white/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
          <Plus size={28} />
        </button>
      </div>

      {/* Bottom Sheet / Location Details */}
      <LocationCard 
        location={selectedLocation} 
        onClose={() => setSelectedLocationId(null)} 
        onToggleVisited={handleToggleVisited}
        onAdd={handleAddSearchResult}
        onRemove={handleRemoveLocation}
        isSaved={isSelectedLocationSaved}
      />

      {/* Add Location Modal */}
      <AddLocationModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddLocation}
        currentCenter={currentMapCenter}
        prefillData={draftLocation}
      />

      {/* AI Chat Modal */}
      <AIChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onAddPlace={handleAddFromChat}
      />

      {/* List View Drawer */}
      <ListView 
        isOpen={isListOpen}
        onClose={() => setIsListOpen(false)}
        locations={locations}
        onToggleVisited={handleToggleVisited}
        onSelectLocation={(loc) => {
            handleLocationSelect(loc);
            setIsListOpen(false);
        }}
        onReorder={handleReorder}
        onRemove={handleRemoveLocation}
      />
    </div>
  );
};

export default App;