let listeners: (() => void)[] = [];

export const tripEvents = {
  emit: () => {
    listeners.forEach(fn => fn());
  },
  subscribe: (fn: () => void) => {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter(l => l !== fn);
    };
  },
};
