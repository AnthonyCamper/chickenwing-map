<script lang="ts">
    import { onMount, afterUpdate } from 'svelte';
  
    export let wingRatings: any[];
    export let onMarkerClick: (rating: any) => void;
    export let isSlideoutOpen: boolean;
  
    let map: any;
    let mapElement: HTMLElement;
  
    onMount(async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
  
      map = L.map(mapElement).setView([0, 0], 2);
  
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
  
      const customIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });
  
      wingRatings.forEach(rating => {
        L.marker([rating.latitude, rating.longitude], { icon: customIcon })
          .addTo(map)
          .bindPopup(`
            <b>${rating.restaurant_name}</b><br>
            Rating: ${rating.rating}/10<br>
            ${rating.address}<br>
          `)
          .on('click', () => onMarkerClick(rating));
      });
  
      map.fitBounds(wingRatings.map(r => [r.latitude, r.longitude]));
    });
  
    afterUpdate(() => {
      if (map) {
        map.invalidateSize();
      }
    });
  </script>
  
  <div bind:this={mapElement} class="absolute inset-0 z-10 transition-all duration-300 ease-in-out" class:pr-80={isSlideoutOpen}></div>