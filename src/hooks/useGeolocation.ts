import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface GeoLocation {
  lat: number;
  lng: number;
}

interface UseGeolocationReturn {
  location: GeoLocation | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => void;
}

/**
 * Calculates distance between two lat/lng points using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(a: GeoLocation, b: GeoLocation): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

/**
 * Reverse geocodes coordinates into a city name using OpenStreetMap.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // Note: In production, use a more robust service or cache results to respect Nominatim's usage policy
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await res.json();
    return data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || null;
  } catch (err) {
    console.error('Reverse geocoding error:', err);
    return null;
  }
}

/**
 * Custom hook for user geolocation.
 * On mount, requests the user's position and watches for updates.
 * Optionally stores location in Firestore `users/{uid}`.
 */
export function useGeolocation(userId?: string | null): UseGeolocationReturn {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSyncRef = useRef<number>(0);

  const syncToFirestore = useCallback(
    async (loc: GeoLocation) => {
      if (!userId) return;
      const now = Date.now();
      // Only sync every 30 seconds to avoid excessive writes
      if (now - lastSyncRef.current < 30000) return;
      lastSyncRef.current = now;

      try {
        const cityName = await reverseGeocode(loc.lat, loc.lng);

        await setDoc(
          doc(db, 'users', userId),
          {
            location: loc,
            city: cityName,
            locationUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (cityName) {
          // Register city in the global cities collection
          await setDoc(doc(db, 'cities', cityName.toLowerCase()), {
            name: cityName,
            lastActivity: serverTimestamp(),
          }, { merge: true });
        }
      } catch (err) {
        console.error('Error syncing location to Firestore:', err);
      }
    },
    [userId]
  );

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(loc);
        setLoading(false);
        syncToFirestore(loc);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(
          err.code === 1
            ? 'Location access denied. Please enable location permissions.'
            : err.code === 2
            ? 'Location unavailable. Please try again.'
            : 'Location request timed out.'
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    // Watch for updates
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setLocation(loc);
        setLoading(false);
        syncToFirestore(loc);
      },
      () => {}, // Silently handle watch errors
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
  }, [syncToFirestore]);

  useEffect(() => {
    requestLocation();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [requestLocation]);

  return { location, loading, error, requestLocation };
}

export default useGeolocation;
