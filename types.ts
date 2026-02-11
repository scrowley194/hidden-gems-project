export type Category = 'Hidden Gem' | 'Tourist Trap';

export type PlaceType = 'Restaurant' | 'Bar' | 'Cafe' | 'Activity' | 'Other';

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Location {
  id: string;
  name: string;
  coordinate: Coordinate;
  description: string;
  category: Category;
  placeType: PlaceType;
  image: string;
  address?: string; // Optional address field for geocoding accuracy
  visited?: boolean;
  rating?: number; // Optional manual rating
}

export interface MapViewState {
  center: Coordinate;
  zoom: number;
}