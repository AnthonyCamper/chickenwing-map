export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName?: string;
}

export interface GeocodeError {
  type: 'network' | 'no_results' | 'invalid_response' | 'rate_limit';
  message: string;
}

export async function geocode(query: string): Promise<{ result: GeocodeResult | null; error: GeocodeError | null }> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      if (response.status === 429) {
        return {
          result: null,
          error: { type: 'rate_limit', message: 'Too many requests. Please try again in a moment.' }
        };
      }
      if (response.status === 503) {
        return {
          result: null,
          error: { type: 'network', message: 'Location service is temporarily unavailable. Please try again later.' }
        };
      }
      return {
        result: null,
        error: { type: 'network', message: 'Unable to connect to location service. Please check your internet connection.' }
      };
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const firstResult = data[0];
      return {
        result: {
          latitude: parseFloat(firstResult.lat),
          longitude: parseFloat(firstResult.lon),
          displayName: firstResult.display_name
        },
        error: null
      };
    } else {
      return {
        result: null,
        error: { type: 'no_results', message: `No location found for "${query}". Try being more specific or checking the spelling.` }
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    return {
      result: null,
      error: { type: 'network', message: 'Network error occurred while searching for location. Please try again.' }
    };
  }
}