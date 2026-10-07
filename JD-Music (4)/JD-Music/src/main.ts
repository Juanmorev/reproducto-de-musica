import { DoublyLinkedList, Node } from "./DoublyLinkedList";
import { searchOnline, type OnlineResult } from "./online";
import { YouTubeAudio, searchYouTube } from "./youtube";

interface Track { id: string; title: string; artist: string; cover: string | null; key: string; kind: "local" | "stream" | "youtube"; url: string; duration: number }
interface Playlist { id: string; name: string; songs: DoublyLinkedList<Track> }

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const icon = (d: string) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">${d}</svg>`;
const ICON = {
  play: icon('<path d="M8 5v14l11-7z"/>'), pause: icon('<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'),
  prev: icon('<path d="M6 5h2v14H6zM20 5v14L9 12z"/>'), next: icon('<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>'),
  vol: icon('<path d="M3 10v4h4l5 4V6L7 10zM15 8a5 5 0 0 1 0 8z"/>'), muted: icon('<path d="M3 10v4h4l5 4V6L7 10zM16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" fill="none"/>'),
  shuffle: icon('<path d="M17 3l4 4-4 4V8h-2.6l-3.1 4.2L8.9 16H4v-2h3.9l2.5-3.3L7.9 8H4V6h4.9l2.4 3.2L13.8 6H17zM17 13l4 4-4 4v-3h-3.1l-2-2.7 1.2-1.6L14.6 16H17z"/>'),
  repeat: icon('<path d="M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2z"/>'),
  repeatOne: icon('<path d="M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2z"/><path d="M11 9h1.500v6H11v-4.200l-1 .4V10z"/>'),
  heart: icon('<path d="M12 21s-7.500-4.600-9.500-9.200C1.200 8 3.600 4.500 7 4.500c2 0 3.600 1.100 5 2.900 1.400-1.800 3-2.900 5-2.900 3.400 0 5.800 3.500 4.500 7.300C19.500 16.400 12 21 12 21z"/>'),
  heartO: icon('<path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7.500-4.600-9.500-9.200C1.200 8 3.600 4.500 7 4.500c2 0 3.600 1.100 5 2.900 1.400-1.800 3-2.900 5-2.900 3.400 0 5.800 3.500 4.500 7.300C19.500 16.400 12 21 12 21z"/>'),
  up: icon('<path d="M7 14l5-5 5 5z"/>'), down: icon('<path d="M7 10l5 5 5-5z"/>'), del: icon('<path d="M6 7h12l-1 13H7zM9 4h6v2H9z"/>'),
};

