/**
 * Serves `wiki/` on localhost so the generated pages (e.g. the playground) can be tried as GitHub Pages would
 * serve them. Usage: `ts-node scripts/serve-wiki.ts [page] [port]`, e.g. `playground/ 8000`.
 */
import fs from 'fs';
import http from 'http';
import path from 'path';

const Root = path.resolve('wiki');
const [page = '', port = '8000'] = process.argv.slice(2);

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

http.createServer((req, res) => {
	let file = path.join(Root, decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname));
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
		res.writeHead(200, { 'Content-Type': Types[path.extname(file)] ?? 'application/octet-stream' }).end(content);
	});
}).listen(Number(port), '127.0.0.1', () => console.log(`serving wiki/ on http://localhost:${port}/${page}`));
