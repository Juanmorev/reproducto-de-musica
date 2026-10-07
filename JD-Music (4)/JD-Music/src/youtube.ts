import type { OnlineResult } from "./online";

// ---- Search (YouTube Data API v3, needs a free API key) ----
interface SearchItem { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { medium?: { url: string }; default?: { url: string } } } }
const decode = (s: string) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; };
function seconds(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}

export async function searchYouTube(query: string, key: string): Promise<OnlineResult[]> {
  const base = "https://www.googleapis.com/youtube/v3";
  const res = await fetch(`${base}/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=20&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null;
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    throw new Error(reason === "quotaExceeded" ? "youtube-quota" : reason === "accessNotConfigured" || reason === "forbidden" ? "youtube-api" : "youtube-key");
  }
  const items = ((await res.json()) as { items: SearchItem[] }).items.filter((i) => i.id?.videoId);
  const durations = new Map<string, number>();
  if (items.length) {
    const d = await fetch(`${base}/videos?part=contentDetails&id=${items.map((i) => i.id.videoId).join(",")}&key=${encodeURIComponent(key)}`);
    if (d.ok) ((await d.json()) as { items: { id: string; contentDetails: { duration: string } }[] }).items.forEach((v) => durations.set(v.id, seconds(v.contentDetails.duration)));
  }
  return items.map((i) => ({
    id: i.id.videoId, source: "youtube" as const, title: decode(i.snippet.title),
    artist: decode(i.snippet.channelTitle).replace(/ - Topic$/, ""),
    cover: i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? "", url: i.id.videoId, duration: durations.get(i.id.videoId) ?? 0,
  }));
}

// ---- Playback: an adapter that looks like an <audio> element but drives the YouTube IFrame Player ----
interface YTPlayer {
  loadVideoById(id: string): void; playVideo(): void; pauseVideo(): void; stopVideo(): void; seekTo(s: number, allow: boolean): void;
  getCurrentTime(): number; getDuration(): number; setVolume(v: number): void; mute(): void; unMute(): void;
}
interface YTWindow {
  YT?: { Player: new (el: string, o: { width: string; height: string; playerVars: Record<string, number>; events: { onReady(e: { target: YTPlayer }): void; onStateChange(e: { data: number }): void; onError(e: { data: number }): void } }) => unknown };
  onYouTubeIframeAPIReady?: () => void;
}

export class YouTubeAudio extends EventTarget {
  private id = "";
  private pending = false;
  private announced = false;
  private state = -1;
  private timer = 0;
  private vol = 0.8;
  private mute = false;
  private p: YTPlayer | null = null;
  private ready: Promise<YTPlayer> | null = null;

  get src() { return this.id; }
  set src(v: string) { this.id = v; this.pending = true; this.announced = false; }
  get paused() { return this.state !== 1 && this.state !== 3; }
  get ended() { return this.state === 0; }
  get duration() { const d = this.p?.getDuration() ?? 0; return d > 0 ? d : NaN; }
  get currentTime() { return this.p?.getCurrentTime() ?? 0; }
  set currentTime(v: number) { this.p?.seekTo(v, true); }
  get volume() { return this.vol; }
  set volume(v: number) { this.vol = v; this.p?.setVolume(v * 100); }
  get muted() { return this.mute; }
  set muted(v: boolean) { this.mute = v; if (v) this.p?.mute(); else this.p?.unMute(); }

  play(): Promise<void> {
    this.ensure().then((p) => {
      if (this.pending) { this.pending = false; p.loadVideoById(this.id); } else p.playVideo();
    }).catch(() => this.dispatchEvent(new CustomEvent("error", { detail: -1 })));
    return Promise.resolve();
  }
  pause() { this.p?.pauseVideo(); }
  removeAttribute() { this.id = ""; this.pending = false; this.p?.stopVideo(); }
  load() { /* nothing to preload */ }

  private ensure(): Promise<YTPlayer> {
    if (this.ready) return this.ready;
    this.ready = new Promise<YTPlayer>((resolve, reject) => {
      const w = window as unknown as YTWindow;
      const make = () => {
        new (w.YT as NonNullable<YTWindow["YT"]>).Player("yt-holder", {
          width: "100%", height: "100%", playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: (e) => { this.p = e.target; e.target.setVolume(this.vol * 100); if (this.mute) e.target.mute(); resolve(e.target); },
            onStateChange: (e) => this.onState(e.data),
            onError: (e) => this.dispatchEvent(new CustomEvent("error", { detail: e.data })),
          },
        });
      };
      if (w.YT?.Player) { make(); return; }
      w.onYouTubeIframeAPIReady = make;
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => { this.ready = null; reject(new Error("youtube-script")); };
      document.head.appendChild(s);
    });
    return this.ready;
  }

  private onState(s: number) {
    this.state = s;
    window.clearInterval(this.timer);
    if (s === 1) {
      if (!this.announced) { this.announced = true; this.dispatchEvent(new Event("loadedmetadata")); }
      this.dispatchEvent(new Event("play"));
      this.timer = window.setInterval(() => this.dispatchEvent(new Event("timeupdate")), 300);
    } else if (s === 2 || s === 0) {
      this.dispatchEvent(new Event("pause"));
      if (s === 0) this.dispatchEvent(new Event("ended"));
    }
  }
}
