<script lang="ts">
    import { onMount } from 'svelte';
  
    export let wingRatings: any[];
  
    let map: any;
  
    onMount(async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
  
      map = L.map('map').setView([0, 0], 2);
  
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
  
      wingRatings.forEach(rating => {
        L.marker([rating.latitude, rating.longitude])
          .addTo(map)
          .bindPopup(`
            <b>${rating.restaurant_name}</b><br>
            Rating: ${rating.rating}/5<br>
            ${rating.address}<br>
            <a href="#" class="show-review" data-id="${rating.id}">Show Review</a>
          `);
      });
  
      map.fitBounds(wingRatings.map(r => [r.latitude, r.longitude]));
    });
  </script>
  
  <div id="map" class="h-[600px] w-full"></div>
  