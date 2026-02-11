import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Location, Coordinate } from '../types';
import { DARK_MAP_URL, MAP_ATTRIBUTION, INITIAL_VIEW_STATE } from '../constants';
import { Loader2, Search } from 'lucide-react';
import { motion } from 'framer-motion';

// Fix for default Leaflet marker icons in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '',
  iconUrl: '',
  shadowUrl: '',
});

interface MapBoardProps {
  locations: Location[];
  suggestedLocations?: Location[];
  onMarkerClick: (location: Location) => void;
  onCenterChange: (center: Coordinate) => void;
  onMapClick?: (coordinate: Coordinate) => void;
  onSearchArea?: (bounds: any) => void;
  isSearchingArea?: boolean;
  selectedLocationId: string | null;
  searchResult: Location | null;
}

// Component to handle map center updates and search button visibility
const MapInteractivity = ({ 
  onCenterChange, 
  onSearchArea, 
  isSearching 
}: { 
  onCenterChange: (c: Coordinate) => void,
  onSearchArea?: (bounds: any) => void,
  isSearching?: boolean
}) => {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
      setShowSearch(true);
    },
    zoomend: () => {
        setShowSearch(true);
    }
  });

  const [showSearch, setShowSearch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide button when searching starts
  useEffect(() => {
      if(isSearching) setShowSearch(false);
  }, [isSearching]);

  // Leaflet specific propagation stopping
  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  });

  if (!onSearchArea || !showSearch) return null;

  // Robust event stopper for React + Leaflet hybrid environment
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    // @ts-ignore
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
         e.nativeEvent.stopImmediatePropagation();
    }
  };

  return (
    <div 
        ref={containerRef} 
        className="absolute top-24 left-1/2 -translate-x-1/2 z-[400]"
        onMouseDown={stopPropagation}
        onMouseUp={stopPropagation}
        onClick={stopPropagation}
        onDoubleClick={stopPropagation}
        onTouchStart={stopPropagation}
    >
        <motion.button
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
                stopPropagation(e);
                onSearchArea(map.getBounds());
                setShowSearch(false);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 rounded-full shadow-xl font-bold text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
        >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search this area
        </motion.button>
    </div>
  );
};

// Component to handle map clicks for adding new locations
const MapClickHandler = ({ onMapClick }: { onMapClick: (c: Coordinate) => void }) => {
  useMapEvents({
    click: (e) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

// Component to fix map rendering issues on load
const MapStartup = () => {
  const map = useMap();
  useEffect(() => {
    // Slight delay to ensure container is fully rendered
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Component to fly to selected location or search result
const LocationFlyTo = ({ location, searchResult }: { location: Location | null, searchResult: Location | null }) => {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.coordinate.lat, location.coordinate.lng], 15, {
        duration: 1.5,
      });
    } else if (searchResult) {
      map.flyTo([searchResult.coordinate.lat, searchResult.coordinate.lng], 15, {
        duration: 1.5,
      });
    }
  }, [location, searchResult, map]);
  return null;
};

const createCustomIcon = (category: string, isSelected: boolean, isSuggestion: boolean = false) => {
  // Suggestions are smaller dots
  if (isSuggestion) {
      const size = isSelected ? 30 : 20;
      return L.divIcon({
          html: `
            <div class="relative flex items-center justify-center transition-all duration-300 hover:scale-125">
              <div class="w-${size/4} h-${size/4} bg-white rounded-full shadow-lg border-2 border-zinc-900 ${isSelected ? 'bg-sky-400 scale-150' : ''}"></div>
              <div class="absolute -bottom-1 w-1 h-1 bg-black/50 rounded-full blur-[1px]"></div>
            </div>
          `,
          className: 'bg-transparent border-none flex items-center justify-center',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
      });
  }

  const emoji = category === 'Hidden Gem' ? '💎' : category === 'Tourist Trap' ? '📸' : '📍';
  const size = isSelected ? 40 : 32;
  
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center transition-all duration-300 transform hover:scale-110" style="width: ${size}px; height: ${size}px;">
        <div class="absolute inset-0 bg-black/50 rounded-full blur-sm"></div>
        <div class="relative z-10 text-[${size}px] leading-none drop-shadow-md filter select-none">
          ${emoji}
        </div>
        ${isSelected ? '<div class="absolute -bottom-2 w-2 h-2 bg-white rounded-full animate-bounce"></div>' : ''}
      </div>
    `,
    className: 'bg-transparent border-none',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export const MapBoard: React.FC<MapBoardProps> = ({ 
    locations, 
    suggestedLocations = [],
    onMarkerClick, 
    onCenterChange, 
    onMapClick, 
    onSearchArea,
    isSearchingArea,
    selectedLocationId, 
    searchResult 
}) => {
  const selectedLocation = 
    locations.find(l => l.id === selectedLocationId) || 
    suggestedLocations.find(l => l.id === selectedLocationId);

  return (
    <MapContainer
      center={[INITIAL_VIEW_STATE.center.lat, INITIAL_VIEW_STATE.center.lng]}
      zoom={INITIAL_VIEW_STATE.zoom}
      zoomControl={false}
      className="w-full h-full bg-zinc-950"
      style={{ background: '#09090b' }} 
    >
      <MapStartup />
      <TileLayer
        attribution={MAP_ATTRIBUTION}
        url={DARK_MAP_URL}
        className="dark-tiles" // Applies the CSS invert filter
      />
      
      <MapInteractivity 
        onCenterChange={onCenterChange} 
        onSearchArea={onSearchArea} 
        isSearching={isSearchingArea}
      />

      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      <LocationFlyTo location={selectedLocation} searchResult={searchResult} />

      {/* Suggested Locations (Small dots) */}
      {suggestedLocations.map((location) => (
        <Marker
          key={location.id}
          position={[location.coordinate.lat, location.coordinate.lng]}
          icon={createCustomIcon(location.category, location.id === selectedLocationId, true)}
          eventHandlers={{
            click: () => onMarkerClick(location),
          }}
          opacity={0.8}
        />
      ))}

      {/* Saved Locations (Main icons) */}
      {locations.map((location) => (
        <Marker
          key={location.id}
          position={[location.coordinate.lat, location.coordinate.lng]}
          icon={createCustomIcon(location.category, location.id === selectedLocationId)}
          eventHandlers={{
            click: () => onMarkerClick(location),
          }}
          zIndexOffset={100} // Saved items always on top
        />
      ))}

      {/* Temporary Search Result */}
      {searchResult && (
        <Marker
            key="search-result"
            position={[searchResult.coordinate.lat, searchResult.coordinate.lng]}
            icon={createCustomIcon('Search', searchResult.id === selectedLocationId)}
            eventHandlers={{
                click: () => onMarkerClick(searchResult)
            }}
            zIndexOffset={100}
        />
      )}
    </MapContainer>
  );
};