import { Location } from './types';

export const INITIAL_VIEW_STATE = {
  center: { lat: 1.3521, lng: 103.8198 }, // Center of Singapore
  zoom: 12,
};

export const MOCK_LOCATIONS: Location[] = [
  {
    id: '1',
    name: 'Lazarus Island',
    coordinate: { lat: 1.226, lng: 103.855 },
    description: 'A tranquil beach getaway just a short ferry ride from the city. Perfect for picnics and escaping the crowds.',
    category: 'Hidden Gem',
    placeType: 'Activity',
    image: 'https://picsum.photos/seed/lazarus/600/400',
    visited: false,
  },
  {
    id: '2',
    name: 'Merlion Park',
    coordinate: { lat: 1.2868, lng: 103.8545 },
    description: 'The iconic symbol of Singapore. Extremely crowded with tourists trying to get the perfect water-spout selfie.',
    category: 'Tourist Trap',
    placeType: 'Activity',
    image: 'https://picsum.photos/seed/merlion/600/400',
    visited: true,
  },
  {
    id: '3',
    name: 'Tiong Bahru Bakery',
    coordinate: { lat: 1.2874, lng: 103.8324 },
    description: 'Famous for croissants, but retains a lovely neighborhood vibe despite its popularity. Great coffee.',
    category: 'Hidden Gem',
    placeType: 'Cafe',
    image: 'https://picsum.photos/seed/tiongbahru/600/400',
    visited: false,
  },
  {
    id: '4',
    name: 'Gardens by the Bay',
    coordinate: { lat: 1.2816, lng: 103.8636 },
    description: 'Futuristic park featuring Supertree Grove. Spectacular, but expect massive crowds and expensive entry fees for domes.',
    category: 'Tourist Trap',
    placeType: 'Activity',
    image: 'https://picsum.photos/seed/gardens/600/400',
    visited: false,
  },
  {
    id: '5',
    name: 'Haji Lane',
    coordinate: { lat: 1.3007, lng: 103.8577 },
    description: 'Narrow lane filled with vibrant street art, indie boutiques, and hip cafes. Lively atmosphere at night.',
    category: 'Hidden Gem',
    placeType: 'Activity',
    image: 'https://picsum.photos/seed/haji/600/400',
    visited: true,
  },
];

// Standard OpenStreetMap tiles (we will invert colors in CSS for dark mode)
export const DARK_MAP_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';