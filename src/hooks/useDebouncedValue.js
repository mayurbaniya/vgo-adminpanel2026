import { useEffect, useState } from 'react';

// Returns `value` after it has been stable for `delay` ms. Used for search
// inputs so we don't fire a request on every keystroke.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
