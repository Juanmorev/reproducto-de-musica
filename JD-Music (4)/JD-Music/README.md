# JD Music

## Cómo abrirlo (sin instalar nada)
Descomprime la carpeta y abre `index.html` con doble clic (Chrome o Edge). Ya funciona.

## Archivos
- `config.js`   -> aquí pegas TU clave de YouTube (youtubeKey) y tu Client ID de Jamendo para que funcionen para todos
- `index.html`  -> estructura de la página
- `style.css`   -> diseño y temas de color
- `app.js`      -> código TypeScript ya compilado (es el que ejecuta el navegador)
- `lib/jsmediatags.min.js` -> librería (MIT) que lee las etiquetas ID3 (portada, artista, título)
- `src/DoublyLinkedList.ts` -> Node<T> y DoublyLinkedList<T> (lista doblemente enlazada)
- `src/main.ts` -> lógica del reproductor, playlists e interfaz
- `src/online.ts` -> búsqueda en línea (API gratuita de iTunes, sin clave)
- `src/youtube.ts` -> búsqueda (YouTube Data API v3) y reproductor de YouTube (IFrame API)

## Si modificas el código TypeScript
`npm install` y luego `npm run build` (regenera `app.js`). `npm run typecheck` revisa los tipos.

## Publicarlo gratis
Arrastra toda la carpeta a https://app.netlify.com/drop (no necesita build), o súbela a GitHub Pages.

## Netlify / Vercel con GitHub
Comando de build: `npm run build` — Carpeta de publicación: `dist` (ya está en `netlify.toml`).
