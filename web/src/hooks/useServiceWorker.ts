'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdated: boolean;
  isOffline: boolean;
  registration: ServiceWorkerRegistration | null;
}

interface UseServiceWorkerReturn extends ServiceWorkerState {
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  update: () => Promise<void>;
  clearCache: () => Promise<void>;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdated: false,
    isOffline: !navigator.onLine,
    registration: null,
  });

  // Check if service workers are supported
  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator;
    setState((prev) => ({ ...prev, isSupported }));

    if (!isSupported) return;

    // Check for online/offline status
    const handleOnline = () => setState((prev) => ({ ...prev, isOffline: false }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker
    navigator.serviceWorker.ready.then((registration) => {
      setState((prev) => ({
        ...prev,
        isRegistered: true,
        registration,
      }));

      // Check for updates
      registration.addEventListener('updatefound', () => {
        setState((prev) => ({ ...prev, isUpdated: true }));
      });
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker
  const register = useCallback(async () => {
    if (!state.isSupported) return;

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('Service Worker registered:', registration);

      setState((prev) => ({
        ...prev,
        isRegistered: true,
        registration,
      }));
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }, [state.isSupported]);

  // Unregister service worker
  const unregister = useCallback(async () => {
    if (!state.registration) return;

    try {
      const unregistered = await state.registration.unregister();
      console.log('Service Worker unregistered:', unregistered);

      setState((prev) => ({
        ...prev,
        isRegistered: !unregistered,
        registration: null,
      }));
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
    }
  }, [state.registration]);

  // Update service worker
  const update = useCallback(async () => {
    if (!state.registration) return;

    try {
      await state.registration.update();
      console.log('Service Worker updated');

      setState((prev) => ({ ...prev, isUpdated: false }));
    } catch (error) {
      console.error('Service Worker update failed:', error);
    }
  }, [state.registration]);

  // Clear all caches
  const clearCache = useCallback(async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('Cache cleared');

      setState((prev) => ({ ...prev, isUpdated: true }));
    } catch (error) {
      console.error('Cache clear failed:', error);
    }
  }, []);

  return {
    ...state,
    register,
    unregister,
    update,
    clearCache,
  };
}

// Hook for offline data sync
export function useOfflineData<T>(key: string, fetchFn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { isOffline } = useServiceWorker();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to get from cache first
        const cached = await caches.match(`/api/data/${key}`);
        if (cached) {
          const cachedData = await cached.json();
          setData(cachedData);
        }

        // If online, fetch fresh data
        if (!isOffline) {
          const freshData = await fetchFn();
          setData(freshData);

          // Update cache
          const cache = await caches.open('prepx-data-cache');
          cache.put(`/api/data/${key}`, new Response(JSON.stringify(freshData)));
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [key, fetchFn, isOffline]);

  const saveOffline = useCallback(async (data: T) => {
    setData(data);

    // Save to cache
    const cache = await caches.open('prepx-data-cache');
    cache.put(`/api/data/${key}`, new Response(JSON.stringify(data)));

    // Save to IndexedDB for offline storage
    await saveToIndexedDB(key, data);
  }, [key]);

  return { data, isLoading, error, isOffline, saveOffline };
}

// IndexedDB helpers
const DB_NAME = 'prepx-offline';
const DB_VERSION = 1;

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
    };
  });
}

async function saveToIndexedDB(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('data', 'readwrite');
    const store = transaction.objectStore('data');

    const request = store.put({ key, data, timestamp: Date.now() });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getFromIndexedDB<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('data', 'readonly');
    const store = transaction.objectStore('data');

    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.data : null);
    };
  });
}

// Hook for cache storage info
export function useCacheStorage() {
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [cacheCount, setCacheCount] = useState<number>(0);

  useEffect(() => {
    const updateCacheInfo = async () => {
      try {
        const cacheNames = await caches.keys();
        let totalSize = 0;
        let totalCount = 0;

        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          totalCount += keys.length;

          for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
              const blob = await response.blob();
              totalSize += blob.size;
            }
          }
        }

        setCacheSize(totalSize);
        setCacheCount(totalCount);
      } catch (error) {
        console.error('Error getting cache info:', error);
      }
    };

    updateCacheInfo();
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return {
    cacheSize: formatSize(cacheSize),
    cacheCount,
    rawSize: cacheSize,
  };
}
