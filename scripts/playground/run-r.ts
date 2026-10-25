/**
 * Runs the script for real with webR, R compiled to WebAssembly, in a worker of its own. webR is only
 * fetched on the first run: R is about 30 MB and most visits never execute anything. Packages the
 * script loads are fetched from the webR repository right before the run that needs them.
 */
import { WebRBase, WebRVersion } from './webr-version';
import { arraySum } from '../../src/util/collections/arrays';
import { el } from '../page-lib/dom';
import { compressToEncodedURIComponent } from 'lz-string';


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
	readonly FS: {
		mkdir(path: string): Promise<unknown>
		writeFile(path: string, data: Uint8Array): Promise<unknown>
	}
}

interface Session {
	readonly r:         WebR
	/** what the session can load without a download */
	readonly installed: Set<string>
	/** the search path R started with, a fresh run detaches what was attached since */
	readonly attached:  readonly string[]
}

let session: Promise<Session> | undefined;

/** the files of webR the guard let through, each matched the pinned release, see `webr-guard.js` */
const verified = new Set<string>();

/** what the output card says about the webR it shows, updated as the guard reports */
function showTrust(refusal?: string): void {
	const at = document.getElementById('runrtrust');
	if(at === null) {
		return;
	}
	at.className = refusal !== undefined ? 'bad' : verified.size > 0 ? 'ok' : '';
	at.textContent = refusal !== undefined ? 'not verified' : verified.size > 0 ? 'signature verified' : '';
	at.title = refusal ?? (verified.size > 0
		? `${verified.size} files of webR ${WebRVersion} matched the release signed on npm. R packages from repo.r-wasm.org are not checked.`
		: '');
}

/** a download the page waits for, `then` naming what follows it */
interface Step {
	readonly counts: (url: string) => boolean
	readonly total?: number
	readonly then:   string
}

let step: Step | undefined;
const transfers = new Map<string, number>();

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(1);

function showProgress(): void {
	const bar = document.getElementById('runrprogress') as HTMLProgressElement | null;
	const bytes = document.getElementById('runrbytes');
	if(bar === null || bytes === null) {
		return;
	}
	bar.hidden = bytes.hidden = step === undefined;
	const loaded = arraySum([...transfers.values()]);
	if(step?.total !== undefined && loaded < step.total) {
		bar.max = step.total;
		bar.value = loaded;
		bytes.textContent = `${megabytes(loaded)} of ${megabytes(step.total)} MB`;
	} else {
		bar.removeAttribute('value');
		bytes.textContent = step?.total !== undefined ? step.then : loaded > 0 ? `${megabytes(loaded)} MB` : '';
	}
}

function beginStep(next?: Step): void {
	step = next;
	transfers.clear();
	showProgress();
}

/** how much every start of webR downloads outside its lazily mounted file system */
const startBytes = Number(document.getElementById('runr')?.dataset.webrStartBytes) || undefined;

/** rejects once the guard refuses a file of webR */
function refused(): Promise<never> {
	return new Promise((_, reject) => navigator.serviceWorker.addEventListener('message', (event: MessageEvent<{ webrRefused?: string, webrVerified?: string, webrProgress?: { url: string, loaded: number } }>) => {
		if(event.data.webrProgress !== undefined) {
			const { url, loaded } = event.data.webrProgress;
			if(step?.counts(url) === true) {
				transfers.set(url, loaded);
				showProgress();
			}
		} else if(event.data.webrVerified !== undefined) {
			verified.add(event.data.webrVerified);
			showTrust();
		} else if(event.data.webrRefused !== undefined) {
			showTrust(event.data.webrRefused);
			reject(new Error(`${event.data.webrRefused}, so R does not run`));
		}
	}));
}

/** where the options R started with are kept, out of the reach of `rm` */
const StartOptions = 'file.path(tempdir(), "flowr-start-options.rds")';

/** R as it started: without the variables, attachments, and options earlier runs left behind */
const startOver = (s: Session) => `local({
	for(name in setdiff(search(), c(${s.attached.map(a => JSON.stringify(a)).join(', ')}))) detach(name, character.only = TRUE)
	start <- readRDS(${StartOptions})
	added <- setdiff(names(options()), names(start))
	options(start)
	options(setNames(vector("list", length(added)), added))
})
rm(list = ls(all.names = TRUE))`;

