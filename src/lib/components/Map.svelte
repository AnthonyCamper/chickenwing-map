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
        popupContent.className = 'bg-white dark:bg-gray-800 p-2 rounded shadow-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';
        popupContent.innerHTML = `
          <div class="text-sm">
            <div class="font-bold text-gray-900 dark:text-white">${location.restaurant_name}</div>
            <div class="text-gray-600 dark:text-gray-300">Reviews: ${locationReviews.length}</div>
          </div>
        `;

        const customPopup = L.popup({
          closeButton: false,
          className: 'custom-popup',
          offset: [0, -20]
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

  :global(.custom-popup) {
    margin-bottom: 5px;
  }

  :global(.custom-popup .leaflet-popup-content-wrapper) {
    padding: 0;
    border-radius: 0.375rem;
  }

  :global(.custom-popup .leaflet-popup-content) {
    margin: 0;
  }

  :global(.custom-popup .leaflet-popup-tip) {
    display: none;
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