const localAudio = new Audio();   // local files (object URLs)
const streamAudio = new Audio();  // online streams
const yt = new YouTubeAudio();    // YouTube IFrame player wrapped as an audio-like element
const ytAudio = yt as unknown as HTMLAudioElement;
let audio: HTMLAudioElement = localAudio; // element used by the current node
localAudio.volume = streamAudio.volume = ytAudio.volume = 0.8;
const on = (ev: string, fn: () => void) => [localAudio, streamAudio, ytAudio].forEach((a) => a.addEventListener(ev, fn));
const playlists: Playlist[] = [];
let uid = 0;
let viewId = "";
let playingId = "";
let dragFrom = -1;
let query = "";
const LS = "jd-music-data-v2";
const FAV = "fav";
// IndexedDB: keeps the uploaded audio files so they survive a page reload
const idb = new Promise<IDBDatabase | null>((resolve) => {
  try {
    const r = indexedDB.open("jd-music", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  } catch { resolve(null); }
});
async function putFile(key: string, f: Blob) { const db = await idb; if (db) db.transaction("files", "readwrite").objectStore("files").put(f, key); }
async function delFile(key: string) { const db = await idb; if (db) db.transaction("files", "readwrite").objectStore("files").delete(key); }
async function getFile(key: string): Promise<Blob | null> {
  const db = await idb;
  if (!db) return null;
  return new Promise((resolve) => {
    const q = db.transaction("files").objectStore("files").get(key);
    q.onsuccess = () => resolve((q.result as Blob | undefined) ?? null);
    q.onerror = () => resolve(null);
  });
}
let shuffle = false;
let repeat: "off" | "all" | "one" = "off";
const history: Node<Track>[] = []; // previously played nodes, used by "Previous" in shuffle mode

const newId = (p: string) => `${p}-${++uid}`;
const view = () => playlists.find((p) => p.id === viewId)!;
const playingList = () => playlists.find((p) => p.id === playingId);
const fav = () => playlists.find((p) => p.id === FAV)!;
const isFav = (t: Track) => fav().songs.indexOf((x) => x.id === t.id) >= 0;
const inAnyList = (t: Track) => playlists.some((p) => p.songs.indexOf((x) => x.id === t.id) >= 0);
const inAnyKey = (t: Track) => playlists.some((p) => p.songs.indexOf((x) => x.key === t.key) >= 0);
const newList = () => { const l = new DoublyLinkedList<Track>(); l.circular = true; return l; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const jsmediatags: { read(f: File, cb: { onSuccess(r: any): void; onError(e: unknown): void }): void };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const cover = (t: Track | null) => {
  if (t?.cover) return `background:url('${t.cover}') center/cover`;
  const h = t ? hue(t.title) : 250;
  return `background:linear-gradient(135deg,hsl(${h} 70% 82%),hsl(${(h + 50) % 360} 75% 88%))`;
};

function createPlaylist(name: string) {
  const pl: Playlist = { id: newId("pl"), name: name.trim() || `Lista ${playlists.length + 1}`, songs: newList() };
  playlists.push(pl);
  viewId = pl.id;
}

function toggleFav(t: Track) {
  if (!fav().songs.removeById((x) => x.id === t.id)) fav().songs.append(t);
  render();
}
function deleteList(id: string) {
  const pl = playlists.find((p) => p.id === id);
  if (id === FAV || !pl || !confirm(`¿Eliminar la lista “${pl.name}”?`)) return;
  playlists.splice(playlists.indexOf(pl), 1);
  if (playingId === id) { playingId = ""; stop(); }
  for (const t of pl.songs) { if (!inAnyList(t)) URL.revokeObjectURL(t.url); if (!inAnyKey(t)) void delFile(t.key); }
  if (!playlists.some((p) => p.id !== FAV)) createPlaylist("Mi lista");
  if (viewId === id) viewId = playlists.find((p) => p.id !== FAV)!.id;
  render();
}
function readTags(file: File, track: Track) {
  try {
    jsmediatags.read(file, {
      onSuccess: (r) => {
        const tg = r.tags;
        if (tg.title) track.title = String(tg.title);
        if (tg.artist) track.artist = String(tg.artist);
        if (tg.picture) track.cover = URL.createObjectURL(new Blob([new Uint8Array(tg.picture.data)], { type: tg.picture.format }));
        render();
      },
      onError: () => { /* sin etiquetas ID3 */ },
    });
  } catch { /* librería no disponible */ }
}
function playable(s: DoublyLinkedList<Track>, n: Node<Track> | null, step: "next" | "prev") {
  for (let k = 0; n && !n.value.url && k < s.size; k++) { s.current = n; n = s[step](); }
  return n && n.value.url ? n : null;
}
function save() {
  try {
    const all = new Map<string, Track>();
    playlists.forEach((p) => { for (const t of p.songs) all.set(t.id, t); });
    localStorage.setItem(LS, JSON.stringify({
      tracks: [...all.values()].map((t) => ({ id: t.id, key: t.key, kind: t.kind, title: t.title, artist: t.artist, duration: t.duration, ...(t.kind !== "local" ? { url: t.url, cover: t.cover } : {}) })),
      lists: playlists.filter((p) => p.id !== FAV).map((p) => ({ name: p.name, ids: p.songs.toArray().map((t) => t.id) })),
      favs: fav().songs.toArray().map((t) => t.id),
    }));
  } catch { /* almacenamiento no disponible */ }
}
function playNode(pl: Playlist, node: Node<Track>) {
  if (!node.value.url) return;
  if (node.value.kind === "local") initViz();
  const el = node.value.kind === "youtube" ? ytAudio : node.value.kind === "stream" ? streamAudio : localAudio;
  if (el !== audio) { audio.pause(); audio = el; }
  document.body.classList.toggle("yt-active", el === ytAudio);
  playingId = pl.id;
  pl.songs.current = node;
  audio.src = node.value.url;
  audio.play().catch(() => {});
  render();
}
function stop() { audio.pause(); audio.removeAttribute("src"); audio.load(); }
function goNext(auto = false) {
  const pl = playingList() ?? view();
  const s = pl.songs;
  if (!s.size) return;
  if (auto && repeat === "one" && s.current) { playNode(pl, s.current); return; }
  if (auto && repeat === "off" && !shuffle && s.current === s.tail) { render(); return; }
  if (s.current) { history.push(s.current); if (history.length > 100) history.shift(); }
  let n: Node<Track> | null;
  if (shuffle && s.size > 1) {
    let i: number;
    do { i = Math.floor(Math.random() * s.size); } while (s.getNode(i) === s.current);
    n = s.getNode(i);
  } else {
    n = s.next() ?? (repeat === "all" ? s.head : null);
  }
  n = playable(s, n, "next");
  if (n) playNode(pl, n); else { history.pop(); render(); }
}
function goPrev() {
  const pl = playingList() ?? view();
  const s = pl.songs;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  let n: Node<Track> | null = null;
  while (shuffle && history.length && !n) {
    const h = history.pop()!;
    if (s.indexOfNode(h) >= 0) n = h;
  }
  if (!n) n = s.prev() ?? (repeat === "all" ? s.tail : null);
  n = playable(s, n, "prev");
  if (n) playNode(pl, n);
}
function togglePlay() {
  if (!audio.src) { const pl = view(); const n = pl.songs.current ?? pl.songs.head; if (n) playNode(pl, n); return; }
  audio.paused ? audio.play() : audio.pause();
}

function addFiles(files: FileList) {
  const pl = view();
  const mode = $<HTMLSelectElement>("#mode").value;
  const anchor = pl.songs.current ? pl.songs.indexOfNode(pl.songs.current) : -1;
  let at = mode === "after" && anchor >= 0 ? anchor + 1 : -1;
  for (const f of Array.from(files)) {
    const key = `${f.name}|${f.size}`;
    const restored = fav().songs.find((t) => t.key === key && !t.url)?.value;
    const track: Track = restored ?? { id: newId("tr"), title: f.name.replace(/\.[^.]+$/, ""), artist: "Artista desconocido", cover: null, key, kind: "local", url: "", duration: 0 };
    track.url = URL.createObjectURL(f);
    readTags(f, track);
    void putFile(key, f);
    if (mode === "start") pl.songs.prepend(track);
    else if (at >= 0) pl.songs.insertAt(at++, track);
    else pl.songs.append(track);
    const probe = new Audio(track.url);
    probe.addEventListener("loadedmetadata", () => { track.duration = probe.duration; render(); });
  }
  render();
}

function removeAt(index: number) {
  const pl = view();
  const node = pl.songs.getNode(index);
  if (!node) return;
  const wasPlaying = pl.id === playingId && pl.songs.current === node;
  const track = pl.songs.removeNode(node);
  if (!inAnyList(track)) URL.revokeObjectURL(track.url);
  if (!inAnyKey(track)) void delFile(track.key);
  if (wasPlaying) { if (pl.songs.current) playNode(pl, pl.songs.current); else stop(); }
  render();
}

function render() {
  const pl = view();
  const cur = playingList()?.songs.current?.value ?? null;
  $("#tabs").innerHTML = playlists.map((p) =>
    `<div class="tab ${p.id === viewId ? "on" : ""}" role="button" tabindex="0" data-pl="${p.id}"><span>${p.id === FAV ? "♥ " : ""}${esc(p.name)}</span><small>${p.songs.size}</small>${p.id === FAV ? "" : `<button class="x" data-del="${p.id}" title="Eliminar lista" aria-label="Eliminar lista">×</button>`}</div>`).join("");
  const shown = pl.songs.current?.value ?? null;
  $("#now").innerHTML = `<div class="art" style="${cover(cur ?? shown)}">${cur ? (cur.cover ? "" : esc(cur.title[0].toUpperCase())) : "♪"}</div>
    <div class="meta"><span class="kicker">${cur ? (audio.paused ? "En pausa" : "Reproduciendo") : "Lista de reproducción"}</span>
    <h2>${esc(pl.name)}</h2>
    <p>${pl.songs.size} ${pl.songs.size === 1 ? "canción" : "canciones"}${cur ? ` · ${esc(cur.title)} – ${esc(cur.artist)}` : ""}</p></div>`;
  const target = $<HTMLSelectElement>("#online-target");
  const prevTarget = target.value;
  target.innerHTML = playlists.map((p) => `<option value="${p.id}">${p.id === FAV ? "♥ " : ""}${esc(p.name)}</option>`).join("");
  target.value = playlists.some((p) => p.id === prevTarget) ? prevTarget : viewId;
  $("#play-all").innerHTML = pl.id === playingId && audio.src && !audio.paused ? ICON.pause : ICON.play;
  $("#list").innerHTML = pl.songs.size
    ? ([...pl.songs].map((t, i) => {
        if (query && !`${t.title} ${t.artist}`.toLowerCase().includes(query)) return "";
        const on = pl.id === playingId && pl.songs.current?.value === t;
        return `<li class="row ${on ? "on" : ""} ${t.url ? "" : "off"}" draggable="true" data-i="${i}">
          <span class="num">${on ? "♪" : i + 1}</span><div class="thumb" style="${cover(t)}"></div>
          <button class="title" data-act="play" data-i="${i}"><span class="tt"><b>${esc(t.title)}</b><em>${t.url ? esc(t.artist) + (t.kind === "youtube" ? " · YouTube" : t.kind === "stream" ? " · En línea" : "") : "Vuelve a subir el archivo para escucharla"}</em></span><small>${fmt(t.duration)}</small></button>
          <div class="acts"><button data-act="fav" data-i="${i}" class="hb ${isFav(t) ? "on" : ""}" title="Me gusta" aria-label="Me gusta">${isFav(t) ? ICON.heart : ICON.heartO}</button><button data-act="up" data-i="${i}" aria-label="Subir" title="Subir una posición" ${i === 0 ? "disabled" : ""}>${ICON.up}</button>
          <button data-act="down" data-i="${i}" aria-label="Bajar" title="Bajar una posición" ${i === pl.songs.size - 1 ? "disabled" : ""}>${ICON.down}</button>
          <button data-act="del" data-i="${i}" aria-label="Eliminar" title="Eliminar canción" class="rm">${ICON.del}</button></div></li>`;
      }).join("") || `<li class="empty">No hay canciones que coincidan con tu búsqueda.</li>`)
    : `<li class="empty">Esta lista está vacía. Toca “Subir canciones” para cargar tus archivos de audio.</li>`;
  $("#bar-title").innerHTML = cur ? `<div class="thumb" style="${cover(cur)}"></div><div class="bt"><b>${esc(cur.title)}</b><small>${esc(cur.artist)}</small></div><button id="bar-fav" class="hb ${isFav(cur) ? "on" : ""}" title="Me gusta" aria-label="Me gusta">${isFav(cur) ? ICON.heart : ICON.heartO}</button>` : `<div class="bt"><small>Ninguna canción seleccionada</small></div>`;
  $("#play").innerHTML = audio.src && !audio.paused ? ICON.pause : ICON.play;
  $("#prev").innerHTML = ICON.prev;
  $("#next").innerHTML = ICON.next;
  $("#shuffle").innerHTML = ICON.shuffle + "<span>Aleatorio</span>";
  $("#shuffle").classList.toggle("on", shuffle);
  $("#shuffle").setAttribute("aria-pressed", String(shuffle));
  $("#repeat").innerHTML = (repeat === "one" ? ICON.repeatOne : ICON.repeat) + "<span>Repetir</span>";
  $("#repeat").classList.toggle("on", repeat !== "off");
  $("#repeat").title = `Repetir: ${{ off: "desactivado", all: "toda la lista", one: "una canción" }[repeat]}`;
  $("#shuffle").title = `Aleatorio: ${shuffle ? "activado" : "desactivado"}`;
  $("#mute").innerHTML = audio.muted || audio.volume === 0 ? ICON.muted : ICON.vol;
  save();
}

// Events
$("#new-pl").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>("#pl-name");
  createPlaylist(input.value);
  input.value = "";
  render();
});
$("#tabs").addEventListener("keydown", (e) => { if (e.key === "Enter") (e.target as HTMLElement).click(); });
$("#tabs").addEventListener("click", (e) => {
  const d = (e.target as HTMLElement).closest<HTMLElement>("[data-del]");
  if (d) { deleteList(d.dataset.del!); return; }
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-pl]");
  if (b) { viewId = b.dataset.pl!; document.body.classList.remove("online-open"); render(); }
});
$<HTMLInputElement>("#files").addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) addFiles(input.files);
  input.value = "";
});
$("#list").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!b) return;
  const i = Number(b.dataset.i);
  const pl = view();
  if (b.dataset.act === "play") { const n = pl.songs.getNode(i); if (n) playNode(pl, n); }
  else if (b.dataset.act === "up") { pl.songs.move(i, i - 1); render(); }
  else if (b.dataset.act === "down") { pl.songs.move(i, i + 1); render(); }
  else if (b.dataset.act === "fav") { const n = pl.songs.getNode(i); if (n) toggleFav(n.value); }
  else removeAt(i);
});
const list = $("#list");
list.addEventListener("dragstart", (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>(".row");
  if (row) { dragFrom = Number(row.dataset.i); row.classList.add("drag"); e.dataTransfer!.effectAllowed = "move"; }
});
list.addEventListener("dragover", (e) => {
  e.preventDefault();
  list.querySelectorAll(".over").forEach((r) => r.classList.remove("over"));
  (e.target as HTMLElement).closest(".row")?.classList.add("over");
});
list.addEventListener("drop", (e) => {
  e.preventDefault();
  const row = (e.target as HTMLElement).closest<HTMLElement>(".row");
  if (row && dragFrom >= 0) view().songs.move(dragFrom, Number(row.dataset.i));
  dragFrom = -1;
  render();
});
list.addEventListener("dragend", () => { dragFrom = -1; render(); });

