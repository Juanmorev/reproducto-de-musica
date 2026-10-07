// Online music search.
// - With a free Jamendo Client ID: FULL-LENGTH songs (Creative Commons independent music).
// - Without it: iTunes Search API (no key), which only offers 30-second previews.
export interface OnlineResult {
  id: string; source: "jamendo" | "itunes" | "youtube"; title: string; artist: string; cover: string; url: string; duration: number;
}

interface ItunesItem { trackId: number; trackName: string; artistName: string; artworkUrl100?: string; previewUrl?: string }
interface JamendoItem { id: string; name: string; artist_name: string; image?: string; audio?: string; duration: number }

function jsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `jd_cb_${Date.now()}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const done = () => { delete w[name]; script.remove(); };
    w[name] = (data: T) => { done(); resolve(data); };
    script.onerror = () => { done(); reject(new Error("JSONP failed")); };
    script.src = `${url}&callback=${name}`;
    document.head.appendChild(script);
  });
}

async function getJson<T>(url: string): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return jsonp<T>(url); // fallback when CORS is unavailable
  }
}

export async function searchOnline(query: string, jamendoId = ""): Promise<OnlineResult[]> {
  const q = encodeURIComponent(query);
  if (jamendoId) {
    const data = await getJson<{ headers: { status: string }; results: JamendoItem[] }>(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(jamendoId)}&format=json&limit=25&audioformat=mp32&imagesize=200&type=single+albumtrack&search=${q}`);
    if (data.headers.status !== "success") throw new Error("jamendo-key");
    return data.results.filter((r) => r.audio).map((r) => ({
      id: r.id, source: "jamendo" as const, title: r.name, artist: r.artist_name, cover: r.image ?? "", url: r.audio as string, duration: r.duration,
    }));
  }
  const data = await getJson<{ results: ItunesItem[] }>(`https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${q}`);
  return data.results.filter((r) => r.previewUrl).map((r) => ({
    id: String(r.trackId), source: "itunes" as const, title: r.trackName, artist: r.artistName,
    cover: (r.artworkUrl100 ?? "").replace("100x100", "200x200"), url: r.previewUrl as string, duration: 30,
  }));
}
