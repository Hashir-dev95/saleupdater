import { isLanguage, type Language } from './index';

export const LANGUAGE_STORAGE_KEY = '@SalesUpdater:language';
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
type Snapshot = { language: Language; isReady: boolean; saveError: boolean };

export function createLanguageStore(storage: Storage) {
  let snapshot: Snapshot = { language: 'en', isReady: false, saveError: false };
  const listeners = new Set<() => void>();
  let hydration: Promise<void> | undefined;
  let writes = Promise.resolve();
  let revision = 0;
  function update(patch: Partial<Snapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate() {
      if (!hydration) {
        const initialRevision = revision;
        hydration = storage.getItem(LANGUAGE_STORAGE_KEY)
          .then(saved => { if (revision === initialRevision && isLanguage(saved)) update({ language: saved }); })
          .catch(() => undefined)
          .finally(() => update({ isReady: true }));
      }
      return hydration;
    },
    setLanguage(language: Language) {
      const currentRevision = ++revision;
      update({ language, saveError: false });
      // Serialize rapid taps so an older write cannot overwrite the latest choice.
      writes = writes.then(() => storage.setItem(LANGUAGE_STORAGE_KEY, language))
        .catch(() => { if (revision === currentRevision) update({ saveError: true }); });
      return writes;
    },
  };
}
