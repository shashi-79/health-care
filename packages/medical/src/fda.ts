const BASE_URL = "https://api.fda.gov/drug/label.json";

export async function fetchDrugData(query: string, limit = 5) {
  const search = encodeURIComponent(query);
  const url = `${BASE_URL}?search=${search}&limit=${limit}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`openFDA request failed: ${res.status}`);
  }

  const data = await res.json();
  return data?.results ?? [];
}
