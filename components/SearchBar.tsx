import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';

export interface SearchSuggestion {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  address?: any;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onSelectResult: (result: SearchSuggestion) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onSearch, onSelectResult }) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close suggestions if clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Restrict to Singapore (sg) and ask for address details to get cleaner names
      // Nominatim supports queries like "coffee tanjong pagar" fairly well
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=sg&addressdetails=1&limit=5`
      );
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 400); // 400ms debounce
  };

  const handleSelect = (suggestion: SearchSuggestion) => {
    onSelectResult(suggestion);
    setShowSuggestions(false);
    // Extract a cleaner name for the input field if possible
    const mainName = suggestion.address?.amenity || suggestion.address?.building || suggestion.address?.shop || suggestion.address?.tourism || suggestion.display_name.split(',')[0];
    onChange(mainName || suggestion.display_name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    onSearch();
  };

  const handleClear = () => {
      onChange('');
      setSuggestions([]);
      setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="absolute top-4 left-4 right-4 z-[1000] max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
             <Loader2 className="h-5 w-5 text-sky-400 animate-spin" />
          ) : (
             <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-sky-400 transition-colors" />
          )}
        </div>
        
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
              if(suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder="Search places (e.g. 'Coffee Tanjong Pagar')..."
          className="block w-full pl-10 pr-10 py-3 border border-zinc-700 rounded-2xl leading-5 bg-zinc-900/90 backdrop-blur-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 sm:text-sm shadow-xl transition-all duration-300"
        />

        {value && (
             <button
                type="button"
                onClick={handleClear}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
             >
                 <X size={16} />
             </button>
        )}
        
        {/* Hidden submit button to enable Enter key */}
        <button type="submit" className="hidden" />
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="max-h-60 overflow-y-auto py-1">
            {suggestions.map((suggestion) => {
                // Try to format a nice primary and secondary text
                const name = suggestion.address?.amenity || suggestion.address?.building || suggestion.address?.shop || suggestion.address?.tourism || suggestion.display_name.split(',')[0];
                const details = suggestion.display_name.replace(name, '').replace(/^,\s*/, '');
                
                return (
                    <li key={suggestion.place_id}>
                        <button
                        type="button"
                        onClick={() => handleSelect(suggestion)}
                        className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors flex items-start gap-3 group"
                        >
                        <MapPin className="h-5 w-5 text-zinc-500 group-hover:text-sky-400 shrink-0 mt-0.5 transition-colors" />
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-200 truncate group-hover:text-white">
                                {name}
                            </div>
                            <div className="text-xs text-zinc-500 truncate group-hover:text-zinc-400">
                                {details || suggestion.display_name}
                            </div>
                        </div>
                        </button>
                    </li>
                );
            })}
          </ul>
          <div className="px-4 py-2 bg-zinc-950/50 border-t border-zinc-800 text-[10px] text-zinc-500 flex justify-between">
             <span>Select an option or press Enter for AI Search</span>
          </div>
        </div>
      )}
    </div>
  );
};