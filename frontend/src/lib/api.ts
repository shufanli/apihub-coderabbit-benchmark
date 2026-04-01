const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/apihubcoderabbit";

export async function apiFetch(path: string, options?: RequestInit) {
  const url = `${BASE_PATH}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}
