/**
 * Centralized CrowdSense API Client Module
 * Provides unified communication with FastAPI backend endpoints.
 */

const BASE_URL = "http://127.0.0.1:8000";

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API error on ${endpoint}:`, err);
    throw err;
  }
}

export async function getOverview() {
  return request("/api/overview");
}

export async function getDensity() {
  return request("/api/regions/density");
}

export async function getDensityHistory(limit = 30) {
  return request(`/api/density/history?limit=${limit}`);
}

export async function getPeople(text = "", filterOverrides = {}) {
  return request("/api/search", {
    method: "POST",
    body: JSON.stringify({ text, ...filterOverrides }),
  });
}

export async function getPeopleSummary() {
  return request("/api/people/summary");
}

export async function getPerson(personId) {
  return request(`/api/persons/${personId}`);
}

export function cropUrl(personId) {
  return `${BASE_URL}/api/persons/${personId}/crop`;
}

export async function getHealth() {
  return request("/api/health");
}

// Backward-compatible aliases
export const fetchDensity = getDensity;
export const searchPersons = getPeople;
export const fetchPerson = getPerson;