$("#play").addEventListener("click", togglePlay);
$("#next").addEventListener("click", () => goNext(false));
$("#shuffle").addEventListener("click", () => { shuffle = !shuffle; history.length = 0; render(); });
$("#repeat").addEventListener("click", () => { repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off"; render(); });
$("#prev").addEventListener("click", goPrev);
$("#mute").addEventListener("click", () => { localAudio.muted = streamAudio.muted = ytAudio.muted = !audio.muted; render(); });
$<HTMLInputElement>("#vol").addEventListener("input", (e) => { localAudio.volume = streamAudio.volume = ytAudio.volume = Number((e.target as HTMLInputElement).value); localAudio.muted = streamAudio.muted = ytAudio.muted = false; render(); });
$<HTMLInputElement>("#seek").addEventListener("input", (e) => {
  if (audio.duration) audio.currentTime = (Number((e.target as HTMLInputElement).value) / 1000) * audio.duration;
});
on("timeupdate", () => {
  $("#cur").textContent = fmt(audio.currentTime);
  $<HTMLInputElement>("#seek").value = String(audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0);
});
on("loadedmetadata", () => { $("#dur").textContent = fmt(audio.duration); });
on("play", render);
on("pause", render);
on("ended", () => goNext(true));

$<HTMLInputElement>("#search").addEventListener("input", (e) => { query = (e.target as HTMLInputElement).value.trim().toLowerCase(); render(); });
$("#bar-title").addEventListener("click", (e) => {
  const cur = playingList()?.songs.current;
  if (cur && (e.target as HTMLElement).closest("#bar-fav")) toggleFav(cur.value);
});
// Búsqueda en línea
let results: OnlineResult[] = [];
const setStatus = (t: string) => { $("#online-status").textContent = t; };
function renderOnline() {
  $("#results").innerHTML = results.map((r, i) => `<li class="row res">
    <div class="thumb" style="background:url('${esc(r.cover)}') center/cover"></div>
    <div class="title nolink"><span class="tt"><b>${esc(r.title)}</b><em>${esc(r.artist)}</em></span><small>${fmt(r.duration)}</small></div>
    <div class="acts"><button class="addbtn" data-add="${i}" title="Agregar a la lista" aria-label="Agregar a la lista">+</button></div></li>`).join("");
}
const JID = "jd-jamendo-id";
const CFG = (window as unknown as { JD_CONFIG?: { youtubeKey?: string; jamendoId?: string } }).JD_CONFIG ?? {};
const jamendoId = () => { try { return localStorage.getItem(JID) || CFG.jamendoId || ""; } catch { return CFG.jamendoId || ""; } };
if (CFG.jamendoId) $("#ocfg").hidden = true; // shared key configured: hide the personal-key box
$<HTMLInputElement>("#jamendo-id").value = jamendoId();
$<HTMLDetailsElement>("#ocfg").open = false;
$("#jamendo-save").addEventListener("click", () => {
  const v = $<HTMLInputElement>("#jamendo-id").value.trim();
  try { if (v) localStorage.setItem(JID, v); else localStorage.removeItem(JID); } catch { /* sin almacenamiento */ }
  setStatus(v ? "Clave guardada. Las búsquedas ahora devuelven canciones completas." : "Clave eliminada. Las búsquedas devuelven fragmentos de 30 segundos.");
});
const YID = "jd-youtube-key";
const youtubeKey = () => { try { return localStorage.getItem(YID) || CFG.youtubeKey || ""; } catch { return CFG.youtubeKey || ""; } };
if (CFG.youtubeKey) $("#ycfg").hidden = true;
$<HTMLInputElement>("#youtube-key").value = youtubeKey();
$<HTMLDetailsElement>("#ycfg").open = !youtubeKey();
$<HTMLSelectElement>("#online-source").value = youtubeKey() ? "youtube" : jamendoId() ? "jamendo" : "itunes";
$("#youtube-save").addEventListener("click", () => {
  const v = $<HTMLInputElement>("#youtube-key").value.trim();
  try { if (v) localStorage.setItem(YID, v); else localStorage.removeItem(YID); } catch { /* sin almacenamiento */ }
  if (v) $<HTMLSelectElement>("#online-source").value = "youtube";
  setStatus(v ? "Clave de YouTube guardada. Ya puedes buscar cualquier canción." : "Clave de YouTube eliminada.");
});
const ERR: Record<string, string> = {
  "youtube-nokey": "Primero pega tu clave de la API de YouTube (recuadro de arriba).",
  "youtube-key": "La clave de YouTube no es válida. Revisa que la copiaste completa.",
  "youtube-quota": "Se acabó la cuota diaria gratuita de YouTube. Intenta mañana o usa otra fuente.",
  "youtube-api": "Falta habilitar “YouTube Data API v3” en tu proyecto de Google Cloud.",
  "jamendo-key": "La clave de Jamendo no es válida. Revisa tu Client ID.",
  "jamendo-nokey": "Primero pega tu Client ID de Jamendo (recuadro de abajo).",
};
const errorText = (e: unknown) => (e instanceof Error && ERR[e.message]) || "No se pudo buscar. Revisa tu conexión a internet.";
async function runSearch(q: string): Promise<OnlineResult[]> {
  const src = $<HTMLSelectElement>("#online-source").value;
  if (src === "youtube") { if (!youtubeKey()) throw new Error("youtube-nokey"); return searchYouTube(q, youtubeKey()); }
  if (src === "jamendo" && !jamendoId()) throw new Error("jamendo-nokey");
  return searchOnline(q, src === "jamendo" ? jamendoId() : "");
}
const toast = (m: string) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 7000); };
yt.addEventListener("error", () => toast("No se pudo reproducir este video de YouTube. Puede que el autor no permita incrustarlo, o que abriste la app con doble clic: publícala (Netlify) o usa un servidor local."));
$("#online-toggle").addEventListener("click", () => {
  document.body.classList.toggle("online-open");
  $<HTMLSelectElement>("#online-target").value = viewId;
});
$("#online-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $<HTMLInputElement>("#online-q").value.trim();
  if (!q) return;
  setStatus("Buscando...");
  try {
    results = await runSearch(q);
    const srcName = { youtube: "YouTube", jamendo: "Jamendo (canciones completas)", itunes: "iTunes (fragmentos de 30 segundos)" }[results[0]?.source ?? "itunes"];
    setStatus(results.length ? `${results.length} resultados de ${srcName}.` : "No se encontraron resultados.");
  } catch (err) {
    results = [];
    setStatus(errorText(err));
  }
  renderOnline();
});
$("#results").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-add]");
  if (!b) return;
  const r = results[Number(b.dataset.add)];
  const pl = playlists.find((p) => p.id === $<HTMLSelectElement>("#online-target").value) ?? view();
  const track: Track = { id: newId("tr"), title: r.title, artist: r.artist, cover: r.cover || null, key: `${r.source}|${r.id}`, kind: r.source === "youtube" ? "youtube" : "stream", url: r.url, duration: r.duration };
  const mode = $<HTMLSelectElement>("#online-mode").value;
  const anchor = pl.songs.current ? pl.songs.indexOfNode(pl.songs.current) : -1;
  if (mode === "start") pl.songs.prepend(track);
  else if (mode === "after" && anchor >= 0) pl.songs.insertAt(anchor + 1, track);
  else pl.songs.append(track);
  b.textContent = "✓";
  setStatus(`“${r.title}” se agregó a “${pl.name}”.`);
  render();
});
// Visualizador de audio (Web Audio API)
let actx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
function initViz() {
  if (actx) { void actx.resume(); return; }
  try {
    actx = new AudioContext();
    analyser = actx.createAnalyser();
    analyser.fftSize = 128;
    actx.createMediaElementSource(localAudio).connect(analyser);
    analyser.connect(actx.destination);
  } catch { actx = null; }
}
const canvas = $<HTMLCanvasElement>("#viz");
const g2d = canvas.getContext("2d");
function drawViz() {
  requestAnimationFrame(drawViz);
  if (!g2d) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  g2d.clearRect(0, 0, w, h);
  const bars = 48, bw = w / bars;
  const data = new Uint8Array(analyser ? analyser.frequencyBinCount : bars);
  if (analyser) analyser.getByteFrequencyData(data);
  g2d.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6c5ce7";
  for (let i = 0; i < bars; i++) {
    const v = audio.paused ? 0.05 : audio !== localAudio ? (Math.sin(performance.now() / 170 + i * 0.7) + 1.4) / 3.2 : data[Math.floor((i * data.length) / bars)] / 255;
    const bh = Math.max(3, v * h);
    g2d.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 3), bh);
  }
}
drawViz();
$("#play-all").addEventListener("click", () => {
  const pl = view();
  if (pl.id === playingId || !pl.songs.size) { togglePlay(); return; }
  const n = pl.songs.current ?? pl.songs.head;
  if (n) playNode(pl, n);
});
function setTheme(t: string) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("jd-theme", t); } catch { /* storage unavailable */ }
  document.querySelectorAll<HTMLElement>("#themes button").forEach((b) => b.classList.toggle("on", b.dataset.theme === t));
}
$("#themes").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-theme]");
  if (b) setTheme(b.dataset.theme!);
});
let savedTheme = "violet";
try { savedTheme = localStorage.getItem("jd-theme") || "violet"; } catch { /* ignore */ }
setTheme(savedTheme);
playlists.push({ id: FAV, name: "Favoritos", songs: newList() });
interface SavedTrack { id: string; key: string; kind: "local" | "stream" | "youtube"; title: string; artist: string; duration: number; url?: string; cover?: string | null }
let saved: { tracks?: SavedTrack[]; lists?: { name: string; ids: string[] }[]; favs?: string[] } | null = null;
try { saved = JSON.parse(localStorage.getItem(LS) || "null"); } catch { /* sin datos guardados */ }
const byId = new Map<string, Track>();
for (const m of saved?.tracks ?? []) {
  const t: Track = { id: newId("tr"), key: m.key, kind: m.kind, title: m.title, artist: m.artist, duration: m.duration, url: m.kind !== "local" ? m.url ?? "" : "", cover: m.kind !== "local" ? m.cover ?? null : null };
  byId.set(m.id, t);
  if (m.kind === "local") void getFile(m.key).then((blob) => { if (blob) { t.url = URL.createObjectURL(blob); readTags(blob as File, t); render(); } });
}
const pick = (ids: string[]) => ids.map((i) => byId.get(i)).filter((t): t is Track => !!t);
pick(saved?.favs ?? []).forEach((t) => fav().songs.append(t));
(saved?.lists?.length ? saved.lists : [{ name: "Mi lista", ids: [] }]).forEach((l) => { createPlaylist(l.name); pick(l.ids).forEach((t) => view().songs.append(t)); });
viewId = playlists[1].id;
render();
