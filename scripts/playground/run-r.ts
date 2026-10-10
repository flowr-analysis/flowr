/**
 * Runs the script for real with webR, R compiled to WebAssembly, in a worker of its own. webR is only
 * fetched on the first run: R is about 30 MB and most visits never execute anything. Packages the
 * script loads are fetched from the webR repository right before the run that needs them.
 */
const WebRUrl = 'https://webr.r-wasm.org/v0.6.0/webr.mjs';

/**
 * Installs the service worker that checks every file of webR against the release pinned at build time, and
 * waits until it watches this page. Without it, R does not run: a webR that cannot be checked is not used.
 */
async function guard(): Promise<void> {
	if(!('serviceWorker' in navigator)) {
		throw new Error('this browser cannot check webR (no service workers), so R does not run here');
	}
	const workers = navigator.serviceWorker;
	await workers.register('webr-guard.js');
	await workers.ready;
	if(workers.controller === null) {
		await new Promise(resolve => workers.addEventListener('controllerchange', resolve, { once: true }));
	}
}

/* the few parts of webR the page uses, the package itself is never bundled */
interface RString {
	toString(): Promise<string>
}
interface Captured {
	readonly output: readonly { readonly type: string, readonly data: unknown }[]
	readonly images: readonly ImageBitmap[]
}
interface Shelter {
	captureR(code: string, options: object): Promise<Captured>
	purge(): Promise<void>
}
interface WebR {
	init(): Promise<unknown>
	close(): void
	installPackages(packages: readonly string[], options: { quiet: boolean }): Promise<void>
	evalRRaw(code: string, type: 'string[]'): Promise<string[]>
	readonly Shelter: new () => Promise<Shelter>
}

interface Session {
	readonly r:         WebR
	/** what the session can load without a download */
	readonly installed: Set<string>
}

let session: Promise<Session> | undefined;

/** rejects once the guard refuses a file of webR, see `webr-guard.js` */
function refused(): Promise<never> {
	return new Promise((_, reject) => navigator.serviceWorker.addEventListener('message', (event: MessageEvent<{ webrRefused?: string }>) => {
		if(event.data.webrRefused !== undefined) {
			reject(new Error(`${event.data.webrRefused}, so R does not run`));
		}
	}));
}

function start(): Promise<Session> {
	session ??= (async() => {
		await guard();
		const { WebR } = await import(WebRUrl) as { WebR: new () => WebR };
		const r = new WebR();
		await Promise.race([r.init(), refused()]);
		return { r, installed: new Set(await r.evalRRaw('.packages(all.available = TRUE)', 'string[]')) };
	})();
	/* a failed download should not stick, the next click tries again */
	session.catch(() => {
		session = undefined;
	});
	return session;
}

/** finds the packages a piece of R code loads, the page asks flowR's dependencies query */
let packagesOf: (code: string) => Promise<readonly string[]> = () => Promise.resolve([]);

/** fetches what the script needs and is not there yet, and says which of it webR does not have */
async function provide(s: Session, wanted: readonly string[], say: (text: string) => void): Promise<readonly string[]> {
	const missing = wanted.filter(p => !s.installed.has(p));
	if(missing.length === 0) {
		return [];
	}
	say(`installing ${missing.join(', ')}...`);
	await s.r.installPackages(missing, { quiet: true });
	for(const p of await s.r.evalRRaw('.packages(all.available = TRUE)', 'string[]')) {
		s.installed.add(p);
	}
	return missing.filter(p => !s.installed.has(p));
}

interface PlotSize {
	readonly width:     number
	readonly height:    number
	readonly pointsize: number
}

/** a canvas as wide as the card has room for, at the screen's resolution so text stays legible on a phone */
function plotSize(into: HTMLElement): PlotSize {
	const css = Math.max(280, Math.min(576, into.clientWidth - 32));
	const scale = window.devicePixelRatio || 1;
	return { width: Math.round(css * scale), height: Math.round(css * .7 * scale), pointsize: Math.round(12 * scale) };
}

/** R's message, warning, and error conditions arrive as R lists, everything else as text */
async function textOf(entry: Captured['output'][number]): Promise<string> {
	if(typeof entry.data === 'string') {
		return entry.data;
	}
	const message = (await (await (entry.data as { get(name: string): Promise<RString> }).get('message')).toString()).trim();
	return entry.type === 'warning' ? `Warning: ${message}` : entry.type === 'error' ? `Error: ${message}` : message;
}

function classOf(type: string): string | undefined {
	return type === 'stdout' ? undefined : type === 'warning' || type === 'message' ? 'note' : 'bad';
}

/** where an evaluation reports to */
interface Sink {
	readonly line:   (text: string, cls?: string) => void
	readonly plot:   (canvas: HTMLCanvasElement) => void
	readonly status: (text: string) => void
}

