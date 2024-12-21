import { writable, type Writable } from 'svelte/store';

export const isDarkMode: Writable<boolean> = writable(
  typeof window !== 'undefined' ? localStorage.getItem('darkMode') === 'true' : false
);

isDarkMode.subscribe((value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('darkMode', value.toString());
    if (value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
});
