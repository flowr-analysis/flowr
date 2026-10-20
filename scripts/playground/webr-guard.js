'use strict';
/*
 * Service worker of the playground: every request for webR's files is answered only if the file has the SHA-256
 * pinned when the playground was built (see webr-pin.ts), so a changed or unknown file never reaches the page.
 * It also tells the page how far along the downloads of webR and of the R packages are.
 * The build fills in the two placeholders.
 */
const Base = '<!--WEBR-BASE-->';
const Expected = JSON.parse('<!--WEBR-MANIFEST-->');
/* where webR installs R packages from, passed through untouched but counted */
const Packages = 'https://repo.r-wasm.org/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
	const url = event.request.url;
	if(url.startsWith(Base)) {
		event.respondWith(verified(url.slice(Base.length).split(/[?#]/)[0]));
	} else if(url.startsWith(Packages)) {
		event.respondWith(counted(event.request));
	}
});

function tell(message) {
	void self.clients.matchAll().then(pages => pages.forEach(page => page.postMessage(message)));
}

/* webR waits forever for a file its worker could not load, so the page is told why and gives up instead */
function refuse(file, why) {
	tell({ webrRefused: `webR's ${file} ${why}` });
	return new Response(`webR's ${file} ${why}, so it is not used`, { status: 403, headers: { 'Content-Type': 'text/plain' } });
}

function base64(buffer) {
	let text = '';
	for(const byte of new Uint8Array(buffer)) {
		text += String.fromCharCode(byte);
	}
	return btoa(text);
}

async function read(url, response, total) {
	const reader = response.body.getReader();
	const chunks = [];
	let loaded = 0;
	for(let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
		chunks.push(chunk.value);
		loaded += chunk.value.byteLength;
		tell({ webrProgress: { url, loaded, total } });
	}
	tell({ webrProgress: { url, loaded, total, done: true } });
	return new Blob(chunks);
}

async function counted(request) {
	const response = await fetch(request);
	if(!response.ok || response.body === null) {
		return response;
	}
	/* a compressed transfer says how many bytes travel, not how many arrive, so its length only counts when unencoded */
	const length = Number(response.headers.get('Content-Length'));
	const total = length > 0 && !response.headers.has('Content-Encoding') ? length : undefined;
	return new Response(await read(request.url, response, total), { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function verified(file) {
	const want = Expected[file];
	if(want === undefined) {
		return refuse(file, 'is not part of the pinned release');
	}
	const response = await fetch(Base + file);
	const body = response.ok ? await (await read(Base + file, response, want.size)).arrayBuffer() : new ArrayBuffer(0);
	if(!response.ok || base64(await crypto.subtle.digest('SHA-256', body)) !== want.sha256) {
		return refuse(file, 'does not match the pinned release');
	}
	tell({ webrVerified: file });
	return new Response(body, { headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream' } });
}
