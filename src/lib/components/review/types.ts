export interface ReviewBasicInfo {
  restaurantName: string;
  address: string;
  dateVisited: string;
  websiteUrl: string;
  coordinates: { latitude: number; longitude: number } | null;
  error: string;
}

export interface ReviewExperienceDetails {
  moodComparison: number | null;
  beerInfluence: boolean | null;
  isTakeout: boolean | null;
  wingsPerOrder: number | null;
  wingSize: number | null;
  wingFormat: string | null;
  takeoutContainer: string | null;
  takeoutWaitTime: number | null;
}

export interface ReviewSauceDetails {
  sauceAvailability: boolean | null;
  selectedSauces: string[];
}

export interface ReviewRatings {
  appearance: number | null;
  aroma: number | null;
  sauceQuantity: number | null;
  sauceConsistency: number | null;
  sauceHeat: number | null;
  skinConsistency: number | null;
  meatQuality: number | null;
  greasiness: number | null;
  blueCheeseQuality: number | null;
  blueCheeseNA: boolean;
  satisfactionScore: number | null;
  recommendationScore: number | null;
}

export interface RatingDescription {
  [key: number]: string;
}

export interface RatingDescriptions {
  appearance: RatingDescription;
  sauceHeat: RatingDescription;
  meatQuality: RatingDescription;
  recommendationScore: RatingDescription;
}

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
  location: Location;
  distance?: number;
  upvotes_count: number;
  downvotes_count: number;
  votes?: Vote[];
  website_url: string | null;
  experience_details: ReviewExperienceDetails | null;
  sauce_details: ReviewSauceDetails | null;
  ratings: ReviewRatings | null;
}
