'use strict';
/*
 * Service worker of the playground: every request for webR's files is answered only if the file has the SHA-256
 * pinned when the playground was built (see webr-pin.ts), so a changed or unknown file never reaches the page.
 * The build fills in the two placeholders.
 */
const Base = '<!--WEBR-BASE-->';
const Expected = JSON.parse('<!--WEBR-MANIFEST-->');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
	const url = event.request.url;
	if(url.startsWith(Base)) {
		event.respondWith(verified(url.slice(Base.length).split(/[?#]/)[0]));
	}
});

/* webR waits forever for a file its worker could not load, so the page is told why and gives up instead */
function refuse(file, why) {
	void self.clients.matchAll().then(pages => pages.forEach(page => page.postMessage({ webrRefused: `webR's ${file} ${why}` })));
	return new Response(`webR's ${file} ${why}, so it is not used`, { status: 403, headers: { 'Content-Type': 'text/plain' } });
}

function base64(buffer) {
	let text = '';
	for(const byte of new Uint8Array(buffer)) {
		text += String.fromCharCode(byte);
	}
	return btoa(text);
}

async function verified(file) {
	const want = Expected[file];
	if(want === undefined) {
		return refuse(file, 'is not part of the pinned release');
	}
	const response = await fetch(Base + file);
	const body = await response.arrayBuffer();
	if(!response.ok || base64(await crypto.subtle.digest('SHA-256', body)) !== want) {
		return refuse(file, 'does not match the pinned release');
	}
	return new Response(body, { headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream' } });
}
