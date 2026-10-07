(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/DoublyLinkedList.ts
  var Node = class {
    constructor(value, prev = null, next = null) {
      this.value = value;
      this.prev = prev;
      this.next = next;
    }
  };
  var DoublyLinkedList = class {
    constructor() {
      __publicField(this, "head", null);
      __publicField(this, "tail", null);
      __publicField(this, "current", null);
      // "play head" pointer
      /** When true, next() on the last node wraps to the head and prev() on the head wraps to the tail. */
      __publicField(this, "circular", false);
      __publicField(this, "count", 0);
    }
    get size() {
      return this.count;
    }
    prepend(value) {
      return this.link(new Node(value), 0);
    }
    append(value) {
      return this.link(new Node(value), this.count);
    }
    insertAt(index, value) {
      if (index < 0 || index > this.count) throw new RangeError("Index out of range");
      return this.link(new Node(value), index);
    }
    removeAt(index) {
      const node = this.getNode(index);
      return node ? this.removeNode(node) : null;
    }
    removeById(predicate) {
      const i = this.indexOf(predicate);
      return i < 0 ? null : this.removeAt(i);
    }
    /** Unlinks a node; if it was current, the pointer moves to its neighbour. */
    removeNode(node) {
      if (this.current === node) this.current = node.next ?? node.prev;
      this.unlink(node);
      return node.value;
    }
    /** Moves a node to another index without recreating it (keeps the current pointer valid). */
    move(from, to) {
      const node = this.getNode(from);
      if (!node || to < 0 || to >= this.count || from === to) return;
      this.unlink(node);
      this.link(node, to);
    }
    next() {
      if (!this.current) {
        this.current = this.head;
        return this.current;
      }
      if (!this.current.next) {
        if (!this.circular) return null;
        return this.current = this.head;
      }
      return this.current = this.current.next;
    }
    prev() {
      if (!this.current) {
        this.current = this.head;
        return this.current;
      }
      if (!this.current.prev) {
        if (!this.circular) return null;
        return this.current = this.tail;
      }
      return this.current = this.current.prev;
    }
    getNode(index) {
      if (index < 0 || index >= this.count) return null;
      let node;
      if (index < this.count / 2) {
        node = this.head;
        for (let i = 0; i < index; i++) node = node.next;
      } else {
        node = this.tail;
        for (let i = this.count - 1; i > index; i--) node = node.prev;
      }
      return node;
    }
    find(predicate) {
      for (let n = this.head; n; n = n.next) if (predicate(n.value)) return n;
      return null;
    }
    indexOf(predicate) {
      let i = 0;
      for (let n = this.head; n; n = n.next, i++) if (predicate(n.value)) return i;
      return -1;
    }
    indexOfNode(node) {
      let i = 0;
      for (let n = this.head; n; n = n.next, i++) if (n === node) return i;
      return -1;
    }
    toArray() {
      return [...this];
    }
    *[Symbol.iterator]() {
      for (let n = this.head; n; n = n.next) yield n.value;
    }
    link(node, index) {
      if (this.count === 0) {
        this.head = this.tail = node;
      } else if (index === 0) {
        node.next = this.head;
        this.head.prev = node;
        this.head = node;
      } else if (index >= this.count) {
        node.prev = this.tail;
        this.tail.next = node;
        this.tail = node;
      } else {
        const at = this.getNode(index);
        node.prev = at.prev;
        node.next = at;
        at.prev.next = node;
        at.prev = node;
      }
      this.count++;
      return node;
    }
    unlink(node) {
      if (node.prev) node.prev.next = node.next;
      else this.head = node.next;
      if (node.next) node.next.prev = node.prev;
      else this.tail = node.prev;
      node.prev = node.next = null;
      this.count--;
    }
  };

  // src/online.ts
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const name = `jd_cb_${Date.now()}`;
      const w = window;
      const script = document.createElement("script");
      const done = () => {
        delete w[name];
        script.remove();
      };
      w[name] = (data) => {
        done();
        resolve(data);
      };
      script.onerror = () => {
        done();
        reject(new Error("JSONP failed"));
      };
      script.src = `${url}&callback=${name}`;
      document.head.appendChild(script);
    });
  }
  async function getJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return jsonp(url);
    }
  }
  async function searchOnline(query2, jamendoId2 = "") {
    const q = encodeURIComponent(query2);
    if (jamendoId2) {
      const data2 = await getJson(
        `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(jamendoId2)}&format=json&limit=25&audioformat=mp32&imagesize=200&type=single+albumtrack&search=${q}`
      );
      if (data2.headers.status !== "success") throw new Error("jamendo-key");
      return data2.results.filter((r) => r.audio).map((r) => ({
        id: r.id,
        source: "jamendo",
        title: r.name,
        artist: r.artist_name,
        cover: r.image ?? "",
        url: r.audio,
        duration: r.duration
      }));
    }
    const data = await getJson(`https://itunes.apple.com/search?media=music&entity=song&limit=25&term=${q}`);
    return data.results.filter((r) => r.previewUrl).map((r) => ({
      id: String(r.trackId),
      source: "itunes",
      title: r.trackName,
      artist: r.artistName,
      cover: (r.artworkUrl100 ?? "").replace("100x100", "200x200"),
      url: r.previewUrl,
      duration: 30
    }));
  }

  // src/youtube.ts
  var decode = (s) => {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  };
  function seconds(iso) {
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
    return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
  }
  async function searchYouTube(query2, key) {
    const base = "https://www.googleapis.com/youtube/v3";
    const res = await fetch(`${base}/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=20&q=${encodeURIComponent(query2)}&key=${encodeURIComponent(key)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const reason = body?.error?.errors?.[0]?.reason ?? "";
      throw new Error(reason === "quotaExceeded" ? "youtube-quota" : reason === "accessNotConfigured" || reason === "forbidden" ? "youtube-api" : "youtube-key");
    }
    const items = (await res.json()).items.filter((i) => i.id?.videoId);
    const durations = /* @__PURE__ */ new Map();
    if (items.length) {
      const d = await fetch(`${base}/videos?part=contentDetails&id=${items.map((i) => i.id.videoId).join(",")}&key=${encodeURIComponent(key)}`);
      if (d.ok) (await d.json()).items.forEach((v) => durations.set(v.id, seconds(v.contentDetails.duration)));
    }
    return items.map((i) => ({
      id: i.id.videoId,
      source: "youtube",
      title: decode(i.snippet.title),
      artist: decode(i.snippet.channelTitle).replace(/ - Topic$/, ""),
      cover: i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? "",
      url: i.id.videoId,
      duration: durations.get(i.id.videoId) ?? 0
    }));
  }
  var YouTubeAudio = class extends EventTarget {
    constructor() {
      super(...arguments);
      __publicField(this, "id", "");
      __publicField(this, "pending", false);
      __publicField(this, "announced", false);
      __publicField(this, "state", -1);
      __publicField(this, "timer", 0);
      __publicField(this, "vol", 0.8);
      __publicField(this, "mute", false);
      __publicField(this, "p", null);
      __publicField(this, "ready", null);
    }
    get src() {
      return this.id;
    }
    set src(v) {
      this.id = v;
      this.pending = true;
      this.announced = false;
    }
    get paused() {
      return this.state !== 1 && this.state !== 3;
    }
    get ended() {
      return this.state === 0;
    }
    get duration() {
      const d = this.p?.getDuration() ?? 0;
      return d > 0 ? d : NaN;
    }
    get currentTime() {
      return this.p?.getCurrentTime() ?? 0;
    }
    set currentTime(v) {
      this.p?.seekTo(v, true);
    }
    get volume() {
      return this.vol;
    }
    set volume(v) {
      this.vol = v;
      this.p?.setVolume(v * 100);
    }
    get muted() {
      return this.mute;
    }
    set muted(v) {
      this.mute = v;
      if (v) this.p?.mute();
      else this.p?.unMute();
    }
    play() {
      this.ensure().then((p) => {
        if (this.pending) {
          this.pending = false;
          p.loadVideoById(this.id);
        } else p.playVideo();
      }).catch(() => this.dispatchEvent(new CustomEvent("error", { detail: -1 })));
      return Promise.resolve();
    }
    pause() {
      this.p?.pauseVideo();
    }
    removeAttribute() {
      this.id = "";
      this.pending = false;
      this.p?.stopVideo();
    }
    load() {
    }
    ensure() {
      if (this.ready) return this.ready;
      this.ready = new Promise((resolve, reject) => {
        const w = window;
        const make = () => {
          new w.YT.Player("yt-holder", {
            width: "100%",
            height: "100%",
            playerVars: { playsinline: 1, rel: 0 },
            events: {
              onReady: (e) => {
                this.p = e.target;
                e.target.setVolume(this.vol * 100);
                if (this.mute) e.target.mute();
                resolve(e.target);
              },
              onStateChange: (e) => this.onState(e.data),
              onError: (e) => this.dispatchEvent(new CustomEvent("error", { detail: e.data }))
            }
          });
        };
        if (w.YT?.Player) {
          make();
          return;
        }
        w.onYouTubeIframeAPIReady = make;
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.onerror = () => {
          this.ready = null;
          reject(new Error("youtube-script"));
        };
        document.head.appendChild(s);
      });
      return this.ready;
    }
    onState(s) {
      this.state = s;
      window.clearInterval(this.timer);
      if (s === 1) {
        if (!this.announced) {
          this.announced = true;
          this.dispatchEvent(new Event("loadedmetadata"));
        }
        this.dispatchEvent(new Event("play"));
        this.timer = window.setInterval(() => this.dispatchEvent(new Event("timeupdate")), 300);
      } else if (s === 2 || s === 0) {
        this.dispatchEvent(new Event("pause"));
        if (s === 0) this.dispatchEvent(new Event("ended"));
      }
    }
  };

  // src/main.ts
  var $ = (s) => document.querySelector(s);
  var icon = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">${d}</svg>`;
  var ICON = {
    play: icon('<path d="M8 5v14l11-7z"/>'),
    pause: icon('<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'),
    prev: icon('<path d="M6 5h2v14H6zM20 5v14L9 12z"/>'),
    next: icon('<path d="M16 5h2v14h-2zM4 5v14l11-7z"/>'),
    vol: icon('<path d="M3 10v4h4l5 4V6L7 10zM15 8a5 5 0 0 1 0 8z"/>'),
    muted: icon('<path d="M3 10v4h4l5 4V6L7 10zM16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" fill="none"/>'),
    shuffle: icon('<path d="M17 3l4 4-4 4V8h-2.6l-3.1 4.2L8.9 16H4v-2h3.9l2.5-3.3L7.9 8H4V6h4.9l2.4 3.2L13.8 6H17zM17 13l4 4-4 4v-3h-3.1l-2-2.7 1.2-1.6L14.6 16H17z"/>'),
    repeat: icon('<path d="M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2z"/>'),
    repeatOne: icon('<path d="M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2z"/><path d="M11 9h1.500v6H11v-4.200l-1 .4V10z"/>'),
    heart: icon('<path d="M12 21s-7.500-4.600-9.500-9.200C1.200 8 3.600 4.500 7 4.500c2 0 3.600 1.100 5 2.900 1.400-1.800 3-2.900 5-2.900 3.400 0 5.800 3.500 4.500 7.300C19.500 16.400 12 21 12 21z"/>'),
    heartO: icon('<path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7.500-4.600-9.500-9.200C1.200 8 3.600 4.500 7 4.500c2 0 3.600 1.100 5 2.900 1.400-1.800 3-2.900 5-2.900 3.400 0 5.800 3.500 4.500 7.300C19.500 16.400 12 21 12 21z"/>'),
    up: icon('<path d="M7 14l5-5 5 5z"/>'),
    down: icon('<path d="M7 10l5 5 5-5z"/>'),
    del: icon('<path d="M6 7h12l-1 13H7zM9 4h6v2H9z"/>')
  };
  var localAudio = new Audio();
  var streamAudio = new Audio();
  var yt = new YouTubeAudio();
  var ytAudio = yt;
  var audio = localAudio;
  localAudio.volume = streamAudio.volume = ytAudio.volume = 0.8;
  var on = (ev, fn) => [localAudio, streamAudio, ytAudio].forEach((a) => a.addEventListener(ev, fn));
  var playlists = [];
  var uid = 0;
  var viewId = "";
  var playingId = "";
  var dragFrom = -1;
  var query = "";
  var LS = "jd-music-data-v2";
  var FAV = "fav";
  var idb = new Promise((resolve) => {
    try {
      const r = indexedDB.open("jd-music", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  async function putFile(key, f) {
    const db = await idb;
    if (db) db.transaction("files", "readwrite").objectStore("files").put(f, key);
  }
  async function delFile(key) {
    const db = await idb;
    if (db) db.transaction("files", "readwrite").objectStore("files").delete(key);
  }
  async function getFile(key) {
    const db = await idb;
    if (!db) return null;
    return new Promise((resolve) => {
      const q = db.transaction("files").objectStore("files").get(key);
      q.onsuccess = () => resolve(q.result ?? null);
      q.onerror = () => resolve(null);
    });
  }
  var shuffle = false;
  var repeat = "off";
  var history = [];
  var newId = (p) => `${p}-${++uid}`;
  var view = () => playlists.find((p) => p.id === viewId);
  var playingList = () => playlists.find((p) => p.id === playingId);
  var fav = () => playlists.find((p) => p.id === FAV);
  var isFav = (t) => fav().songs.indexOf((x) => x.id === t.id) >= 0;
  var inAnyList = (t) => playlists.some((p) => p.songs.indexOf((x) => x.id === t.id) >= 0);
  var inAnyKey = (t) => playlists.some((p) => p.songs.indexOf((x) => x.key === t.key) >= 0);
  var newList = () => {
    const l = new DoublyLinkedList();
    l.circular = true;
    return l;
  };
  var esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  var fmt = (s) => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";
  var hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  var cover = (t) => {
    if (t?.cover) return `background:url('${t.cover}') center/cover`;
    const h = t ? hue(t.title) : 250;
    return `background:linear-gradient(135deg,hsl(${h} 70% 82%),hsl(${(h + 50) % 360} 75% 88%))`;
  };
  function createPlaylist(name) {
    const pl = { id: newId("pl"), name: name.trim() || `Lista ${playlists.length + 1}`, songs: newList() };
    playlists.push(pl);
    viewId = pl.id;
  }
  function toggleFav(t) {
    if (!fav().songs.removeById((x) => x.id === t.id)) fav().songs.append(t);
    render();
  }
  function deleteList(id) {
    const pl = playlists.find((p) => p.id === id);
    if (id === FAV || !pl || !confirm(`\xBFEliminar la lista \u201C${pl.name}\u201D?`)) return;
    playlists.splice(playlists.indexOf(pl), 1);
    if (playingId === id) {
      playingId = "";
      stop();
    }
    for (const t of pl.songs) {
      if (!inAnyList(t)) URL.revokeObjectURL(t.url);
      if (!inAnyKey(t)) void delFile(t.key);
    }
    if (!playlists.some((p) => p.id !== FAV)) createPlaylist("Mi lista");
    if (viewId === id) viewId = playlists.find((p) => p.id !== FAV).id;
    render();
  }
  function readTags(file, track) {
    try {
      jsmediatags.read(file, {
        onSuccess: (r) => {
          const tg = r.tags;
          if (tg.title) track.title = String(tg.title);
          if (tg.artist) track.artist = String(tg.artist);
          if (tg.picture) track.cover = URL.createObjectURL(new Blob([new Uint8Array(tg.picture.data)], { type: tg.picture.format }));
          render();
        },
        onError: () => {
        }
      });
    } catch {
    }
  }
  function playable(s, n, step) {
    for (let k = 0; n && !n.value.url && k < s.size; k++) {
      s.current = n;
      n = s[step]();
    }
    return n && n.value.url ? n : null;
  }
  function save() {
    try {
      const all = /* @__PURE__ */ new Map();
      playlists.forEach((p) => {
        for (const t of p.songs) all.set(t.id, t);
      });
      localStorage.setItem(LS, JSON.stringify({
        tracks: [...all.values()].map((t) => ({ id: t.id, key: t.key, kind: t.kind, title: t.title, artist: t.artist, duration: t.duration, ...t.kind !== "local" ? { url: t.url, cover: t.cover } : {} })),
        lists: playlists.filter((p) => p.id !== FAV).map((p) => ({ name: p.name, ids: p.songs.toArray().map((t) => t.id) })),
        favs: fav().songs.toArray().map((t) => t.id)
      }));
    } catch {
    }
  }
  function playNode(pl, node) {
    if (!node.value.url) return;
    if (node.value.kind === "local") initViz();
    const el = node.value.kind === "youtube" ? ytAudio : node.value.kind === "stream" ? streamAudio : localAudio;
    if (el !== audio) {
      audio.pause();
      audio = el;
    }
    document.body.classList.toggle("yt-active", el === ytAudio);
    playingId = pl.id;
    pl.songs.current = node;
    audio.src = node.value.url;
    audio.play().catch(() => {
    });
    render();
  }
  function stop() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  function goNext(auto = false) {
    const pl = playingList() ?? view();
    const s = pl.songs;
    if (!s.size) return;
    if (auto && repeat === "one" && s.current) {
      playNode(pl, s.current);
      return;
    }
    if (auto && repeat === "off" && !shuffle && s.current === s.tail) {
      render();
      return;
    }
    if (s.current) {
      history.push(s.current);
      if (history.length > 100) history.shift();
    }
    let n;
    if (shuffle && s.size > 1) {
      let i;
      do {
        i = Math.floor(Math.random() * s.size);
      } while (s.getNode(i) === s.current);
      n = s.getNode(i);
    } else {
      n = s.next() ?? (repeat === "all" ? s.head : null);
    }
    n = playable(s, n, "next");
    if (n) playNode(pl, n);
    else {
      history.pop();
      render();
    }
  }
  function goPrev() {
    const pl = playingList() ?? view();
    const s = pl.songs;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let n = null;
    while (shuffle && history.length && !n) {
      const h = history.pop();
      if (s.indexOfNode(h) >= 0) n = h;
    }
    if (!n) n = s.prev() ?? (repeat === "all" ? s.tail : null);
    n = playable(s, n, "prev");
    if (n) playNode(pl, n);
  }
  function togglePlay() {
    if (!audio.src) {
      const pl = view();
      const n = pl.songs.current ?? pl.songs.head;
      if (n) playNode(pl, n);
      return;
    }
    audio.paused ? audio.play() : audio.pause();
  }
  function addFiles(files) {
    const pl = view();
    const mode = $("#mode").value;
    const anchor = pl.songs.current ? pl.songs.indexOfNode(pl.songs.current) : -1;
    let at = mode === "after" && anchor >= 0 ? anchor + 1 : -1;
    for (const f of Array.from(files)) {
      const key = `${f.name}|${f.size}`;
      const restored = fav().songs.find((t) => t.key === key && !t.url)?.value;
      const track = restored ?? { id: newId("tr"), title: f.name.replace(/\.[^.]+$/, ""), artist: "Artista desconocido", cover: null, key, kind: "local", url: "", duration: 0 };
      track.url = URL.createObjectURL(f);
      readTags(f, track);
      void putFile(key, f);
      if (mode === "start") pl.songs.prepend(track);
      else if (at >= 0) pl.songs.insertAt(at++, track);
      else pl.songs.append(track);
      const probe = new Audio(track.url);
      probe.addEventListener("loadedmetadata", () => {
        track.duration = probe.duration;
        render();
      });
    }
    render();
  }
  function removeAt(index) {
    const pl = view();
    const node = pl.songs.getNode(index);
    if (!node) return;
    const wasPlaying = pl.id === playingId && pl.songs.current === node;
    const track = pl.songs.removeNode(node);
    if (!inAnyList(track)) URL.revokeObjectURL(track.url);
    if (!inAnyKey(track)) void delFile(track.key);
    if (wasPlaying) {
      if (pl.songs.current) playNode(pl, pl.songs.current);
      else stop();
    }
    render();
  }
  function render() {
    const pl = view();
    const cur = playingList()?.songs.current?.value ?? null;
    $("#tabs").innerHTML = playlists.map((p) => `<div class="tab ${p.id === viewId ? "on" : ""}" role="button" tabindex="0" data-pl="${p.id}"><span>${p.id === FAV ? "\u2665 " : ""}${esc(p.name)}</span><small>${p.songs.size}</small>${p.id === FAV ? "" : `<button class="x" data-del="${p.id}" title="Eliminar lista" aria-label="Eliminar lista">\xD7</button>`}</div>`).join("");
    const shown = pl.songs.current?.value ?? null;
    $("#now").innerHTML = `<div class="art" style="${cover(cur ?? shown)}">${cur ? cur.cover ? "" : esc(cur.title[0].toUpperCase()) : "\u266A"}</div>
    <div class="meta"><span class="kicker">${cur ? audio.paused ? "En pausa" : "Reproduciendo" : "Lista de reproducci\xF3n"}</span>
    <h2>${esc(pl.name)}</h2>
    <p>${pl.songs.size} ${pl.songs.size === 1 ? "canci\xF3n" : "canciones"}${cur ? ` \xB7 ${esc(cur.title)} \u2013 ${esc(cur.artist)}` : ""}</p></div>`;
    const target = $("#online-target");
    const prevTarget = target.value;
    target.innerHTML = playlists.map((p) => `<option value="${p.id}">${p.id === FAV ? "\u2665 " : ""}${esc(p.name)}</option>`).join("");
    target.value = playlists.some((p) => p.id === prevTarget) ? prevTarget : viewId;
    $("#play-all").innerHTML = pl.id === playingId && audio.src && !audio.paused ? ICON.pause : ICON.play;
    $("#list").innerHTML = pl.songs.size ? [...pl.songs].map((t, i) => {
      if (query && !`${t.title} ${t.artist}`.toLowerCase().includes(query)) return "";
      const on2 = pl.id === playingId && pl.songs.current?.value === t;
      return `<li class="row ${on2 ? "on" : ""} ${t.url ? "" : "off"}" draggable="true" data-i="${i}">
          <span class="num">${on2 ? "\u266A" : i + 1}</span><div class="thumb" style="${cover(t)}"></div>
          <button class="title" data-act="play" data-i="${i}"><span class="tt"><b>${esc(t.title)}</b><em>${t.url ? esc(t.artist) + (t.kind === "youtube" ? " \xB7 YouTube" : t.kind === "stream" ? " \xB7 En l\xEDnea" : "") : "Vuelve a subir el archivo para escucharla"}</em></span><small>${fmt(t.duration)}</small></button>
          <div class="acts"><button data-act="fav" data-i="${i}" class="hb ${isFav(t) ? "on" : ""}" title="Me gusta" aria-label="Me gusta">${isFav(t) ? ICON.heart : ICON.heartO}</button><button data-act="up" data-i="${i}" aria-label="Subir" title="Subir una posici\xF3n" ${i === 0 ? "disabled" : ""}>${ICON.up}</button>
          <button data-act="down" data-i="${i}" aria-label="Bajar" title="Bajar una posici\xF3n" ${i === pl.songs.size - 1 ? "disabled" : ""}>${ICON.down}</button>
          <button data-act="del" data-i="${i}" aria-label="Eliminar" title="Eliminar canci\xF3n" class="rm">${ICON.del}</button></div></li>`;
    }).join("") || `<li class="empty">No hay canciones que coincidan con tu b\xFAsqueda.</li>` : `<li class="empty">Esta lista est\xE1 vac\xEDa. Toca \u201CSubir canciones\u201D para cargar tus archivos de audio.</li>`;
    $("#bar-title").innerHTML = cur ? `<div class="thumb" style="${cover(cur)}"></div><div class="bt"><b>${esc(cur.title)}</b><small>${esc(cur.artist)}</small></div><button id="bar-fav" class="hb ${isFav(cur) ? "on" : ""}" title="Me gusta" aria-label="Me gusta">${isFav(cur) ? ICON.heart : ICON.heartO}</button>` : `<div class="bt"><small>Ninguna canci\xF3n seleccionada</small></div>`;
    $("#play").innerHTML = audio.src && !audio.paused ? ICON.pause : ICON.play;
    $("#prev").innerHTML = ICON.prev;
    $("#next").innerHTML = ICON.next;
    $("#shuffle").innerHTML = ICON.shuffle + "<span>Aleatorio</span>";
    $("#shuffle").classList.toggle("on", shuffle);
    $("#shuffle").setAttribute("aria-pressed", String(shuffle));
    $("#repeat").innerHTML = (repeat === "one" ? ICON.repeatOne : ICON.repeat) + "<span>Repetir</span>";
    $("#repeat").classList.toggle("on", repeat !== "off");
    $("#repeat").title = `Repetir: ${{ off: "desactivado", all: "toda la lista", one: "una canci\xF3n" }[repeat]}`;
    $("#shuffle").title = `Aleatorio: ${shuffle ? "activado" : "desactivado"}`;
    $("#mute").innerHTML = audio.muted || audio.volume === 0 ? ICON.muted : ICON.vol;
    save();
  }
  $("#new-pl").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#pl-name");
    createPlaylist(input.value);
    input.value = "";
    render();
  });
  $("#tabs").addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.click();
  });
  $("#tabs").addEventListener("click", (e) => {
    const d = e.target.closest("[data-del]");
    if (d) {
      deleteList(d.dataset.del);
      return;
    }
    const b = e.target.closest("[data-pl]");
    if (b) {
      viewId = b.dataset.pl;
      document.body.classList.remove("online-open");
      render();
    }
  });
  $("#files").addEventListener("change", (e) => {
    const input = e.target;
    if (input.files?.length) addFiles(input.files);
    input.value = "";
  });
  $("#list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const i = Number(b.dataset.i);
    const pl = view();
    if (b.dataset.act === "play") {
      const n = pl.songs.getNode(i);
      if (n) playNode(pl, n);
    } else if (b.dataset.act === "up") {
      pl.songs.move(i, i - 1);
      render();
    } else if (b.dataset.act === "down") {
      pl.songs.move(i, i + 1);
      render();
    } else if (b.dataset.act === "fav") {
      const n = pl.songs.getNode(i);
      if (n) toggleFav(n.value);
    } else removeAt(i);
  });
  var list = $("#list");
  list.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".row");
    if (row) {
      dragFrom = Number(row.dataset.i);
      row.classList.add("drag");
      e.dataTransfer.effectAllowed = "move";
    }
  });
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    list.querySelectorAll(".over").forEach((r) => r.classList.remove("over"));
    e.target.closest(".row")?.classList.add("over");
  });
  list.addEventListener("drop", (e) => {
    e.preventDefault();
    const row = e.target.closest(".row");
    if (row && dragFrom >= 0) view().songs.move(dragFrom, Number(row.dataset.i));
    dragFrom = -1;
    render();
  });
  list.addEventListener("dragend", () => {
    dragFrom = -1;
    render();
  });
  $("#play").addEventListener("click", togglePlay);
  $("#next").addEventListener("click", () => goNext(false));
  $("#shuffle").addEventListener("click", () => {
    shuffle = !shuffle;
    history.length = 0;
    render();
  });
  $("#repeat").addEventListener("click", () => {
    repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    render();
  });
  $("#prev").addEventListener("click", goPrev);
  $("#mute").addEventListener("click", () => {
    localAudio.muted = streamAudio.muted = ytAudio.muted = !audio.muted;
    render();
  });
  $("#vol").addEventListener("input", (e) => {
    localAudio.volume = streamAudio.volume = ytAudio.volume = Number(e.target.value);
    localAudio.muted = streamAudio.muted = ytAudio.muted = false;
    render();
  });
  $("#seek").addEventListener("input", (e) => {
    if (audio.duration) audio.currentTime = Number(e.target.value) / 1e3 * audio.duration;
  });
  on("timeupdate", () => {
    $("#cur").textContent = fmt(audio.currentTime);
    $("#seek").value = String(audio.duration ? audio.currentTime / audio.duration * 1e3 : 0);
  });
  on("loadedmetadata", () => {
    $("#dur").textContent = fmt(audio.duration);
  });
  on("play", render);
  on("pause", render);
  on("ended", () => goNext(true));
  $("#search").addEventListener("input", (e) => {
    query = e.target.value.trim().toLowerCase();
    render();
  });
  $("#bar-title").addEventListener("click", (e) => {
    const cur = playingList()?.songs.current;
    if (cur && e.target.closest("#bar-fav")) toggleFav(cur.value);
  });
  var results = [];
  var setStatus = (t) => {
    $("#online-status").textContent = t;
  };
  function renderOnline() {
    $("#results").innerHTML = results.map((r, i) => `<li class="row res">
    <div class="thumb" style="background:url('${esc(r.cover)}') center/cover"></div>
    <div class="title nolink"><span class="tt"><b>${esc(r.title)}</b><em>${esc(r.artist)}</em></span><small>${fmt(r.duration)}</small></div>
    <div class="acts"><button class="addbtn" data-add="${i}" title="Agregar a la lista" aria-label="Agregar a la lista">+</button></div></li>`).join("");
  }
  var JID = "jd-jamendo-id";
  var CFG = window.JD_CONFIG ?? {};
  var jamendoId = () => {
    try {
      return localStorage.getItem(JID) || CFG.jamendoId || "";
    } catch {
      return CFG.jamendoId || "";
    }
  };
  if (CFG.jamendoId) $("#ocfg").hidden = true;
  $("#jamendo-id").value = jamendoId();
  $("#ocfg").open = false;
  $("#jamendo-save").addEventListener("click", () => {
    const v = $("#jamendo-id").value.trim();
    try {
      if (v) localStorage.setItem(JID, v);
      else localStorage.removeItem(JID);
    } catch {
    }
    setStatus(v ? "Clave guardada. Las b\xFAsquedas ahora devuelven canciones completas." : "Clave eliminada. Las b\xFAsquedas devuelven fragmentos de 30 segundos.");
  });
  var YID = "jd-youtube-key";
  var youtubeKey = () => {
    try {
      return localStorage.getItem(YID) || CFG.youtubeKey || "";
    } catch {
      return CFG.youtubeKey || "";
    }
  };
  if (CFG.youtubeKey) $("#ycfg").hidden = true;
  $("#youtube-key").value = youtubeKey();
  $("#ycfg").open = !youtubeKey();
  $("#online-source").value = youtubeKey() ? "youtube" : jamendoId() ? "jamendo" : "itunes";
  $("#youtube-save").addEventListener("click", () => {
    const v = $("#youtube-key").value.trim();
    try {
      if (v) localStorage.setItem(YID, v);
      else localStorage.removeItem(YID);
    } catch {
    }
    if (v) $("#online-source").value = "youtube";
    setStatus(v ? "Clave de YouTube guardada. Ya puedes buscar cualquier canci\xF3n." : "Clave de YouTube eliminada.");
  });
  var ERR = {
    "youtube-nokey": "Primero pega tu clave de la API de YouTube (recuadro de arriba).",
    "youtube-key": "La clave de YouTube no es v\xE1lida. Revisa que la copiaste completa.",
    "youtube-quota": "Se acab\xF3 la cuota diaria gratuita de YouTube. Intenta ma\xF1ana o usa otra fuente.",
    "youtube-api": "Falta habilitar \u201CYouTube Data API v3\u201D en tu proyecto de Google Cloud.",
    "jamendo-key": "La clave de Jamendo no es v\xE1lida. Revisa tu Client ID.",
    "jamendo-nokey": "Primero pega tu Client ID de Jamendo (recuadro de abajo)."
  };
  var errorText = (e) => e instanceof Error && ERR[e.message] || "No se pudo buscar. Revisa tu conexi\xF3n a internet.";
  async function runSearch(q) {
    const src = $("#online-source").value;
    if (src === "youtube") {
      if (!youtubeKey()) throw new Error("youtube-nokey");
      return searchYouTube(q, youtubeKey());
    }
    if (src === "jamendo" && !jamendoId()) throw new Error("jamendo-nokey");
    return searchOnline(q, src === "jamendo" ? jamendoId() : "");
  }
  var toast = (m) => {
    const t = $("#toast");
    t.textContent = m;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 7e3);
  };
  yt.addEventListener("error", () => toast("No se pudo reproducir este video de YouTube. Puede que el autor no permita incrustarlo, o que abriste la app con doble clic: publ\xEDcala (Netlify) o usa un servidor local."));
  $("#online-toggle").addEventListener("click", () => {
    document.body.classList.toggle("online-open");
    $("#online-target").value = viewId;
  });
  $("#online-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#online-q").value.trim();
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
    const b = e.target.closest("[data-add]");
    if (!b) return;
    const r = results[Number(b.dataset.add)];
    const pl = playlists.find((p) => p.id === $("#online-target").value) ?? view();
    const track = { id: newId("tr"), title: r.title, artist: r.artist, cover: r.cover || null, key: `${r.source}|${r.id}`, kind: r.source === "youtube" ? "youtube" : "stream", url: r.url, duration: r.duration };
    const mode = $("#online-mode").value;
    const anchor = pl.songs.current ? pl.songs.indexOfNode(pl.songs.current) : -1;
    if (mode === "start") pl.songs.prepend(track);
    else if (mode === "after" && anchor >= 0) pl.songs.insertAt(anchor + 1, track);
    else pl.songs.append(track);
    b.textContent = "\u2713";
    setStatus(`\u201C${r.title}\u201D se agreg\xF3 a \u201C${pl.name}\u201D.`);
    render();
  });
  var actx = null;
  var analyser = null;
  function initViz() {
    if (actx) {
      void actx.resume();
      return;
    }
    try {
      actx = new AudioContext();
      analyser = actx.createAnalyser();
      analyser.fftSize = 128;
      actx.createMediaElementSource(localAudio).connect(analyser);
      analyser.connect(actx.destination);
    } catch {
      actx = null;
    }
  }
  var canvas = $("#viz");
  var g2d = canvas.getContext("2d");
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
      const v = audio.paused ? 0.05 : audio !== localAudio ? (Math.sin(performance.now() / 170 + i * 0.7) + 1.4) / 3.2 : data[Math.floor(i * data.length / bars)] / 255;
      const bh = Math.max(3, v * h);
      g2d.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 3), bh);
    }
  }
  drawViz();
  $("#play-all").addEventListener("click", () => {
    const pl = view();
    if (pl.id === playingId || !pl.songs.size) {
      togglePlay();
      return;
    }
    const n = pl.songs.current ?? pl.songs.head;
    if (n) playNode(pl, n);
  });
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("jd-theme", t);
    } catch {
    }
    document.querySelectorAll("#themes button").forEach((b) => b.classList.toggle("on", b.dataset.theme === t));
  }
  $("#themes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme]");
    if (b) setTheme(b.dataset.theme);
  });
  var savedTheme = "violet";
  try {
    savedTheme = localStorage.getItem("jd-theme") || "violet";
  } catch {
  }
  setTheme(savedTheme);
  playlists.push({ id: FAV, name: "Favoritos", songs: newList() });
  var saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(LS) || "null");
  } catch {
  }
  var byId = /* @__PURE__ */ new Map();
  for (const m of saved?.tracks ?? []) {
    const t = { id: newId("tr"), key: m.key, kind: m.kind, title: m.title, artist: m.artist, duration: m.duration, url: m.kind !== "local" ? m.url ?? "" : "", cover: m.kind !== "local" ? m.cover ?? null : null };
    byId.set(m.id, t);
    if (m.kind === "local") void getFile(m.key).then((blob) => {
      if (blob) {
        t.url = URL.createObjectURL(blob);
        readTags(blob, t);
        render();
      }
    });
  }
  var pick = (ids) => ids.map((i) => byId.get(i)).filter((t) => !!t);
  pick(saved?.favs ?? []).forEach((t) => fav().songs.append(t));
  (saved?.lists?.length ? saved.lists : [{ name: "Mi lista", ids: [] }]).forEach((l) => {
    createPlaylist(l.name);
    pick(l.ids).forEach((t) => view().songs.append(t));
  });
  viewId = playlists[1].id;
  render();
})();
