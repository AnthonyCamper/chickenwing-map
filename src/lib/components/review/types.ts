export interface ReviewBasicInfo {
  restaurantName: string;
  address: string;
  dateVisited: string;
  websiteUrl: string;
  coordinates: { latitude: number; longitude: number } | null;
  error: string;
}

export interface ReviewExperienceDetails {
  moodComparison: number;
  beerInfluence: boolean;
  isTakeout: boolean;
  wingsPerOrder: number;
  wingSize: number;
  wingFormat: string;
  takeoutContainer: string;
  takeoutWaitTime: number;
}

export interface ReviewSauceDetails {
  sauceAvailability: boolean;
  selectedSauces: string[];
}

export interface ReviewRatings {
  appearance: number;
  aroma: number;
  sauceQuantity: number;
  sauceConsistency: number;
  sauceHeat: number;
  skinConsistency: number;
  meatQuality: number;
  greasiness: number;
  blueCheeseQuality: number;
  blueCheeseNA: boolean;
  satisfactionScore: number;
  recommendationScore: number;
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
