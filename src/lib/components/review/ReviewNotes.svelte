<script lang="ts">
  export let reviewNotes: string;
</script>

<div>
  <label for="reviewNotes" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Additional Notes
  </label>
  <textarea
    id="reviewNotes"
    bind:value={reviewNotes}
    rows="4"
    class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
    placeholder="Enter any additional notes about your experience"
  ></textarea>
</div>