function start(): Promise<Session> {
	session ??= (async() => {
		await guard();
		const { WebR } = await import(`${WebRBase}webr.mjs`) as { WebR: new () => WebR };
		const r = new WebR();
		await Promise.race([r.init(), refused()]);
		return {
			r,
			installed: new Set(await r.evalRRaw('.packages(all.available = TRUE)', 'string[]')),
			attached:  await r.evalRRaw(`{ saveRDS(options(), ${StartOptions}); search() }`, 'string[]')
		};
	})();
	/* a failed download should not stick, the next click tries again */
	session.catch(() => {
		session = undefined;
	});
	return session;
}

/** the packages `code` loads, or the whole project without code, from flowR's dependencies query */
export type PackageFinder = (code?: string) => Promise<readonly string[]>;

/** what a run executes next to the project files, `fresh` from an empty workspace like `Rscript`, otherwise like a notebook cell */
export interface RunInput {
	readonly code:  string
	readonly files: readonly (readonly [string, string])[]
	readonly fresh: boolean
}

/**
 * Shiny needs a web server, which Shinylive runs in the browser, in a tab of its own: its service worker, which a
 * browser may refuse a frame of another site, always runs there. The project goes into a folder of its own, started
 * from a generated `app.R`, so its own `app.R` and relative paths keep working. The files travel in the URL fragment,
 * which no server sees.
 */
