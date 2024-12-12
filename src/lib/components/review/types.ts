export interface Location {
  id: number;
  restaurant_name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Vote {
  vote_type: 'up' | 'down';
  user_id: string;
}

export interface Review {
  id: number;
  location_id: number;
  user_id: string;
  review: string;
  rating: string;
  date_visited: string;
  location?: Location;
  distance?: number;
  upvotes_count: number;
  downvotes_count: number;
  votes?: Vote[];
}
