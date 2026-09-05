const BASE_URL = "http://127.0.0.1:8000";

export async function fetchDensity() {
  const res = await fetch(`${BASE_URL}/api/regions/density`);
  if (!res.ok) throw new Error("density fetch failed");
  return res.json();
}

export async function searchPersons(text, filterOverrides = {}) {
  const res = await fetch(`${BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...filterOverrides }),
  });
  if (!res.ok) throw new Error("search failed");
  return res.json();
}

export async function fetchPerson(personId) {
  const res = await fetch(`${BASE_URL}/api/persons/${personId}`);
  if (!res.ok) throw new Error("person fetch failed");
  return res.json();
}

export function cropUrl(personId) {
  return `${BASE_URL}/api/persons/${personId}/crop`;
}