function shinyApp({ code, files }: RunInput): string | undefined {
	if(!/\bshinyApp\s*\(/.test(code)) {
		return undefined;
	}
	/* code no file holds, like a notebook cell, gets a free file name */
	const named = files.find(([, text]) => text === code)?.[0];
	let script = named ?? 'run.R';
	for(let i = 1; named === undefined && files.some(([name]) => name === script); i++) {
		script = `run-${i}.R`;
	}
	const project = named === undefined ? [...files, [script, code] as const] : files;
	const app = [
		{ name: 'app.R', content: `shiny::shinyAppFile(${JSON.stringify(`project/${script}`)})` },
		...project.map(([name, content]) => ({ name: `project/${name}`, content }))
	];
	return `https://shinylive.io/r/app/#h=0&code=${compressToEncodedURIComponent(JSON.stringify(app))}`;
}

async function provideFiles(s: Session, { files, fresh }: RunInput): Promise<void> {
	const [dir] = await s.r.evalRRaw(fresh ? 'local({ d <- tempfile("project"); dir.create(d); setwd(d); d })' : 'getwd()', 'string[]');
	for(const [name, text] of files) {
		const parts = name.split('/');
		for(let i = 1; i < parts.length; i++) {
			await s.r.FS.mkdir(`${dir}/${parts.slice(0, i).join('/')}`).catch(() => undefined);
		}
		await s.r.FS.writeFile(`${dir}/${name}`, new TextEncoder().encode(text));
	}
}

const Packages = 'https://repo.r-wasm.org/';
const fileName = (url: string) => url.slice(url.lastIndexOf('/') + 1);

/** the archives installing `packages` downloads, with every dependency not installed yet */
async function packageArchives(s: Session, packages: readonly string[]): Promise<string[]> {
	return await s.r.evalRRaw(`local({
		contrib <- file.path(getOption("webr_pkg_repos")[1], "bin", "emscripten", "contrib", paste(R.version$major, sub("[.].*", "", R.version$minor), sep = "."))
		db <- available.packages(contriburl = contrib)
		wanted <- c(${packages.map(p => JSON.stringify(p)).join(', ')})
		needed <- unique(c(wanted, unlist(tools::package_dependencies(wanted, db, which = c("Depends", "Imports", "LinkingTo"), recursive = TRUE))))
		needed <- intersect(setdiff(needed, rownames(installed.packages())), rownames(db))
		if(length(needed) == 0) character() else paste0(contrib, "/", needed, "_", db[needed, "Version"], ".tgz")
	})`, 'string[]').catch(() => []);
}

/** fetches what the script needs and is not there yet, and says which of it webR does not have */
async function provide(s: Session, wanted: readonly string[], say: (text: string) => void): Promise<readonly string[]> {
	const missing = wanted.filter(p => !s.installed.has(p));
	if(missing.length === 0) {
		return [];
	}
	say(`looking up ${missing.join(', ')}...`);
	beginStep({ counts: url => url.startsWith(Packages), then: '' });
	const archives = await packageArchives(s, missing);
	const sizes = await Promise.all(archives.map(async url => Number((await fetch(url, { method: 'HEAD' })).headers.get('Content-Length'))));
	const names = new Set(archives.map(fileName));
	say(`installing ${missing.join(', ')}${archives.length > missing.length ? ` and ${archives.length - missing.length} packages they need` : ''}...`);
	beginStep({
		counts: url => names.has(fileName(url)),
		total:  sizes.every(size => size > 0) ? arraySum(sizes) : undefined,
		then:   'installing...'
	});
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
	const css = Math.max(240, Math.min(480, into.clientWidth - 32));
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

function canvasOf(image: ImageBitmap, plot: PlotSize): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = image.width;
	canvas.height = image.height;
	canvas.style.width = `${plot.width / (window.devicePixelRatio || 1)}px`;
	canvas.style.maxWidth = '100%';
	canvas.style.height = 'auto';
	canvas.getContext('2d')?.drawImage(image, 0, 0);
	return canvas;
}

/** runs `code` in the page's R session, giving up silently once `current` fails */
async function evaluate(code: string, wanted: () => Promise<readonly string[]>, sink: Sink, plot: PlotSize, current: () => boolean, project?: RunInput): Promise<{ readonly said: boolean, readonly took: number }> {
	if(session === undefined) {
		sink.status('downloading R, only once...');
		beginStep({ counts: url => url.startsWith(WebRBase) && !url.startsWith(`${WebRBase}vfs/`), total: startBytes, then: 'starting R...' });
	}
	const s = await start().finally(() => beginStep());
	for(const p of await provide(s, await wanted(), sink.status).finally(() => beginStep())) {
		sink.line(`${p} is not available for webR, so loading it fails`, 'note');
	}
	if(!current()) {
		return { said: false, took: 0 };
	}
	sink.status('running...');
	const shelter = await new s.r.Shelter();
	try {
		if(project?.fresh === true) {
			await shelter.captureR(startOver(s), { captureGraphics: false });
		}
		if(project !== undefined) {
			await provideFiles(s, project);
		}
		const started = performance.now();
		const result = await shelter.captureR(code, { withAutoprint: true, throwJsException: false, captureGraphics: plot });
		const took = performance.now() - started;
		if(!current()) {
			return { said: false, took };
		}
		for(const entry of result.output) {
			sink.line(await textOf(entry), classOf(entry.type));
		}
		for(const image of result.images) {
			sink.plot(canvasOf(image, plot));
		}
		return { said: result.output.length > 0 || result.images.length > 0, took };
	} finally {
		await shelter.purge();
	}
}

/** ends the session, the next evaluation starts a fresh one: webR can only interrupt R with headers GitHub Pages does not send */
function endSession(): void {
	void session?.then(s => s.r.close(), () => undefined);
	session = undefined;
}

/** forgets what earlier runs, cells, and the repl left in the session, without the wait of starting R again */
async function clearSession(): Promise<void> {
	const s = await session?.catch(() => undefined);
	if(s === undefined) {
		return;
	}
	const shelter = await new s.r.Shelter();
	try {
		await shelter.captureR(startOver(s), { captureGraphics: false });
	} finally {
		await shelter.purge();
	}
}

let repl = 0;

/**
 * Evaluates one line of the repl in the session the run button uses, so what a run left behind can be inspected.
 * `into` is where plots go, `line` prints.
 */
export async function evalInR(code: string, packagesOf: PackageFinder, line: (text: string, cls?: string) => void, into: HTMLElement): Promise<void> {
	const mine = ++repl;
	try {
		await evaluate(code, () => packagesOf(code), {
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
		}, plotSize(into), () => mine === repl);
	} catch(e) {
		line(e instanceof Error ? e.message : String(e), 'bad');
	}
}

/** runs what `prepare` returns under `title`, into the card or `into` */
export type Runner = (prepare: () => Promise<RunInput>, title: string, into?: HTMLElement) => Promise<number | undefined>;

/** wires the run button and the output card, returning a runner for notebook cells */
export function setupRunR(prepare: () => Promise<RunInput>, packagesOf: PackageFinder, instead?: () => Promise<void> | undefined): Runner {
	const go = document.getElementById('runrgo') as HTMLButtonElement | null;
	const stop = document.getElementById('runrstop') as HTMLButtonElement | null;
	const close = document.getElementById('runrclose') as HTMLButtonElement | null;
	const clear = document.getElementById('runrclear') as HTMLButtonElement | null;
	const card = document.getElementById('runr');
	const state = document.getElementById('runrstate');
	const out = document.getElementById('runrout');
	if(go === null || stop === null || close === null || clear === null || card === null || state === null || out === null) {
		return () => Promise.resolve(undefined);
	}
	let running = 0;

	const lineIn = (target: HTMLElement) => (text: string, cls?: string): void => target.append(el('div', cls, text));
	const line = lineIn(out);

	const done = (text: string): void => {
		state.textContent = text;
		go.disabled = false;
		card.classList.remove('busy');
		stop.hidden = true;
		/* a session to clear is there after every run but a stopped one, which ended it */
		clear.hidden = session === undefined;
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

	clear.addEventListener('click', () => {
		const run = ++running;
		void clearSession().then(() => {
			if(run === running) {
				out.replaceChildren();
				line('the R session is clear: no variables, attached packages, or options from earlier runs', 'note');
				state.textContent = '';
			}
		}, (e: unknown) => line(e instanceof Error ? e.message : String(e), 'bad'));
	});

	const title = document.getElementById('runrtitle');
	const runScript = async(what: () => Promise<RunInput>, named: string, into?: HTMLElement): Promise<number | undefined> => {
		const run = ++running;
		const target = into ?? out;
		/* a cell keeps its old output until the new is complete, or the page shrinks under the pointer */
		const sink = into === undefined ? out : el('div');
		const line = lineIn(sink);
		if(title !== null && into === undefined) {
			title.textContent = named;
		}
		go.disabled = true;
		stop.hidden = false;
		clear.hidden = true;
		card.hidden &&= into !== undefined;
		card.classList.add('busy');
		if(into === undefined) {
			out.replaceChildren();
		}
		/* stacked on a phone, the card is far below the editor */
		if(into === undefined && matchMedia('(max-width: 52rem)').matches) {
			card.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
		const begin = performance.now();
		try {
			const input = await what();
			const app = shinyApp(input);
			card.classList.toggle('shiny', app !== undefined);
			if(app !== undefined) {
				if(title !== null && into === undefined) {
					title.textContent = 'Shiny app';
				}
				const opened = window.open(app, '_blank');
				if(opened !== null) {
					opened.opener = null;
				}
				const tab = el('a', undefined, opened === null ? 'Open the app in a new tab' : 'open it again');
				tab.href = app;
				tab.target = '_blank';
				tab.rel = 'noopener';
				const note = el('div', 'note meta');
				note.append(...opened === null ? [tab, '.'] : ['The app opened in a new tab (', tab, ').'],
					' Shinylive first downloads R and the packages, which takes 10 to 30 seconds. The playground does not check these downloads.');
				sink.append(note);
				done('');
				return undefined;
			}
			const { said, took } = await evaluate(input.code, () => packagesOf(), {
				line,
				plot:   canvas => sink.append(canvas),
				status: text => {
					state.textContent = text;
				}
			}, plotSize(target), () => run === running, input);
			if(run === running) {
				if(!said && into === undefined) {
					line('no output', 'note meta');
				}
				done(`took ${(Math.round(performance.now() - begin) / 1000).toFixed(1)} s`);
				return took;
			}
		} catch(e) {
			if(run === running) {
				line(e instanceof Error ? e.message : String(e), 'bad');
				done('');
			}
		} finally {
			if(into !== undefined && run === running) {
				into.replaceChildren(...sink.childNodes);
			}
		}
		return undefined;
	};
	const runner: Runner = (what, named, into) => go.disabled ? Promise.resolve(undefined) : runScript(what, named, into);
	const runAll = () => void (instead?.() ?? runner(prepare, 'R output'));
	go.addEventListener('click', runAll);
	document.addEventListener('keydown', event => {
		if((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !go.disabled) {
			event.preventDefault();
			runAll();
		}
	});
	return runner;
}
