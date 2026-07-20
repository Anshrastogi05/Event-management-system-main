import { API_BASE_URL } from '../config/network.js';

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

function normalizeLocationPayload(payload = {}) {
  return {
    city: String(payload.city || "").trim(),
    region: String(payload.regionName || payload.region || "").trim(),
    country: String(payload.country || "").trim(),
    ip: String(payload.ip || payload.query || "").trim(),
    source: String(payload.source || "ip-api").trim(),
    method: String(payload.method || payload.source || "ip-api").trim(),
    lat:
      typeof payload.lat === "number" && Number.isFinite(payload.lat)
        ? payload.lat
        : null,
    lng:
      typeof payload.lng === "number" && Number.isFinite(payload.lng)
        ? payload.lng
        : null,
  };
}

function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Browser location is not supported here."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        reject(
          new Error(
            error?.message || "Unable to access your browser location.",
          ),
        );
      },
      GEOLOCATION_OPTIONS,
    );
  });
}

async function fetchReverseGeocodedLocation(lat, lng) {
  const backendEndpoint = `${API_BASE_URL}/api/location/reverse?lat=${encodeURIComponent(
    lat,
  )}&lng=${encodeURIComponent(lng)}`;

  const response = await fetch(backendEndpoint, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ message: "Unable to resolve your current location." }));
    throw new Error(
      errorPayload.message || "Unable to resolve your current location.",
    );
  }

  const data = await response.json();
  return normalizeLocationPayload({
    ...data,
    lat,
    lng,
    method: "browser",
  });
}

async function fetchBackendIpLocation() {
  const backendEndpoint = `${API_BASE_URL}/api/location/current`;

  try {
    const response = await fetch(backendEndpoint, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorPayload = await response
        .json()
        .catch(() => ({ message: "Unable to detect your current city." }));
      throw new Error(errorPayload.message || "Unable to detect your current city.");
    }

    const data = await response.json();
    return normalizeLocationPayload(data);
  } catch {
    throw new Error("Unable to detect your current city.");
  }
}

export async function fetchCurrentLocation() {
  try {
    const position = await getBrowserPosition();
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    return fetchReverseGeocodedLocation(latitude, longitude);
  } catch (browserError) {
    try {
      return await fetchBackendIpLocation();
    } catch (backendError) {
      throw browserError?.message?.includes("supported")
        ? backendError
        : browserError || backendError;
    }
  }
}

export async function fetchCurrentIpLocation() {
  return fetchCurrentLocation();
}
