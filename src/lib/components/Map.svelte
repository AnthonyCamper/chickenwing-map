<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import type { Review, Location } from './review/types';
  import type { LeafletEvent } from 'leaflet';

  export let reviews: Review[];
  export let onMarkerClick: (review: Review) => void;
  export let isSlideoutOpen: boolean;
  export let userLocation: { latitude: number; longitude: number } | null;

  let map: any;
  let mapElement: HTMLElement;
  let L: any;
  let markers: any[] = [];
  let searchMarker: any;
  let wingIcon: any;
  let searchIcon: any;

  onMount(async () => {
    console.log("Mount started");
    try {
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      console.log("Leaflet imported successfully");
      initializeMap();
    } catch (error) {
      console.error("Error importing Leaflet:", error);
    }
  });

  export function zoomToLocation(latitude: number, longitude: number, locationName: string) {
    if (map) {
      map.setView([latitude, longitude], 12);  // Adjust zoom level as needed
      if (searchMarker) {
        map.removeLayer(searchMarker);
      }
      searchMarker = L.marker([latitude, longitude], { icon: searchIcon })
        .addTo(map)
        .bindPopup(`Searched: ${locationName}`)
        .openPopup();
    }
  }
  
  function initializeMap() {
    console.log("Initializing map");
    if (!mapElement) {
      console.error("Map element not found");
      return;
    }

    try {
      map = L.map(mapElement).setView([0, 0], 2);
      console.log("Map created successfully");

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      wingIcon = L.icon({
        iconUrl: '/assets/wing-icon.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      // Create a different icon for search markers
      searchIcon = L.divIcon({
        className: 'search-marker',
        html: '<div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" /></svg></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });

      console.log("Tile layer added");

      addMarkers();
      fitMapToBounds();
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  }

  function addMarkers() {
    console.log("Adding markers");
    if (!map || !L) {
      console.error("Map or Leaflet not initialized");
      return;
    }

    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Group reviews by location to show all reviews for a location in one popup
    const locationReviews = reviews.reduce((acc, review) => {
      const loc = review.location;
      if (!acc[loc.id]) {
        acc[loc.id] = {
          location: loc,
          reviews: []
        };
      }
      acc[loc.id].reviews.push(review);
      return acc;
    }, {} as Record<number, { location: Location; reviews: Review[] }>);

    Object.values(locationReviews).forEach(({ location, reviews: locationReviews }) => {
      if (isValidCoordinate(location.latitude, location.longitude)) {
        const avgRating = (locationReviews.reduce((sum, r) => sum + parseFloat(r.rating), 0) / locationReviews.length).toFixed(1);
        // Create custom popup element
        const popupContent = document.createElement('div');
        popupContent.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[220px] border border-gray-200 dark:border-gray-700';
        popupContent.innerHTML = `
          <div class="p-3">
            <div class="font-medium text-gray-900 dark:text-white text-[15px] mb-2">${location.restaurant_name}</div>
            <div class="flex items-center gap-3">
              <div class="flex items-center">
                <span class="text-[16px] font-bold text-gray-900 dark:text-white">${avgRating}</span>
                <svg class="w-4 h-4 text-yellow-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
              </div>
              <span class="text-[13px] text-gray-600 dark:text-gray-400">${locationReviews.length} reviews</span>
            </div>
          </div>
        `;

        const customPopup = L.popup({
          closeButton: false,
          className: 'custom-popup',
          offset: [0, -10],
          maxWidth: 300
        }).setContent(popupContent);

        const marker = L.marker([location.latitude, location.longitude], { icon: wingIcon })
          .addTo(map)
          .on('click', (e: LeafletEvent) => {
            // Close any other open popups
            markers.forEach(m => m.closePopup());
            
            // Open this marker's popup
            marker.bindPopup(customPopup).openPopup();
            
            // Find the most recent review for this location
            const mostRecentReview = locationReviews.reduce((latest, current) => {
              const latestDate = new Date(latest.date_visited);
              const currentDate = new Date(current.date_visited);
              return currentDate > latestDate ? current : latest;
            }, locationReviews[0]);

            // Add click event to popup content
            popupContent.onclick = () => {
              handleMarkerClick(mostRecentReview);
            };
          });
        markers.push(marker);
      } else {
        console.warn(`Invalid coordinates for location: ${location.restaurant_name}`);
      }
    });
    console.log(`Added ${markers.length} markers`);
  }

  function handleMarkerClick(review: Review) {
    onMarkerClick(review);
    // Pan to the marker
    map.panTo([review.location.latitude, review.location.longitude]);
  }

  function isValidCoordinate(lat: any, lng: any) {
    return typeof lat === 'number' && 
           typeof lng === 'number' && 
           !isNaN(lat) && 
           !isNaN(lng) && 
           lat >= -90 && 
           lat <= 90 && 
           lng >= -180 && 
           lng <= 180;
  }

  afterUpdate(() => {
    console.log("After update");
    if (map) {
      map.invalidateSize();
      addMarkers();
    }
  });

  $: if (map && isSlideoutOpen !== undefined) {
    console.log("Slideout state changed, invalidating map size");
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }

  function fitMapToBounds() {
    console.log("Fitting map to bounds");
    if (map && L && reviews.length > 0) {
      const validCoordinates = reviews
        .filter(r => isValidCoordinate(r.location.latitude, r.location.longitude))
        .map(r => [r.location.latitude, r.location.longitude]);

      if (validCoordinates.length > 0) {
        const bounds = L.latLngBounds(validCoordinates);
        map.fitBounds(bounds);
        console.log("Map fitted to bounds");
      } else {
        console.warn("No valid coordinates to fit bounds");
      }
    }
  }

  function zoomToNearbyPlaces() {
    console.log("Zooming to nearby places");
    if (map && L && userLocation) {
      const nearbyReviews = reviews.filter(review => 
        review.distance && 
        review.distance <= 10 && 
        isValidCoordinate(review.location.latitude, review.location.longitude)
      );

      if (nearbyReviews.length > 0) {
        const bounds = L.latLngBounds([
          [userLocation.latitude, userLocation.longitude],
          ...nearbyReviews.map(r => [r.location.latitude, r.location.longitude])
        ]);
        map.fitBounds(bounds);
        console.log("Zoomed to nearby places");
      } else {
        map.setView([userLocation.latitude, userLocation.longitude], 12);
        console.log("No nearby places, centered on user location");
      }
    }
  }
</script>

<style>
  :global(.search-marker) {
    background: transparent;
    border: none;
  }

  :global(.custom-popup .leaflet-popup-content-wrapper) {
    padding: 0;
    border-radius: 0.75rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    overflow: hidden;
    transform: translateY(-2px);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  :global(.custom-popup .leaflet-popup-content) {
    margin: 0;
    min-width: 220px;
  }

  :global(.custom-popup .leaflet-popup-tip-container) {
    display: none;
  }

  :global(.custom-popup:hover .leaflet-popup-content-wrapper) {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  /* Mobile optimization */
  @media (max-width: 640px) {
    :global(.custom-popup .leaflet-popup-content) {
      min-width: 200px;
    }
    :global(.custom-popup .leaflet-popup-content-wrapper) {
      margin-top: -5px;
    }
  }
</style>

<div class="relative w-full h-full">
  <div bind:this={mapElement} class="absolute inset-0 transition-all duration-300 ease-in-out" class:pr-0={!isSlideoutOpen} class:pr-80={isSlideoutOpen}></div>
  <button
    on:click={zoomToNearbyPlaces}
    class="absolute top-4 left-4 z-[1000] bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
  >
    Zoom to Nearby Places
  </button>
</div>
