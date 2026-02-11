import React, { useState, useEffect } from 'react';
import { Location, PlaceType, Category } from '../types';
import { X, CheckCircle2, Circle, MapPin, Utensils, Coffee, Martini, Ticket, HelpCircle, GripVertical, Filter, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';

interface ListViewProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onToggleVisited: (id: string) => void;
  onSelectLocation: (location: Location) => void;
  onReorder: (locations: Location[]) => void;
  onRemove: (id: string) => void;
}

const TypeIcon = ({ type }: { type: PlaceType }) => {
  switch (type) {
    case 'Restaurant': return <Utensils size={14} className="text-orange-400" />;
    case 'Cafe': return <Coffee size={14} className="text-amber-400" />;
    case 'Bar': return <Martini size={14} className="text-purple-400" />;
    case 'Activity': return <Ticket size={14} className="text-sky-400" />;
    default: return <HelpCircle size={14} className="text-zinc-400" />;
  }
};

interface ListItemContentProps {
  location: Location;
  onSelectLocation: (l: Location) => void;
  onRemove: (id: string) => void;
}

const ListItemContent: React.FC<ListItemContentProps> = ({ location, onSelectLocation, onRemove }) => (
  <>
    <div 
      className="flex-1 cursor-pointer"
      onClick={() => onSelectLocation(location)}
    >
      <div className="font-medium text-zinc-200 group-hover:text-white transition-colors">
        {location.name}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="flex items-center gap-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700">
            <TypeIcon type={location.placeType} />
            {location.placeType}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
          location.category === 'Hidden Gem' 
          ? 'border-emerald-500/30 text-emerald-400/80' 
          : 'border-rose-500/30 text-rose-400/80'
        }`}>
          {location.category === 'Hidden Gem' ? 'Gem' : 'Trap'}
        </span>
      </div>
    </div>

    <button 
      onClick={(e) => { e.stopPropagation(); onSelectLocation(location); }}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      className="p-2 text-zinc-600 hover:text-sky-400 transition-colors relative z-10"
      title="View on Map"
    >
      <MapPin size={16} />
    </button>

    <button 
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        // Defer removal slightly to ensure events clear
        setTimeout(() => onRemove(location.id), 0);
      }}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
      className="p-2 text-zinc-600 hover:text-rose-400 transition-colors relative z-10"
      title="Remove"
    >
      <Trash2 size={16} />
    </button>
  </>
);

interface SortableLocationItemProps {
  location: Location;
  onToggleVisited: (id: string) => void;
  onSelectLocation: (l: Location) => void;
  onRemove: (id: string) => void;
}

const SortableLocationItem: React.FC<SortableLocationItemProps> = ({ location, onToggleVisited, onSelectLocation, onRemove }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item 
      value={location}
      dragListener={false} 
      dragControls={dragControls}
      className="group flex items-center gap-3 p-3 rounded-xl bg-zinc-950 hover:bg-zinc-900 transition-colors border border-transparent hover:border-zinc-800 cursor-default"
      onPointerDown={(e) => e.stopPropagation()} 
    >
      <div 
        className="text-zinc-700 hover:text-zinc-500 cursor-grab active:cursor-grabbing p-1 touch-none"
        onPointerDown={(e) => {
            e.preventDefault(); 
            dragControls.start(e);
        }}
      >
        <GripVertical size={16} />
      </div>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisited(location.id);
        }}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        className="text-zinc-600 hover:text-emerald-500 transition-colors relative z-10"
      >
        <Circle size={20} />
      </button>
      
      <ListItemContent location={location} onSelectLocation={onSelectLocation} onRemove={onRemove} />
    </Reorder.Item>
  );
};

export const ListView: React.FC<ListViewProps> = ({ isOpen, onClose, locations, onToggleVisited, onSelectLocation, onReorder, onRemove }) => {
  const [activeTypes, setActiveTypes] = useState<PlaceType[]>([]);
  const [activeCategories, setActiveCategories] = useState<Category[]>([]);

  // Explicit cleanup of body styles to prevent stuck cursors
  useEffect(() => {
    if (!isOpen) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    }
  }, [isOpen]);

  const toVisit = locations.filter(l => !l.visited);
  const visited = locations.filter(l => l.visited);

  const toggleType = (type: PlaceType) => {
    setActiveTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const toggleCategory = (cat: Category) => {
    setActiveCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const isFiltered = activeTypes.length > 0 || activeCategories.length > 0;

  const displayToVisit = toVisit.filter(l => {
     if (activeTypes.length > 0 && !activeTypes.includes(l.placeType)) return false;
     if (activeCategories.length > 0 && !activeCategories.includes(l.category)) return false;
     return true;
  });

  const handleReorder = (newOrder: Location[]) => {
      if (!isFiltered) {
          const newLocations = [...newOrder, ...visited];
          onReorder(newLocations);
      }
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop with pointerEvents: none on exit to prevent blocking */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 z-[1500] backdrop-blur-sm"
          />
          
          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-y-0 right-0 z-[1600] w-full max-w-sm bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className="text-xl font-bold text-white">Your Itinerary</h2>
              <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Filter Section */}
            <div className="px-6 py-4 border-b border-zinc-800/50 overflow-x-auto whitespace-nowrap scrollbar-hide">
              <div className="flex items-center gap-2">
                 <div className="flex items-center gap-1 text-zinc-500 mr-2">
                    <Filter size={14} />
                    <span className="text-xs font-bold uppercase">Filters</span>
                 </div>
                 
                 {(['Hidden Gem', 'Tourist Trap'] as Category[]).map(cat => (
                    <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-medium border transition-all ${
                            activeCategories.includes(cat)
                            ? cat === 'Hidden Gem' 
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' 
                                : 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                        }`}
                    >
                        {cat}
                    </button>
                 ))}

                 <div className="w-px h-4 bg-zinc-800 mx-1"></div>

                 {(['Restaurant', 'Bar', 'Cafe', 'Activity', 'Other'] as PlaceType[]).map(type => (
                    <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-medium border transition-all ${
                            activeTypes.includes(type)
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                        }`}
                    >
                        {type}
                    </button>
                 ))}
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-8">
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pl-2 pr-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">To Visit ({displayToVisit.length})</h3>
                    {isFiltered && <span className="text-[10px] text-zinc-600 italic">Reorder disabled while filtering</span>}
                </div>
                
                {displayToVisit.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 text-sm italic">
                    {isFiltered ? "No places match filters." : "All caught up! Add more places."}
                  </div>
                ) : isFiltered ? (
                    displayToVisit.map(location => (
                        <div 
                          key={location.id}
                          className="group flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-900 transition-colors border border-transparent hover:border-zinc-800"
                        >
                          <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleVisited(location.id);
                              }}
                              className="text-zinc-600 hover:text-emerald-500 transition-colors"
                          >
                              <Circle size={20} />
                          </button>
                          <ListItemContent location={location} onSelectLocation={onSelectLocation} onRemove={onRemove} />
                        </div>
                    ))
                ) : (
                    <Reorder.Group axis="y" values={displayToVisit} onReorder={handleReorder} className="space-y-2">
                        {displayToVisit.map(location => (
                            <SortableLocationItem 
                              key={location.id}
                              location={location}
                              onToggleVisited={onToggleVisited}
                              onSelectLocation={onSelectLocation}
                              onRemove={onRemove}
                            />
                        ))}
                    </Reorder.Group>
                )}
              </div>

              {visited.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 pl-2">visited ({visited.length})</h3>
                  {visited.map(location => (
                    <div 
                      key={location.id}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-zinc-900/30 border border-transparent opacity-60 hover:opacity-100 transition-all"
                    >
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleVisited(location.id);
                        }}
                        className="text-emerald-500 hover:text-emerald-400 transition-colors"
                      >
                        <CheckCircle2 size={20} />
                      </button>
                      
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => onSelectLocation(location)}
                      >
                        <div className="font-medium text-zinc-200 line-through decoration-zinc-600">
                          {location.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-500">{location.placeType}</span>
                        </div>
                      </div>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setTimeout(() => onRemove(location.id), 0);
                        }}
                        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                        className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};