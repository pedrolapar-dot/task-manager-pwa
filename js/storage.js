const KEY = 'tmw_items';

export const storage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  save(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
  },

  clear() {
    localStorage.removeItem(KEY);
  }
};
