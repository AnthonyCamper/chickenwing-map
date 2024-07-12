<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';

  export let wingRatings: any[];
  export let onMarkerClick: (rating: any) => void;
  export let isSlideoutOpen: boolean;
  export let userLocation: { latitude: number; longitude: number } | null;

  let map: any;
  let mapElement: HTMLElement;
  let L: any;
  let markers: any[] = [];
  let searchMarker: any;

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
      // Remove previous search marker if exists
      if (searchMarker) {
        map.removeLayer(searchMarker);
      }
      // Add a marker for the searched location
      searchMarker = L.marker([latitude, longitude])
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

    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    const wingIcon = L.icon({
      iconUrl: '/assets/wing-icon.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    wingRatings.forEach(rating => {
      if (isValidCoordinate(rating.latitude, rating.longitude)) {
        const marker = L.marker([rating.latitude, rating.longitude], { icon: wingIcon })
          .addTo(map)
          .bindPopup(`
            <b>${rating.restaurant_name}</b><br>
            Rating: ${rating.rating}/10<br>
            ${rating.address}<br>
            ${rating.distance !== undefined ? `Distance: ${rating.distance.toFixed(2)} km<br>` : ''}
          `)
          .on('click', () => onMarkerClick(rating));
        markers.push(marker);
      } else {
        console.warn(`Invalid coordinates for rating: ${rating.restaurant_name}`);
      }
    });
    console.log(`Added ${markers.length} markers`);
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
      fitMapToBounds();
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
    if (map && L && wingRatings.length > 0) {
      const validCoordinates = wingRatings
        .filter(r => isValidCoordinate(r.latitude, r.longitude))
        .map(r => [r.latitude, r.longitude]);

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
      const nearbyRatings = wingRatings.filter(rating => 
        rating.distance && 
        rating.distance <= 10 && 
        isValidCoordinate(rating.latitude, rating.longitude)
      );

      if (nearbyRatings.length > 0) {
        const bounds = L.latLngBounds([
          [userLocation.latitude, userLocation.longitude],
          ...nearbyRatings.map(r => [r.latitude, r.longitude])
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

<div class="relative w-full h-full">
  <div bind:this={mapElement} class="absolute inset-0 transition-all duration-300 ease-in-out" class:pr-0={!isSlideoutOpen} class:pr-80={isSlideoutOpen}></div>
  <button
    on:click={zoomToNearbyPlaces}
    class="absolute top-4 left-4 z-[1000] bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded shadow hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
  >
    Zoom to Nearby Places
  </button>
</div>