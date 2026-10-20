/**
 * Serves `wiki/` on localhost so the generated pages (e.g. the playground) can be tried as GitHub Pages would
 * serve them. Usage: `ts-node scripts/serve-wiki.ts [page] [port]`, e.g. `playground/ 8000`.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';

const Root = path.resolve('wiki');

const Types: Readonly<Record<string, string>> = {
	'.html': 'text/html',
	'.js':   'text/javascript',
	'.mjs':  'text/javascript',
	'.css':  'text/css',
	'.json': 'application/json',
	'.svg':  'image/svg+xml',
	'.png':  'image/png',
	'.gif':  'image/gif',
	'.wasm': 'application/wasm',
	'.md':   'text/markdown'
};

/* what a served page listens on, so a rebuild reloads it */
const ReloadPath = '/__reload';
const ReloadScript = `<script>new EventSource('${ReloadPath}').onmessage = () => location.reload();</script>`;

/**
 * Serves `wiki/` and says where `page` is. With `live`, every served page reloads whenever the returned function is
 * called, which a build in watch mode does once it wrote the page anew.
 */
export function serveWiki(page = '', port = 8000, live = false): () => void {
	const listening = new Set<http.ServerResponse>();
	http.createServer((req, res) => {
		const at = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
		if(live && at === ReloadPath) {
			res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }).write('\n');
			listening.add(res);
			req.on('close', () => listening.delete(res));
			return;
		}
		let file = path.join(Root, at);
		if(!file.startsWith(Root)) {
			res.writeHead(403).end();
			return;
		}
		if(fs.existsSync(file) && fs.statSync(file).isDirectory()) {
			file = path.join(file, 'index.html');
		}
		fs.readFile(file, (err, content) => {
			if(err) {
				res.writeHead(404).end('not found');
				return;
			}
			const type = Types[path.extname(file)] ?? 'application/octet-stream';
			res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
				.end(live && type === 'text/html' ? content.toString().replace('</body>', `${ReloadScript}</body>`) : content);
		});
	}).listen(port, '127.0.0.1', () => console.log(`serving wiki/ on http://localhost:${port}/${page}${live ? ', reloading on every rebuild' : ''}`));
	return () => listening.forEach(res => res.write('data: reload\n\n'));
}

if(require.main === module) {
	const [page, port] = process.argv.slice(2);
	serveWiki(page, port === undefined ? undefined : Number(port));
}