function canvasOf(image: ImageBitmap): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = image.width;
	canvas.height = image.height;
	canvas.style.width = `${image.width / (window.devicePixelRatio || 1)}px`;
	canvas.getContext('2d')?.drawImage(image, 0, 0);
	return canvas;
}

/**
 * Evaluates `code` in the one R session of the page, after fetching the packages it loads. With `fresh`, the
 * workspace is emptied first, like a new `Rscript` would have it. Gives up silently once `current` says a newer
 * evaluation took over. Returns whether R said or drew anything.
 */
async function evaluate(code: string, sink: Sink, plot: PlotSize, fresh: boolean, current: () => boolean): Promise<boolean> {
	sink.status(session === undefined ? 'downloading R (about 30 MB, only once)...' : 'running...');
	const s = await start();
	for(const p of await provide(s, await packagesOf(code), sink.status)) {
		sink.line(`${p} is not available for webR, so loading it fails`, 'note');
	}
	if(!current()) {
		return false;
	}
	sink.status('running...');
	const shelter = await new s.r.Shelter();
	try {
		if(fresh) {
			await shelter.captureR('rm(list = ls(all.names = TRUE))', { captureGraphics: false });
		}
		const result = await shelter.captureR(code, { withAutoprint: true, throwJsException: false, captureGraphics: plot });
		if(!current()) {
			return false;
		}
		for(const entry of result.output) {
			sink.line(await textOf(entry), classOf(entry.type));
		}
		for(const image of result.images) {
			sink.plot(canvasOf(image));
		}
		return result.output.length > 0 || result.images.length > 0;
	} finally {
		await shelter.purge();
	}
}

/** ends the session, the next evaluation starts a fresh one: webR can only interrupt R with headers GitHub Pages does not send */
function endSession(): void {
	void session?.then(s => s.r.close(), () => undefined);
	session = undefined;
}

let repl = 0;

/**
 * Evaluates one line of the repl in the session the run button uses, so what a run left behind can be inspected.
 * `into` is where plots go, `line` prints.
 */
export async function evalInR(code: string, line: (text: string, cls?: string) => void, into: HTMLElement): Promise<void> {
	const mine = ++repl;
	try {
		await evaluate(code, {
			line,
			plot: canvas => {
				into.append(canvas);
				into.scrollTop = into.scrollHeight;
			},
			status: text => {
				if(text.startsWith('downloading') || text.startsWith('installing')) {
					line(text, 'note');
				}
			}
		}, plotSize(into), false, () => mine === repl);
	} catch(e) {
		line(e instanceof Error ? e.message : String(e), 'bad');
	}
}

/**
 * Wires the run button and the output card: runs what `code` returns and shows its output and plots.
 * `packages` tells which packages a piece of code loads, so they can be installed before it runs.
 */
export function setupRunR(code: () => string, packages: (code: string) => Promise<readonly string[]>): void {
	packagesOf = packages;
	const go = document.getElementById('runrgo') as HTMLButtonElement | null;
	const stop = document.getElementById('runrstop') as HTMLButtonElement | null;
	const close = document.getElementById('runrclose') as HTMLButtonElement | null;
	const card = document.getElementById('runr');
	const state = document.getElementById('runrstate');
	const out = document.getElementById('runrout');
	if(go === null || stop === null || close === null || card === null || state === null || out === null) {
		return;
	}
	let running = 0;

	const line = (text: string, cls?: string): void => {
		const at = document.createElement('div');
		if(cls) {
			at.className = cls;
		}
		at.textContent = text;
		out.append(at);
	};

	const done = (text: string): void => {
		state.textContent = text;
		go.disabled = false;
		card.classList.remove('busy');
		stop.hidden = true;
	};

	stop.addEventListener('click', () => {
		running++;
		endSession();
		line('stopped, the next run starts a fresh R session', 'bad');
		done('');
	});

	close.addEventListener('click', () => {
		card.hidden = true;
	});

	const runScript = async(): Promise<void> => {
		const run = ++running;
		go.disabled = true;
		stop.hidden = false;
		card.hidden = false;
		card.classList.add('busy');
		out.replaceChildren();
		/* stacked on a phone, the card is far below the editor */
		if(matchMedia('(max-width: 52rem)').matches) {
			card.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
		const begin = performance.now();
		try {
			const said = await evaluate(code(), {
				line,
				plot:   canvas => out.append(canvas),
				status: text => {
					state.textContent = text;
				}
			}, plotSize(out), true, () => run === running);
			if(run === running) {
				if(!said) {
					line('no output', 'note');
				}
				done(`took ${(Math.round(performance.now() - begin) / 1000).toFixed(1)} s`);
			}
		} catch(e) {
			if(run === running) {
				line(e instanceof Error ? e.message : String(e), 'bad');
				done('');
			}
		}
	};
	go.addEventListener('click', () => void runScript());
	document.addEventListener('keydown', event => {
		if((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !go.disabled) {
			event.preventDefault();
			void runScript();
		}
	});
}
