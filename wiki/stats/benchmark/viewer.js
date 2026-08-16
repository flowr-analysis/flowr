'use strict';

/* Viewer for the flowR benchmark history. Plain DOM plus hand drawn SVG, no build step. */
(function() {
	const S = window.BenchStats;
	const NS = 'http://www.w3.org/2000/svg';
	const W = 700, H = 260, PAD_L = 58, PAD_R = 12, PAD_T = 20, PAD_B = 34;
	const MONTH = 30.44 * 24 * 3600 * 1000;

	const el = id => document.getElementById(id);
	const ui = {};
	for(const id of ['theme', 'suite', 'engine', 'range', 'mode', 'baseline', 'baselineOut', 'smooth', 'smoothOut',
		'band', 'calibrate', 'charts', 'status', 'tooltip', 'rangeNote', 'calibrationNote', 'sourceNote',
		'baselineField', 'calibrateField', 'dlSuite', 'dlCsv', 'dlAll', 'lock', 'resetLayout', 'copyLink',
		'latest', 'watchNote',
		'fullscreen', 'panelData', 'panelView', 'panelLayout', 'panelDownload',
		'digestData', 'digestView', 'digestLayout', 'digestDownload']) {
		ui[id] = el(id.replace(/[A-Z]/g, c => '-' + c.toLowerCase()));
	}

	let data = null;
	const hidden = new Map();

	/* ---------- chrome ---------- */

	function setTheme(mode) {
		if(mode === 'system') {
			document.documentElement.removeAttribute('data-theme');
		} else {
			document.documentElement.setAttribute('data-theme', mode);
		}
		try {
			localStorage.setItem('flowr-bench-theme', mode);
			localStorage.setItem('flowr-theme', mode === 'system' ? '' : mode);
		} catch{ /* private mode, keep going */ }
	}

	function initTheme() {
		let stored = 'system';
		try {
			stored = localStorage.getItem('flowr-bench-theme') || localStorage.getItem('flowr-theme') || 'system';
		} catch{ /* ignore */ }
		ui.theme.value = ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
		setTheme(ui.theme.value);
		ui.theme.addEventListener('change', () => {
			setTheme(ui.theme.value);
			writeUrl();
		});
	}

	/** whether the page is filling the screen, whichever name the browser gave that */
	function filling() {
		return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
	}

	/** set once a link asked for fullscreen, which only a gesture of the reader can actually grant */
	let wantsFullscreen = false;

	/**
	 * The whole page, so a dashboard can fill a screen of its own. Safari still only knows the prefixed
	 * form, and a page in a frame that was not allowed to do this has to say so by not offering it.
	 *
	 * A link can carry the state, but no browser lets a page that just loaded take the screen: it needs
	 * a gesture. So a link that asks for it says so and takes the first click the reader makes.
	 */
	function initFullscreen() {
		const root = document.documentElement;
		const request = root.requestFullscreen || root.webkitRequestFullscreen;
		const leave = document.exitFullscreen || document.webkitExitFullscreen;
		const allowed = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true;
		if(!request || !leave || !allowed) {
			ui.fullscreen.remove();
			return;
		}
		const sync = () => {
			ui.fullscreen.textContent = filling() ? 'Leave fullscreen' : 'Fullscreen';
			ui.fullscreen.setAttribute('aria-pressed', String(filling()));
			if(filling()) {
				clearAsk(); // however the screen was granted, the ask for it is answered
			}
			writeUrl();
		};
		const toggle = () => Promise.resolve(filling() ? leave.call(document) : request.call(root));
		ui.fullscreen.addEventListener('click', () => {
			toggle().catch(e => say('The browser refused to switch the fullscreen: ' + e, true));
		});
		for(const type of ['fullscreenchange', 'webkitfullscreenchange']) {
			document.addEventListener(type, sync);
		}
		/*
		 * `click` and `keyup`, not their down halves: a browser grants the screen on the gesture it
		 * considers finished, and asking on `pointerdown` is refused outright. The button carries the
		 * same request of its own, so a click on it is left to that one rather than answered twice.
		 */
		const arm = ev => {
			if(!wantsFullscreen || filling() || ui.fullscreen.contains(ev.target)) {
				return;
			}
			wantsFullscreen = false;
			/* the gesture was not one this browser accepts, so the button, which always is, stays lit */
			toggle().then(clearAsk, () => showAsk('Use the Fullscreen button below to go fullscreen'));
		};
		for(const type of ['click', 'keyup']) {
			document.addEventListener(type, arm);
		}
		sync();
	}

	/** the ask a link left for the reader, which only a gesture of theirs can answer */
	function showAsk(text) {
		say(text);
		ui.status.classList.add('ask');
		ui.status.title = 'this link asked for fullscreen, which every browser grants only on a click';
		ui.fullscreen.classList.add('asked');
	}

	/** the ask is answered, or no longer worth making, so nothing of it stays behind */
	function clearAsk() {
		wantsFullscreen = false;
		if(ui.fullscreen.isConnected) {
			ui.fullscreen.classList.remove('asked');
		}
		/* only the ask clears itself, an update notice below it is somebody else's line */
		if(ui.status.classList.contains('ask')) {
			ui.status.title = '';
			say('');
		}
	}

	/**
	 * A link that asks for the screen has to say so. No browser lets a page take the screen without a
	 * gesture of the reader, and a click the page dispatches itself is not one, so this waits for a real
	 * one rather than pretending it can do without.
	 */
	function offerFullscreen() {
		if(!wantsFullscreen || filling() || !ui.fullscreen.isConnected) {
			wantsFullscreen = false;
			return;
		}
		showAsk('Click anywhere to go to fullscreen');
	}

	function say(text, bad) {
		ui.status.textContent = text;
		ui.status.className = 'status' + (bad ? ' bad' : '');
		ui.status.hidden = !text;
	}

	/* ---------- dom ---------- */

	function dom(name, props, ...kids) {
		const n = Object.assign(document.createElement(name), props || {});
		for(const kid of kids) {
			if(kid !== null && kid !== undefined && kid !== false) {
				n.append(kid);
			}
		}
		return n;
	}

	/** replaces a node with a freshly built one, at most once per frame */
	function swapper(node) {
		let current = node, make = null, pending = false;
		return next => {
			make = next;
			if(pending) {
				return;
			}
			pending = true;
			requestAnimationFrame(() => {
				pending = false;
				const built = make();
				if(built && current.parentNode) {
					current.parentNode.replaceChild(built, current);
					current = built;
				}
			});
		};
	}

	function replaceNode(node, built) {
		if(built && node.parentNode) {
			node.parentNode.replaceChild(built, node);
		}
	}

	/* ---------- staying current ---------- */

	/** how often a page that is left open asks whether a release has written a new history */
	const CHECK_EVERY = 10 * 60 * 1000;
	/** the history as main has it, which a page served from an older build does not */
	const MAIN_DATA = 'https://raw.githubusercontent.com/flowr-analysis/flowr/main/wiki/stats/benchmark/data.js';
	/** the history is a megabyte and grows, so a body past this is dropped rather than held */
	const MAX_DATA = 64 * 1024 * 1024;
	/** long enough for a megabyte on a bad connection, short enough that nothing waits on it forever */
	const NET_TIMEOUT = 20000;

	/** every request this page makes gives up rather than hanging, whatever the network is doing */
	async function fetchSoon(url, opts, ms) {
		const stop = typeof AbortController === 'function' ? new AbortController() : null;
		const timer = window.setTimeout(() => stop && stop.abort(), ms || NET_TIMEOUT);
		try {
			return await fetch(url, Object.assign({}, opts, stop ? { signal: stop.signal } : {}));
		} finally {
			window.clearTimeout(timer);
		}
	}

	/**
	 * The first `limit` bytes of an answer, after which the rest is cancelled. The one number this page
	 * needs to compare two histories sits in the first line of a file that is a megabyte long.
	 */
	async function firstBytes(res, limit) {
		if(!res.body || typeof res.body.getReader !== 'function') {
			return (await res.text()).slice(0, limit);
		}
		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let text = '';
		try {
			while(text.length < limit) {
				const { value, done } = await reader.read();
				if(done) {
					break;
				}
				text += decoder.decode(value, { stream: true });
			}
		} finally {
			void reader.cancel();
		}
		return text;
	}

	/**
	 * The assignment `data.js` is, as data. Parsed rather than run: whatever this page downloads, it does
	 * not execute it.
	 */
	function parseData(text) {
		const from = text.indexOf('{');
		const to = text.lastIndexOf('}');
		if(from < 0 || to <= from) {
			return null;
		}
		try {
			return JSON.parse(text.slice(from, to + 1));
		} catch{
			return null;
		}
	}

	/** how current a history is: what it says of itself, and failing that the newest run it carries */
	function freshnessOf(raw) {
		const said = Number(raw && raw.lastUpdate);
		if(isFinite(said) && said > 0) {
			return said;
		}
		let newest = 0;
		for(const list of Object.values(raw && raw.entries && typeof raw.entries === 'object' ? raw.entries : {})) {
			for(const run of Array.isArray(list) ? list : []) {
				const at = new Date(run && run.date).getTime();
				if(isFinite(at)) {
					newest = Math.max(newest, at);
				}
			}
		}
		return newest;
	}

	/** how current the history shown right now is, whichever of the two it came from */
	let shownFreshness = 0;
	/**
	 * Where the history on the page came from, as far as the page can tell. It knows what it shipped with
	 * and what main has; a history that is ahead of main was published from something that is not main.
	 */
	const ORIGINS = {
		main:    ['from flowR main', 'this page shipped with an older history, so the one on main is shown instead'],
		same:    ['as on flowR main', 'the history this page shipped with is the one main has'],
		ahead:   ['ahead of flowR main, so from another branch',
			'this page shipped with a history newer than main\'s, so it was published from a branch of its own'],
		shipped: ['as published with this page', 'the history this page was built with'],
		unknown: ['as published with this page, main not reachable',
			'main could not be asked, so whether this history is the current one is unknown']
	};
	let origin = 'shipped';
	/** set while a newer history is being taken on board, which nothing else should announce meanwhile */
	let adopting = false;

	/** what main says its history was last written, without downloading the megabyte that follows */
	async function mainFreshness() {
		const res = await fetchSoon(MAIN_DATA, { cache: 'no-store' });
		if(!res.ok) {
			return 0;
		}
		const head = await firstBytes(res, 16 * 1024);
		const at = /"lastUpdate"\s*:\s*(\d+)/.exec(head);
		return at ? Number(at[1]) : 0;
	}

	/**
	 * A page is served from the build it was published with, and main may already carry a newer history
	 * than that. Whichever is newer wins. Anything at all going wrong, from being offline to an answer
	 * that is not a history, leaves the one this page shipped with in place.
	 */
	async function adoptNewer() {
		if(typeof fetch !== 'function') {
			return;
		}
		adopting = true;
		try {
			const there = await mainFreshness();
			if(!there) {
				origin = 'unknown';
				showSource();
				return;
			}
			if(there <= shownFreshness) {
				origin = there === shownFreshness ? 'same' : 'ahead';
				showSource();
				return;
			}
			const res = await fetchSoon(MAIN_DATA, { cache: 'no-store' });
			const size = Number(res.headers.get('content-length'));
			if(!res.ok || (isFinite(size) && size > MAX_DATA)) {
				origin = 'unknown';
				showSource();
				return;
			}
			const raw = parseData(await res.text());
			/* the number in the head has to hold up in the body, which `load` refuses if it is not a history */
			if(!raw || freshnessOf(raw) <= shownFreshness) {
				origin = 'unknown';
				showSource();
				return;
			}
			const was = origin;
			origin = 'main';
			if(!load(raw)) {
				origin = was;
				showSource();
			}
		} catch{
			/* offline or blocked: the page has a history to show, it just cannot say whether it is the current one */
			origin = 'unknown';
			showSource();
		} finally {
			adopting = false;
		}
	}
	/** how long the reader has to have done nothing before a reload they did not ask for is not in the way */
	const IDLE_ENOUGH = 45 * 1000;

	/**
	 * What the server says about `data.js` as it stands now, null if it will not say. `HEAD` is enough
	 * where it is served, and the length of the answer stands in where it is not.
	 */
	async function historyStamp() {
		for(const method of ['HEAD', 'GET']) {
			try {
				const res = await fetch('data.js', { method, cache: 'no-store' });
				if(!res.ok) {
					continue;
				}
				const tag = res.headers.get('etag') || res.headers.get('last-modified') || res.headers.get('content-length');
				if(tag) {
					return tag;
				}
				if(method === 'GET') {
					return String((await res.text()).length);
				}
			} catch{ /* offline, or a server that refuses the method, so try the next one */ }
		}
		return null;
	}

	/**
	 * A release writes a new `data.js` next to this page, which a page that has been open since yesterday
	 * does not have. The address carries the whole view, so a reload lands on the same dashboard; it still
	 * waits until the reader is not in the middle of reading something.
	 */
	/** what the page is doing about staying current, so nobody has to wonder whether it still is */
	function sayWatch(text, title) {
		ui.watchNote.textContent = text;
		ui.watchNote.title = title || '';
	}

	function watchForUpdates() {
		if(typeof fetch !== 'function' || !/^https?:$/.test(location.protocol)) {
			// opened from disk, where there is nothing to ask
			sayWatch('auto-update off', 'this page was opened from a file, so there is no server to ask');
			return;
		}
		const watching = () => sayWatch('auto-update on', 'checks every ' + Math.round(CHECK_EVERY / 60000)
			+ ' minutes, and whenever this tab comes back to the front, whether a release published a newer history');
		watching();
		let known = null, offered = false, touched = Date.now();
		for(const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll']) {
			window.addEventListener(type, () => {
				touched = Date.now();
			}, { passive: true });
		}
		const offer = () => {
			offered = true;
			/* this line takes the status bar over, so whatever was asking there is asking no more */
			clearAsk();
			const reload = dom('button', { type: 'button', className: 'reload', textContent: 'Reload' });
			reload.addEventListener('click', () => location.reload());
			ui.status.textContent = '';
			ui.status.className = 'status';
			ui.status.hidden = false;
			ui.status.append('A newer benchmark history was published. ', reload);
			sayWatch('update found', 'the page reloads itself once this tab is in the background or you have been idle');
			const idle = window.setInterval(() => {
				if(document.hidden || Date.now() - touched > IDLE_ENOUGH) {
					window.clearInterval(idle);
					location.reload();
				}
			}, 5000);
		};
		/**
		 * Main writes its history before a build of this page carries it, so it is asked as well. Not
		 * while the page is still taking a newer one on board, and not before it shows anything at all:
		 * either way it would announce a history that is already on its way.
		 */
		const mainIsAhead = async () => {
			if(adopting || !shownFreshness) {
				return false;
			}
			try {
				return await mainFreshness() > shownFreshness;
			} catch{
				return false; // main being out of reach says nothing about this page being stale
			}
		};
		const check = async () => {
			if(offered || adopting) {
				return;
			}
			const now = await historyStamp();
			if(!now) {
				sayWatch('auto-update unavailable', 'the server did not answer, so this page cannot tell whether it is current');
				return;
			}
			if((known !== null && now !== known) || await mainIsAhead()) {
				offer();
				return;
			}
			known = now;
			watching(); // an answer after a silent one says the page is looking again
		};
		void check();
		window.setInterval(() => void check(), CHECK_EVERY);
		/* coming back to the tab is the moment a stale page is most obvious */
		document.addEventListener('visibilitychange', () => {
			if(!document.hidden) {
				void check();
			}
		});
	}

	/* ---------- data ---------- */

	function validate(raw) {
		if(!raw || typeof raw !== 'object' || !raw.entries || typeof raw.entries !== 'object') {
			return null;
		}
		const entries = {};
		for(const [suite, list] of Object.entries(raw.entries)) {
			if(!Array.isArray(list)) {
				continue;
			}
			const runs = list
				.filter(r => r && typeof r === 'object' && isFinite(new Date(r.date).getTime()))
				.map(r => ({
					date:    new Date(r.date).getTime(),
					commit:  r.commit && typeof r.commit === 'object' ? r.commit : {},
					benches: Array.isArray(r.benches) ? r.benches.filter(b => b && typeof b.name === 'string') : []
				}))
				.sort((a, b) => a.date - b.date);
			if(runs.length) {
				entries[suite] = runs;
			}
		}
		S.mergeInfoSuites(entries);
		/* only now is a run complete, merging the info suite in adds measurements to it */
		for(const runs of Object.values(entries)) {
			for(const run of runs) {
				indexRun(run);
			}
		}
		return Object.keys(entries).length ? { entries, lastUpdate: raw.lastUpdate } : null;
	}

	/** the measurements by name, not enumerable so the downloads still state the run verbatim */
	function indexRun(run) {
		Object.defineProperty(run, 'by', {
			value: new Map(run.benches.map(b => [b.name, b])), configurable: true
		});
	}

	function allRuns() {
		return data.entries[selectedKey()] || [];
	}

	/** the visible tail of the history, cut by the selected time range */
	function visible() {
		const runs = allRuns();
		const months = Number(ui.range.value) || 0;
		if(!months || !runs.length) {
			return { runs, offset: 0 };
		}
		const cut = runs[runs.length - 1].date - months * MONTH;
		const offset = runs.findIndex(r => r.date >= cut);
		return offset <= 0 ? { runs, offset: 0 } : { runs: runs.slice(offset), offset };
	}

	function valueOf(run, name) {
		const b = run.by.get(name);
		const v = b ? Number(b.value) : NaN;
		return isFinite(v) ? v : null;
	}

	function rangeOf(run, name) {
		const b = run.by.get(name);
		const v = b && b.range !== undefined ? Math.abs(Number(b.range)) : NaN;
		return isFinite(v) && v > 0 ? v : null;
	}

	function extraOf(run, name) {
		const b = run.by.get(name);
		/* older runs stated a full double, which is unreadable next to a rounded value */
		return b && b.extra ? String(b.extra).replace(/\d+\.\d{3,}/g, m => Number(m).toFixed(2)) : '';
	}

	/**
	 * Every part states a second statistic in its `extra`, today the median of the files of that run.
	 * Adding those up gives the sum row a companion to its own number, as long as every part states the
	 * same kind. It is the sum of the medians, which is not the median of the sum, hence the wording.
	 */
	function extraSum(run, parts, unit, i) {
		let label = null, total = 0;
		for(const part of parts) {
			if(typeof part.values[i] !== 'number') {
				continue; // the part does not exist for this run, so it contributes nothing
			}
			const m = /^(median|mean):\s*([\d.]+)/.exec(extraOf(run, part.name));
			if(!m || (label !== null && label !== m[1])) {
				return '';
			}
			label = m[1];
			total += Number(m[2]);
		}
		return label === null ? '' : 'sum of the ' + label + 's: ' + fmt(total, unit);
	}

	/** metric name to unit, in order of first appearance, over the visible runs */
	function metricsOf(runs) {
		const out = new Map();
		for(const run of runs) {
			for(const b of run.benches) {
				if(!out.has(b.name)) {
					out.set(b.name, typeof b.unit === 'string' ? b.unit : '');
				}
			}
		}
		return out;
	}

	/** how the reader arranged the tiles, kept across visits but never required to be there */
	const collapsed = new Set();
	let order = [];
	let locked = false;

	function readStore(key, fallback) {
		try {
			return JSON.parse(localStorage.getItem(key)) ?? fallback;
		} catch{
			return fallback;
		}
	}

	function writeStore(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch{ /* private mode, the choice just does not outlive the visit */ }
	}

	/**
	 * Where the folded tiles are kept. The name carries a number: a page that starts more tiles folded
	 * than the last one did would otherwise never reach a reader who has folded anything before.
	 */
	const FOLDED_STORE = 'flowr-bench-folded-2';
	/** which sections of the sidebar the reader left open */
	const PANEL_STORE = 'flowr-bench-panels';

	/** the tiles that start folded away, the detail one only opens when looking for it */
	function foldedByDefault() {
		return S.GROUPS.filter(g => g.folded).map(g => g.id);
	}

	function loadLayout() {
		/* only a reader who folded something has a list of their own, everyone else gets the default */
		for(const id of readStore(FOLDED_STORE, null) ?? foldedByDefault()) {
			collapsed.add(String(id));
		}
		order = readStore('flowr-bench-order', []).map(String);
		locked = readStore('flowr-bench-locked', true) !== false;
	}

	/* ---------- the control panels ---------- */

	/** the sections of the sidebar, in the order they appear */
	const PANELS = ['data', 'view', 'layout', 'download'];
	/** below this width the sidebar sits above the charts, where four open sections push them off the screen */
	const NARROW = '(max-width: 900px)';

	const panelOf = id => ui['panel' + id[0].toUpperCase() + id.slice(1)];
	const digestOf = id => ui['digest' + id[0].toUpperCase() + id.slice(1)];

	function narrow() {
		return typeof window.matchMedia === 'function' && window.matchMedia(NARROW).matches;
	}

	/** which sections are open when no link and no earlier visit say otherwise */
	function panelsByDefault() {
		return narrow() ? [] : PANELS.slice();
	}

	function openPanels() {
		return PANELS.filter(id => panelOf(id).open);
	}

	function setPanels(ids) {
		for(const id of PANELS) {
			panelOf(id).open = ids.includes(id);
		}
	}

	/** whether the reader said which sections they want, which no change of the window may overrule */
	let panelsChosen = false;

	function initPanels() {
		const stored = readStore(PANEL_STORE, null);
		panelsChosen = stored !== null;
		setPanels(stored ?? panelsByDefault());
		for(const id of PANELS) {
			panelOf(id).addEventListener('toggle', () => {
				panelsChosen = true;
				writeStore(PANEL_STORE, openPanels());
				writeUrl();
				writeDigests();
			});
		}
		/* turning a phone, or dragging a window across the threshold, changes what fits */
		if(typeof window.matchMedia === 'function') {
			const watch = window.matchMedia(NARROW);
			const react = () => {
				if(!panelsChosen) {
					setPanels(panelsByDefault());
					writeDigests();
				}
			};
			if(watch.addEventListener) {
				watch.addEventListener('change', react);
			}
		}
	}

	/** a word for a choice, short enough that four of them fit next to their section title */
	function digestParts(id) {
		const range = ui.range.options[ui.range.selectedIndex];
		const win = Number(ui.smooth.value) || 1;
		switch(id) {
			case 'data':
				return [ui.suite.value, ui.engine.value, (range ? range.textContent : '').toLowerCase()];
			case 'view':
				return [
					ui.mode.value === 'delta' ? 'delta vs. last ' + (Number(ui.baseline.value) || 3) : 'absolute',
					win > 1 ? 'smoothed over ' + win : '',
					ui.band.checked ? 'band' : '',
					!ui.calibrateField.hidden && ui.calibrate.checked ? 'calibrated' : ''
				];
			case 'layout':
				return [locked ? 'locked' : 'draggable'];
			default:
				return ['JSON', 'CSV', 'data.js'];
		}
	}

	function writeDigests() {
		for(const id of PANELS) {
			digestOf(id).textContent = digestParts(id).filter(Boolean).join(' \u00b7 ');
		}
	}

	/* ---------- the view in the address ---------- */

	/** the controls that make up a view, so a link can carry the whole dashboard */
	const VALUE_KEYS = ['suite', 'engine', 'range', 'mode', 'baseline', 'smooth'];
	const CHECK_KEYS = ['band', 'calibrate', 'lock'];
	/** what the page shows when no link says otherwise, filled once the data is known */
	const defaults = {};
	let urlReady = false;

	function rememberDefaults() {
		for(const key of VALUE_KEYS) {
			defaults[key] = ui[key].value;
		}
		for(const key of CHECK_KEYS) {
			defaults[key] = ui[key].checked;
		}
	}

	/** everything the reader chose, as a hash, so the address of the page is the dashboard */
	function writeUrl() {
		if(!urlReady) {
			return;
		}
		const p = new URLSearchParams();
		for(const key of VALUE_KEYS) {
			if(ui[key].value !== defaults[key]) {
				p.set(key, ui[key].value);
			}
		}
		for(const key of CHECK_KEYS) {
			if(ui[key].checked !== defaults[key]) {
				p.set(key, ui[key].checked ? '1' : '0');
			}
		}
		if(ui.theme.value !== 'system') {
			p.set('theme', ui.theme.value);
		}
		/* the screen a dashboard fills is part of the dashboard, even if only a click can grant it */
		if(filling() || wantsFullscreen) {
			p.set('full', '1');
		}
		if(order.length) {
			p.set('order', order.join(','));
		}
		/* the default set is what a bare link already shows, only a different one is worth stating */
		const fold = [...collapsed].sort().join(',');
		if(fold !== foldedByDefault().slice().sort().join(',')) {
			p.set('folded', fold || 'none');
		}
		if(barsExpanded.size) {
			p.set('open', [...barsExpanded].join(','));
		}
		const off = S.encodeGroups(hidden);
		if(off) {
			p.set('hidden', off);
		}
		const open = openPanels();
		if(open.join(',') !== panelsByDefault().join(',')) {
			p.set('panels', open.join(',') || 'none');
		}
		const hash = p.toString();
		const next = hash ? '#' + hash : location.pathname + location.search;
		if(next !== location.hash && !(hash === '' && location.hash === '')) {
			history.replaceState(null, '', next);
		}
	}

	/** a link wins over what the last visit left behind, an empty hash changes nothing */
	function applyUrl() {
		const p = new URLSearchParams(location.hash.replace(/^#/, ''));
		for(const key of VALUE_KEYS) {
			const v = p.get(key);
			if(v === null) {
				continue;
			}
			ui[key].value = v;
			if(ui[key].value !== v) {
				ui[key].value = defaults[key]; // the link names something this data does not have
			}
		}
		for(const key of CHECK_KEYS) {
			const v = p.get(key);
			if(v !== null) {
				ui[key].checked = v !== '0';
			}
		}
		const theme = p.get('theme');
		if(theme && ['light', 'dark', 'system'].includes(theme)) {
			ui.theme.value = theme;
			setTheme(theme);
		}
		wantsFullscreen = p.get('full') === '1';
		if(p.has('order')) {
			order = p.get('order').split(',').filter(Boolean);
		}
		if(p.has('folded')) {
			collapsed.clear();
			const fold = p.get('folded');
			for(const id of fold === 'none' ? [] : fold.split(',').filter(Boolean)) {
				collapsed.add(id);
			}
		}
		if(p.has('open')) {
			barsExpanded.clear();
			for(const id of p.get('open').split(',').filter(Boolean)) {
				barsExpanded.add(id);
			}
		}
		if(p.has('hidden')) {
			hidden.clear();
			for(const [id, set] of S.decodeGroups(p.get('hidden'))) {
				hidden.set(id, set);
			}
		}
		if(p.has('panels')) {
			const open = p.get('panels');
			setPanels(open === 'none' ? [] : open.split(',').filter(Boolean));
			panelsChosen = true;
		}
		locked = ui.lock.checked;
	}

	function setCollapsed(id, on) {
		if(on) {
			collapsed.add(id);
		} else {
			collapsed.delete(id);
		}
		writeStore(FOLDED_STORE, [...collapsed]);
		renderSafe();
	}

	/** the groups in the reader's order, with anything they never moved left where it was */
	function orderedGroups() {
		const byId = new Map(S.GROUPS.map(g => [g.id, g]));
		const out = [];
		for(const id of order) {
			if(byId.has(id)) {
				out.push(byId.get(id));
				byId.delete(id);
			}
		}
		for(const group of S.GROUPS) {
			if(byId.has(group.id)) {
				out.push(group);
			}
		}
		return out;
	}

	function moveTile(from, to) {
		const ids = orderedGroups().map(g => g.id);
		const at = ids.indexOf(from);
		const before = ids.indexOf(to);
		if(at < 0 || before < 0 || at === before) {
			return;
		}
		ids.splice(before, 0, ids.splice(at, 1)[0]);
		order = ids;
		writeStore('flowr-bench-order', order);
		renderSafe();
	}

	function makeDraggable(fig, group) {
		if(locked) {
			return;
		}
		fig.setAttribute('draggable', 'true');
		fig.addEventListener('dragstart', ev => {
			fig.classList.add('dragging');
			if(ev.dataTransfer) {
				ev.dataTransfer.effectAllowed = 'move';
				ev.dataTransfer.setData('text/plain', group.id);
			}
		});
		fig.addEventListener('dragend', () => fig.classList.remove('dragging'));
		fig.addEventListener('dragover', ev => {
			ev.preventDefault();
			fig.classList.add('drop-target');
		});
		fig.addEventListener('dragleave', () => fig.classList.remove('drop-target'));
		fig.addEventListener('drop', ev => {
			ev.preventDefault();
			fig.classList.remove('drop-target');
			const from = ev.dataTransfer ? ev.dataTransfer.getData('text/plain') : '';
			if(from && from !== group.id) {
				moveTile(from, group.id);
			}
		});
	}

	function foldButton(group, on) {
		const b = dom('button', {
			type: 'button', className: 'fold' + (on ? ' open' : ''),
			title: on ? 'show this again' : 'fold this away'
		});
		b.setAttribute('aria-label', b.title);
		b.setAttribute('aria-expanded', String(!on));
		const chevron = tag('svg', { class: 'chevron', viewBox: '0 0 12 12', 'aria-hidden': 'true' });
		chevron.appendChild(tag('path', { d: 'M3 4.5 L6 8 L9 4.5' }));
		b.appendChild(chevron);
		b.addEventListener('click', () => setCollapsed(group.id, !on));
		return b;
	}

	/** the caption head: the title, its chip, and the controls of the tile */
	function captionHead(group, folded) {
		const head = dom('span', { className: 'head' }, dom('span', { className: 'title', textContent: group.title }));
		if(group.perVersion) {
			head.append(dom('span', {
				className: 'chip', title: 'a property of the flowR version, identical for every suite and engine',
				textContent: 'independent of data suite'
			}));
		}
		head.append(foldButton(group, folded));
		return dom('figcaption', {}, head);
	}

	const colors = new Map();
	/** as many colours as the stylesheet defines, one more than the largest chart has lines */
	const PALETTE = 18;
	/** the group ids whose bar breakdown is unfolded (see {@link barsOf}) */
	const barsExpanded = new Set();

	/**
	 * Every metric keeps its colour across the charts, and within one chart no two ever share one.
	 * `taken` collects what this chart already uses, so a second call adds to the first.
	 */
	function assignColors(series, taken) {
		taken = taken || new Set();
		const picked = S.pickColors(series.map(s => s.name), colors, PALETTE, taken);
		for(const s of series) {
			s.color = picked.get(s.name);
			taken.add(s.color);
			if(!colors.has(s.name)) {
				colors.set(s.name, s.color);
			}
		}
		return taken;
	}

	/** no two parts of one donut may share a colour, whatever the series behind them carry */
	function distinctParts(parts) {
		/* a part with a fixed colour, such as the muted rest of a whole, keeps it and claims nothing */
		const wanted = new Map();
		parts.forEach((p, i) => {
			if(!p.cls) {
				wanted.set(String(i), typeof p.color === 'number' ? p.color : 0);
			}
		});
		const picked = S.pickColors([...wanted.keys()], wanted, PALETTE);
		return parts.map((p, i) => p.cls ? p : { ...p, cls: 's' + picked.get(String(i)) });
	}

	/** the suite keys are `"<name>" Benchmark Suite (<engine>)`, the engine defaults to r-shell */
	function splitKey(key) {
		const name = /"([^"]+)"/.exec(key);
		const engine = /\(([^)]+)\)\s*$/.exec(key);
		return { suite: name ? name[1] : key, engine: engine ? engine[1] : 'r-shell' };
	}

	function selectedKey() {
		const keys = data ? Object.keys(data.entries) : [];
		return keys.find(k => {
			const p = splitKey(k);
			return p.suite === ui.suite.value && p.engine === ui.engine.value;
		}) || '';
	}

	function fillOptions(select, values, preferred) {
		select.textContent = '';
		for(const v of values) {
			select.appendChild(Object.assign(document.createElement('option'), { value: v, textContent: v }));
		}
		select.value = values.includes(preferred) ? preferred : values[0] || '';
	}

	/** the most realistic combination is the default */
	function fillSuiteControls(keys) {
		const parts = keys.map(splitKey);
		fillOptions(ui.suite, [...new Set(parts.map(p => p.suite))], 'real-world');
		fillOptions(ui.engine, [...new Set(parts.map(p => p.engine))], 'tree-sitter');
	}

	function calibrationMetric(runs) {
		for(const name of metricsOf(runs).keys()) {
			if(name.toLowerCase().includes('calibration')) {
				return name;
			}
		}
		return null;
	}

	/** a calibration measured this rarely, or one that never moved at all, would divide every run by the same number */
	const CALIBRATION_MIN_RUNS = 2, CALIBRATION_MIN_SPREAD = 1.001;

	/**
	 * Only a duration scales with the machine, so counts, sizes, and ratios keep their raw value
	 * and the calibration series itself stays the yardstick it is.
	 */
	function calibrates(name, unit, calib) {
		return unit === 'ms' && name !== calib;
	}

	/**
	 * The name of the calibration if dividing by it would change the picture, null otherwise: it needs
	 * at least two runs to compare and a machine that actually differed between them.
	 */
	function usableCalibration(runs, name) {
		if(!name) {
			return null;
		}
		const values = runs.map(r => valueOf(r, name)).filter(v => typeof v === 'number' && v > 0);
		if(values.length < CALIBRATION_MIN_RUNS) {
			return null;
		}
		return Math.max(...values) / Math.min(...values) >= CALIBRATION_MIN_SPREAD ? name : null;
	}

	/**
	 * Calibration first, then smoothing, then the delta against the median of the last N
	 * releases. The baseline is taken from the already normalised numbers, so it describes
	 * exactly the quantity that is plotted. The standard deviation walks the same path.
	 */
	/** the reduction measurements are ratios, so they are shown as percentages */
	function isRatio(name, unit) {
		return unit === '#' && /^reduction/i.test(String(name));
	}

	function build(runs, name, unit, factors) {
		const ratio = isRatio(name, unit);
		const scale = ratio ? 100 : 1;
		unit = ratio ? '%' : unit;
		const raw = runs.map(r => {
			const v = valueOf(r, name);
			return typeof v === 'number' ? v * scale : v;
		});
		/* a breakdown states what one release ships, so there is nothing across releases to smooth */
		const win = isBar(name) ? 1 : Number(ui.smooth.value) || 1;
		const cal = S.applyFactors(raw, factors);
		let values = S.rollingSmooth(cal, win);
		/* a spread cannot be negative, whatever a line fitted through it says at the borders */
		let err = S.rollingSmooth(S.applyFactors(runs.map(r => {
			const e = rangeOf(r, name);
			return typeof e === 'number' ? e * scale : e;
		}), factors), win).map(e => e === null ? null : Math.max(0, e));
		let baseline = null;
		if(ui.mode.value === 'delta') {
			baseline = S.baselineOf(values, Number(ui.baseline.value) || 3);
			const perCent = isFinite(baseline) && baseline !== 0 ? 100 / Math.abs(baseline) : 0;
			values = S.toPercentDelta(values, baseline);
			err = err.map(e => e === null ? null : e * perCent);
		}
		return { name, label: S.shortName(name), unit, better: S.betterOf(name, unit), raw, values, err, baseline, color: 0 };
	}

	/* ---------- formatting ---------- */

	/**
	 * How many decimals a set of values needs, so one tooltip does not mix 2.21 with 0.256. Never more
	 * than two: the third is noise of the smoothing rather than anything a run measured.
	 */
	function decimalsFor(values) {
		let max = 0;
		for(const v of values) {
			if(typeof v === 'number' && isFinite(v)) {
				max = Math.max(max, Math.abs(v));
			}
		}
		return max >= 100 ? 1 : 2;
	}

	function fmt(v, unit, decimals) {
		if(typeof v !== 'number' || !isFinite(v)) {
			return 'n/a';
		}
		const a = Math.abs(v);
		/* counters are whole things, only a value smoothed across runs can land in between */
		const s = unit === '#' ? (nearlyWhole(v) ? String(Math.round(v)) : v.toFixed(1))
			: typeof decimals === 'number' ? v.toFixed(decimals)
				: a >= 1000 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
		return unit ? s + ' ' + unit : s;
	}

	/** a count that only floating point arithmetic pushed off a whole number, such as 10.000000000000002 */
	function nearlyWhole(v) {
		return Math.abs(v - Math.round(v)) < 1e-6 * Math.max(1, Math.abs(v));
	}

	/** axis labels stay short, a tick never needs more than one decimal */
	function fmtTick(v, step) {
		if(typeof v !== 'number' || !isFinite(v)) {
			return '';
		}
		const d = Math.abs(step) >= 1 || v === 0 ? 0 : 1;
		return v.toFixed(d).replace(/\.0$/, '');
	}

	function fmtDate(ms) {
		const d = new Date(ms);
		return isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '?';
	}

	function betterText(better) {
		return better === 'down' ? 'lower is better' : better === 'up' ? 'higher is better' : '';
	}

	/* ---------- svg ---------- */

	function tag(name, attrs, text) {
		const n = document.createElementNS(NS, name);
		for(const k in attrs) {
			n.setAttribute(k, String(attrs[k]));
		}
		if(text !== undefined) {
			n.textContent = text;
		}
		return n;
	}

	const SUM_NAME = 'sum';

	/** only the phases add up to something meaningful, a sum of ratios or counters would not */
	/** the phases every analysis walks through, the ones the sum of the per-file chart adds up */
	const CORE_PHASES = ['Retrieve AST from R code', 'Normalize R AST', 'Produce dataflow information'];

	function sumSeries(group, series, n) {
		if(!['per-file', 'per-slice'].includes(group.id) || ui.mode.value === 'delta') {
			return null;
		}
		/* the later phases are optional work, so adding them in would compare different analyses */
		const parts = group.id === 'per-file' ? series.filter(s => CORE_PHASES.includes(s.name)) : series;
		if(parts.length < 2) {
			return null;
		}
		const values = [];
		for(let i = 0; i < n; i++) {
			let total = null;
			for(const s of parts) {
				if(typeof s.values[i] === 'number') {
					total = (total || 0) + s.values[i];
				}
			}
			values.push(total);
		}
		return {
			name:  SUM_NAME,
			label: SUM_NAME + ' (' + parts.map(s => s.label).join(' + ') + ')',
			/* who is in it, so a tooltip can tell a part of the sum from a series that only shares the chart */
			parts: parts.map(s => s.name),
			unit:  parts[0].unit, better: 'down', color: 'sum',
			raw:   values, values, err: values.map(() => null), baseline: null
		};
	}

	/** first and last index any of the series has a value for, null if none of them has one */
	function dataSpan(series) {
		let from = Infinity, to = -Infinity;
		for(const s of series) {
			s.values.forEach((v, i) => {
				if(v !== null) {
					from = Math.min(from, i);
					to = Math.max(to, i);
				}
			});
		}
		return from <= to ? { from, to } : null;
	}

	/** the breakdowns that are drawn as bars below the chart rather than as lines in it */
	const isBar = name => /^linting rules \(|^signature database base functions \(|^tests \(/.test(String(name));

	/** a chart only spans what it has data for, an empty stretch would just waste the axis */
	function clipToSpan(shown, series, all, runs, bumps) {
		const span = dataSpan(shown);
		if(!span) {
			return { shown, series, all, runs, bumps };
		}
		const clip = s => ({ ...s, values: s.values.slice(span.from, span.to + 1), err: s.err.slice(span.from, span.to + 1), raw: s.raw.slice(span.from, span.to + 1) });
		const cut = shown.map(clip);
		return {
			shown:  cut,
			series: series.map(s => cut.find(o => o.name === s.name) || s),
			all:    all.map(clip),
			runs:   runs.slice(span.from, span.to + 1),
			bumps:  bumps.map(b => ({ ...b, index: b.index - span.from }))
		};
	}

	/**
	 * What one plotted point is. A measurement that varies over the files or slices of a run is uploaded
	 * as their mean, with the median and the standard deviation in its `extra`; a counter is the exact
	 * number that release carries. Saying which is which is the difference between a curve one can act on
	 * and a curve one can only look at.
	 */
	function statisticOf(series, runs) {
		const extraFor = name => {
			for(let i = runs.length - 1; i >= 0; i--) {
				if(runs[i].by.has(name)) {
					return extraOf(runs[i], name);
				}
			}
			return '';
		};
		let mean = 0, exact = 0;
		for(const s of series) {
			if(s.name === SUM_NAME) {
				continue;
			}
			if(/^(mean|median):/.test(extraFor(s.name))) {
				mean++;
			} else {
				exact++;
			}
		}
		if(!mean) {
			return exact ? 'exact count per release' : '';
		}
		return mean && exact ? 'mean per release where one was measured, median on hover' : 'mean per release, median on hover';
	}

	/** what the caption says below the title: the subject, the statistic, the unit, and what is good */
	function subtitleOf(group, series, runs, isDelta) {
		const dirs = new Set(series.map(s => s.better));
		const dir = dirs.size === 1 ? betterText(series[0].better) : '';
		const units = [...new Set(series.map(s => s.unit).filter(Boolean))].join(', ');
		const statistic = group.facts ? '' : statisticOf(series, runs);
		const parts = [
			group.about,
			statistic,
			group.facts ? '' : isDelta ? 'percent against the median of the last ' + (Number(ui.baseline.value) || 3) + ' releases' : units,
			group.log && !isDelta && !group.facts ? 'logarithmic axis' : ''
		].filter(Boolean);
		const sub = dom('span', { className: 'sub', textContent: parts.join(' | ') });
		if(dir) {
			// the direction is what one looks for, so the word carries the weight
			sub.append(parts.length ? ' | ' : '', dom('b', { textContent: dir.split(' ')[0] }), dir.slice(dir.indexOf(' ')));
		}
		return sub;
	}

	/** the range the axis has to cover, `least` being the smallest value a logarithmic one can start at */
	function extentOf(shown) {
		let lo = 0, hi = 0, any = false, least = Infinity;
		for(const s of shown) {
			for(const v of s.values) {
				if(v === null) {
					continue;
				}
				any = true;
				lo = Math.min(lo, v);
				hi = Math.max(hi, v);
				if(v > 0) {
					least = Math.min(least, v);
				}
			}
		}
		return { lo, hi, any, least };
	}

	/**
	 * The ticks of a chart and the two functions that place a run and a value on it. A chart whose series
	 * differ by orders of magnitude says nothing on a linear axis, but a delta crosses zero, which no
	 * logarithm can place.
	 */
	function axisOf(group, extent, n, isDelta) {
		const log = Boolean(group.log) && !isDelta && isFinite(extent.least) && extent.lo >= 0;
		const t = log ? S.logTicks(extent.least, extent.hi) : S.ticks(extent.lo, extent.hi, 5);
		const span = log ? Math.log10(t.hi) - Math.log10(t.lo) : t.hi - t.lo;
		const place = v => log ? Math.log10(Math.min(Math.max(v, t.lo), t.hi)) - Math.log10(t.lo) : v - t.lo;
		return {
			t, log,
			x: i => PAD_L + (n < 2 ? (W - PAD_L - PAD_R) / 2 : i / (n - 1) * (W - PAD_L - PAD_R)),
			y: v => PAD_T + (1 - place(v) / (span || 1)) * (H - PAD_T - PAD_B)
		};
	}

	function drawGrid(svg, axis, isDelta) {
		for(const v of axis.t.values) {
			svg.appendChild(tag('line', { class: v === 0 ? 'zero' : 'grid', x1: PAD_L, x2: W - PAD_R, y1: axis.y(v), y2: axis.y(v) }));
			svg.appendChild(tag('text', { class: 'axis', x: PAD_L - 6, y: axis.y(v) + 3, 'text-anchor': 'end' },
				isDelta ? v.toFixed(0) + '%' : axis.log ? fmtShort(v) : fmtTick(v, axis.t.step)));
		}
	}

	/** major and minor releases, patches are too frequent to mark */
	function drawMarkers(svg, bumps, runs, axis) {
		const marks = bumps.filter(b => b.index >= 0 && b.index < runs.length).map(b => ({
			b, at: axis.x(b.index), text: b.kind === 'major' ? 'v' + b.version : b.version.replace(/\.\d+$/, '')
		}));
		// roughly five pixels per character, enough to keep the labels apart
		const fits = S.fitLabels(marks.map(m => [m.at, m.text.length * 5 + 6]));
		marks.forEach((m, k) => {
			const guide = tag('line', { class: 'marker ' + m.b.kind, x1: m.at, x2: m.at, y1: PAD_T - 6, y2: H - PAD_B });
			guide.appendChild(tag('title', {}, (m.b.kind === 'major' ? 'major release ' : 'minor release ') + m.b.version
				+ ', ' + fmtDate(runs[m.b.index].date)));
			svg.appendChild(guide);
			if(fits[k]) {
				svg.appendChild(tag('text', { class: 'axis release ' + m.b.kind, x: m.at + 3, y: PAD_T - 8 }, m.text));
			}
		});
	}

	function drawDates(svg, runs, axis) {
		const n = runs.length;
		// the newest run is what one looks at first, so it always carries its label
		for(const i of S.tickIndices(n, 6)) {
			svg.appendChild(tag('text', {
				class: 'axis', x: axis.x(i), y: H - 17, 'text-anchor': i === 0 ? 'start' : axis.x(i) > W - PAD_R - 24 ? 'end' : 'middle'
			}, S.runLabel(runs[i])));
		}
		svg.appendChild(tag('text', { class: 'axis', x: (PAD_L + W - PAD_R) / 2, y: H - 4, 'text-anchor': 'middle' },
			'version, ' + fmtDate(runs[0].date) + ' to ' + fmtDate(runs[n - 1].date)));
	}

	/**
	 * One path per stretch without holes. The error band is clipped to the axis: a standard deviation
	 * larger than the value itself is common here and would flatten every curve.
	 */
	function drawSeries(svg, shown, axis) {
		const t = axis.t;
		for(const s of shown) {
			const cls = 's' + s.color;
			for(const seg of S.segments(s.values)) {
				const pts = seg.map(i => [axis.x(i), axis.y(s.values[i])]);
				if(ui.band.checked && seg.some(i => s.err[i] !== null)) {
					const up = seg.map(i => [axis.x(i), axis.y(Math.min(t.hi, s.values[i] + (s.err[i] || 0)))]);
					const down = seg.map(i => [axis.x(i), axis.y(Math.max(t.lo, s.values[i] - (s.err[i] || 0)))]).reverse();
					svg.appendChild(tag('path', { class: 'band ' + cls, d: S.smoothPath(up) + S.smoothPath(down).replace(/^M/, 'L') + 'Z' }));
				}
				if(pts.length === 1) {
					/* a measurement only one release has cannot be a line, so it has to read as a point */
					svg.appendChild(tag('circle', { class: 'dot lone ' + cls, cx: pts[0][0], cy: pts[0][1], r: 3.6 }));
				} else {
					svg.appendChild(tag('path', { class: 'line ' + cls, d: S.smoothPath(pts) }));
				}
			}
		}
	}

	/** the guide line, a dot per series, the tooltip, and the commit behind a click */
	function wireCursor(svg, shown, runs, axis) {
		const n = runs.length;
		const cursor = tag('line', { class: 'cursor', x1: 0, x2: 0, y1: PAD_T, y2: H - PAD_B, visibility: 'hidden' });
		svg.appendChild(cursor);
		const dots = shown.map(s => {
			const d = tag('circle', { class: 'dot s' + s.color, r: 3.5, cx: 0, cy: 0, visibility: 'hidden' });
			svg.appendChild(d);
			return { s, d };
		});
		const at = ev => {
			const box = svg.getBoundingClientRect();
			const px = (ev.clientX - box.left) / (box.width || 1) * W;
			return Math.min(n - 1, Math.max(0, Math.round((px - PAD_L) / (W - PAD_L - PAD_R) * (n - 1))));
		};
		svg.addEventListener('pointermove', ev => {
			const i = at(ev);
			cursor.setAttribute('x1', String(axis.x(i)));
			cursor.setAttribute('x2', String(axis.x(i)));
			cursor.setAttribute('visibility', 'visible');
			for(const { s, d } of dots) {
				const v = s.values[i];
				d.setAttribute('visibility', v === null ? 'hidden' : 'visible');
				if(v !== null) {
					d.setAttribute('cx', String(axis.x(i)));
					d.setAttribute('cy', String(axis.y(v)));
				}
			}
			tooltip(ev, shown, runs[i], i);
		});
		svg.addEventListener('pointerleave', () => {
			cursor.setAttribute('visibility', 'hidden');
			dots.forEach(({ d }) => d.setAttribute('visibility', 'hidden'));
			ui.tooltip.hidden = true;
		});
		svg.addEventListener('click', ev => {
			if(touching()) {
				return; // a tap is how one reads a value here, the sheet carries the link instead
			}
			const url = runs[at(ev)].commit.url;
			if(url) {
				window.open(url, '_blank', 'noopener');
			}
		});
		return at;
	}

	function drawGroup(group, series, runs, bumps, all, into) {
		const isDelta = ui.mode.value === 'delta';
		const off = hidden.get(group.id) || new Set();
		const cut = clipToSpan(series.filter(s => !off.has(s.name)), series, all || series, runs, bumps);
		let shown = cut.shown;
		series = cut.series;
		all = cut.all;
		runs = cut.runs;
		bumps = cut.bumps;

		// the phases add up to the analysis, so their sum is worth a line of its own
		const sum = sumSeries(group, shown, runs.length);
		if(sum) {
			/* what the sum leaves out is still worth a line, only a quieter one than the parts that add up */
			const inSum = new Set(sum.parts);
			for(const s of shown) {
				s.outsideSum = !inSum.has(s.name);
			}
			shown = shown.concat(sum);
			series = series.concat(sum);
		}

		const fig = document.createElement('figure');
		const cap = captionHead(group, false);
		cap.appendChild(subtitleOf(group, series, runs, isDelta));
		fig.appendChild(cap);

		if(group.facts) {
			fig.appendChild(factsOf(group, all, runs)
				|| dom('p', { className: 'empty', textContent: 'no data in this range' }));
			into.appendChild(fig);
			return fig;
		}

		const extent = extentOf(shown);
		if(!extent.any) {
			fig.appendChild(dom('p', {
				className: 'empty', textContent: shown.length ? 'no data in this range' : 'all series hidden'
			}));
			fig.appendChild(legendOf(group, series, off));
			into.appendChild(fig);
			return fig;
		}

		const svg = tag('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': group.title });
		const axis = axisOf(group, extent, runs.length, isDelta);
		drawGrid(svg, axis, isDelta);
		drawMarkers(svg, bumps, runs, axis);
		drawDates(svg, runs, axis);
		drawSeries(svg, shown, axis);
		const at = wireCursor(svg, shown, runs, axis);

		fig.appendChild(svg);
		fig.appendChild(legendOf(group, series, off));
		const share = compositionOf(group, all, runs);
		if(share) {
			fig.appendChild(share);
			// the detail follows the pointer, so it always describes the run under the cursor
			const swap = swapper(share);
			svg.addEventListener('pointermove', ev => {
				const i = at(ev);
				swap(() => compositionOf(group, all, runs, i));
			});
			svg.addEventListener('pointerleave', () => swap(() => compositionOf(group, all, runs)));
		}
		into.appendChild(fig);
		return fig;
	}

	/** the breakdowns drawn as bars: parts of a whole that overlap, so a pie would lie about them */
	const BARS = {
		/* a linting rule usually carries several tags */
		features: {
			parent: 'linting rules', part: /^linting rules \((.*)\)$/, label: t => S.tagLabel(t),
			more:   'tags', note: 'rules per tag as of '
		},
		/* a function record carries as many of these as it has information for */
		sigdb: {
			parent: 'signature database base functions', part: /^signature database base functions \((.*)\)$/, label: t => t,
			more:   'kinds of information', note: 'what a base-R entry carries as of '
		},
		/* a test may cover several parts of the analysis */
		tests: {
			parent: 'tests overall', part: /^tests \((.*)\)$/, label: t => t,
			more:   'parts', note: 'labeled tests per part as of ', top: 7,
			link:   { href: 'https://github.com/flowr-analysis/flowr/wiki/Capabilities', text: 'capabilities' }
		}
	};

	/**
	 * The bars of one run. `lead` is the colour class of the donut they stand next to: the bars break down
	 * the same thing it does, so a colour of their own would read as a second, unrelated quantity.
	 */
	function barsOf(group, series, runs, at, lead) {
		const spec = BARS[group.id];
		if(!spec) {
			return null;
		}
		const i = at === undefined || at < 0 || at >= runs.length ? runs.length - 1 : at;
		const parent = series.find(s => s.name === spec.parent);
		const cls = lead || 's' + (parent ? parent.color : 0);
		const tags = series
			.map(s => ({ part: spec.part.exec(s.name), value: s.values[i] }))
			.filter(t => t.part && typeof t.value === 'number' && t.value > 0)
			.map(t => ({ label: spec.label(t.part[1]), value: t.value }))
			.sort((a, b) => b.value - a.value);
		if(!tags.length) {
			return null;
		}
		const max = tags[0].value || 1;
		const box = dom('div', { className: 'composition tags' });
		const top = spec.top || 3;
		const shownTags = barsExpanded.has(group.id) ? tags : tags.slice(0, top);
		const list = dom('ul');
		const whole = parent && typeof parent.values[i] === 'number' ? parent.values[i] : 0;
		shownTags.forEach((entry, rank) => {
			const share = whole > 0 ? (entry.value / whole * 100).toFixed(1) + '% of ' + fmtFact(whole, '#') : '';
			const name = dom('span', { className: 'tag-name', textContent: entry.label });
			const bar = dom('span', { className: 'tag-bar ' + cls });
			bar.style.width = (entry.value / max * 100) + '%';
			/* one colour, fading down the ranking, so the order reads without turning into a second palette */
			bar.style.opacity = String(Math.max(0.4, 1 - rank * 0.6 / Math.max(1, shownTags.length - 1)).toFixed(2));
			const track = dom('span', { className: 'tag-track' }, bar);
			const value = dom('span', { className: 'tag-value', textContent: fmtFact(entry.value, '#') });
			/* the release and its date belong to every bar, the share only where there is a whole */
			for(const cell of [name, track, value]) {
				noteTooltip(cell, {
					run: runs[i], color: cls, label: entry.label,
					value: fmtFact(entry.value, '#'),
					notes: [share, spec.note.replace(/ as of $/, ''), 'as of ' + S.runLabel(runs[i]) + ', ' + fmtDate(runs[i].date)]
						.filter(Boolean)
				});
			}
			list.appendChild(dom('li', {}, name, track, value));
		});
		box.appendChild(list);
		const foot = dom('div', { className: 'tags-foot' });
		if(tags.length > top) {
			const open = barsExpanded.has(group.id);
			const chevron = tag('svg', { class: 'chevron', viewBox: '0 0 12 12', 'aria-hidden': 'true' });
			chevron.appendChild(tag('path', { d: 'M3 4.5 L6 8 L9 4.5' }));
			const more = dom('button', { type: 'button', className: 'unfold' + (open ? ' open' : '') },
				chevron, open ? 'show the top ' + top : 'all ' + tags.length + ' ' + spec.more);
			more.setAttribute('aria-expanded', String(open));
			more.addEventListener('click', () => {
				if(open) {
					barsExpanded.delete(group.id);
				} else {
					barsExpanded.add(group.id);
				}
				writeUrl();
				replaceNode(box, barsOf(group, series, runs, at, lead));
			});
			foot.appendChild(more);
		}
		const note = dom('p', {
			className: 'note', textContent: spec.note + S.runLabel(runs[i]) + ' (' + fmtDate(runs[i].date) + ')'
		});
		if(spec.link) {
			note.append(', see the ', dom('a', {
				href: spec.link.href, textContent: spec.link.text, target: '_blank', rel: 'noopener'
			}));
		}
		foot.appendChild(note);
		box.appendChild(foot);
		return box;
	}

	/** the arc of a donut slice, from one fraction of the circle to the next */
	function slicePath(from, to, cx, cy, outer, inner) {
		const a = f => 2 * Math.PI * f - Math.PI / 2;
		const p = (r, f) => [cx + r * Math.cos(a(f)), cy + r * Math.sin(a(f))];
		const large = to - from > 0.5 ? 1 : 0;
		const [x1, y1] = p(outer, from), [x2, y2] = p(outer, to);
		const [x3, y3] = p(inner, to), [x4, y4] = p(inner, from);
		return 'M' + x1 + ' ' + y1 + 'A' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2
			+ 'L' + x3 + ' ' + y3 + 'A' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + x4 + ' ' + y4 + 'Z';
	}

	/** a count short enough for the middle of a donut, so millions do not overflow it */
	function fmtShort(v) {
		const a = Math.abs(v);
		return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? Math.round(v / 1e3) + 'k' : String(Math.round(v));
	}

	/** the parts of a whole as a donut plus a legend, the parts must not overlap or the shares would lie */
	function donutOf(parts, total, aria, runs, at) {
		const box = dom('div', { className: 'composition' });
		/* what the bars beside this donut take their colour from, see {@link barsOf} */
		box.dataset.lead = parts.length ? parts[0].cls : '';
		/* the number in the middle means nothing without the thing it counts */
		box.appendChild(dom('p', { className: 'note subject', textContent: aria }));
		const svg = tag('svg', { viewBox: '0 0 120 120', class: 'donut', role: 'img', 'aria-label': aria });
		svg.appendChild(tag('title', {}, fmtShort(total) + ' ' + aria));
		let from = 0;
		for(const part of parts) {
			const to = from + part.value / total;
			const path = tag('path', { class: 'slice ' + part.cls, d: slicePath(from, to, 60, 60, 55, 32) });
			path.appendChild(tag('title', {}, part.label + ': ' + part.value + ' of ' + total));
			svg.appendChild(path);
			from = to;
		}
		svg.appendChild(tag('text', { class: 'donut-center', x: 60, y: 64, 'text-anchor': 'middle' }, fmtShort(total)));
		box.appendChild(svg);

		const list = dom('ul');
		for(const part of parts) {
			list.appendChild(dom('li', {}, dom('span', { className: 'swatch ' + part.cls }),
				part.label + ': ' + fmtShort(part.value) + ' (' + (part.value / total * 100).toFixed(0) + '%)'));
		}
		box.append(list, dom('p', {
			className: 'note', textContent: 'as of ' + S.runLabel(runs[at]) + ', ' + fmtDate(runs[at].date)
		}));
		return box;
	}

	/** the value a series carries at `at`, null if it has none there */
	function valueAt(series, name, at) {
		const s = series.find(x => x.name === name);
		const v = s ? s.values[at] : null;
		return typeof v === 'number' ? v : null;
	}

	function builtinDonut(series, runs, at) {
		const total = valueAt(series, 'built-in definitions', at);
		const def = valueAt(series, 'built-in definitions (default handler)', at);
		const own = valueAt(series, 'built-in definitions (own handler)', at);
		if(!total || def === null || own === null) {
			return null;
		}
		const rest = Math.max(0, total - def - own);
		const parts = distinctParts([
			{ label: 'default handler', value: def, color: series.find(x => x.name.includes('default handler'))?.color ?? 0 },
			{ label: 'own handler', value: own, color: series.find(x => x.name.includes('own handler'))?.color ?? 1 },
			{ label: 'constants and replacements', value: rest, cls: 'ssum' }
		].filter(p => p.value > 0));
		return donutOf(parts, total, 'built-in definitions by kind of handler', runs, at);
	}

	/**
	 * Every function record the database stores sits in exactly one bundle, so the kinds of bundle do
	 * partition them. The packages do not, they are described by several kinds at once, so they get no donut.
	 */
	function splitDonut(series, runs, at, part, aria) {
		const parts = distinctParts(series
			.map(s => ({ m: part.exec(s.name), s }))
			.filter(p => p.m && typeof p.s.values[at] === 'number' && p.s.values[at] > 0)
			.map(p => ({ label: p.m[1], value: p.s.values[at], color: p.s.color })));
		const total = parts.reduce((a, p) => a + p.value, 0);
		return total ? donutOf(parts, total, aria, runs, at) : null;
	}

	/** the groups that state their numbers instead of plotting them, see {@link factsOf} */
	const FACTS = {
		sigdb: {
			lead: [
				['signature database package versions', 'package versions'],
				['signature database packages', 'packages'],
				['signature database functions', 'functions']
			],
			rest: [
				['signature database base functions', 'base R functions'],
				['signature database base parameters', 'base R parameters'],
				['signature database size', 'size']
			],
			splits: [
				[/^signature database functions \((.*)\)$/, 'function records per kind of bundle']
			],
			track:   'signature database',
			history: 'database'
		},
		tests: {
			lead: [['tests overall', 'tests in total'], ['tests', 'of them labeled', true]],
			rest: [],
			splits: [],
			trend: 'tests overall',
			track: null
		}
	};

	/** the history of one stated number, zero based, so the tile also shows how it got there */
	function timelineOf(s, runs, color, onPick, mark) {
		const w = 300, h = 40, padX = 4, padT = 5, padB = 11;
		const points = s.values.map((v, i) => [i, v]).filter(p => typeof p[1] === 'number');
		if(points.length < 1) {
			return null;
		}
		const hi = Math.max(...points.map(p => p[1]), 0) || 1;
		const last = s.values.length - 1;
		const x = i => padX + (last < 1 ? (w - 2 * padX) / 2 : i / last * (w - 2 * padX));
		const y = v => h - padB - v / hi * (h - padT - padB);
		const box = document.createElement('div');
		box.className = 'timeline';
		const svg = tag('svg', { class: 's' + (color === undefined ? s.color : color), viewBox: '0 0 ' + w + ' ' + h, role: 'img',
			'aria-label': 'how ' + s.name + ' developed over the releases' });
		svg.appendChild(tag('line', { class: 'timeline-base', x1: padX, y1: h - padB, x2: w - padX, y2: h - padB }));
		/* the same releases the charts mark, so a stated number sits on the same timeline as a measured one */
		for(const b of S.releaseBumps(runs)) {
			if(b.index >= 0 && b.index <= last) {
				const guide = tag('line', {
					class: 'timeline-marker ' + b.kind, x1: x(b.index), x2: x(b.index), y1: padT - 2, y2: h - padB
				});
				guide.appendChild(tag('title', {}, (b.kind === 'major' ? 'major release ' : 'minor release ') + b.version
					+ ', ' + fmtDate(runs[b.index].date)));
				svg.appendChild(guide);
			}
		}
		for(const seg of S.segments(s.values)) {
			const pts = seg.map(i => [x(i), y(s.values[i])]);
			if(pts.length > 1) {
				svg.appendChild(tag('path', { class: 'timeline-area',
					d: S.smoothPath(pts) + 'L' + pts[pts.length - 1][0] + ' ' + (h - padB) + 'L' + pts[0][0] + ' ' + (h - padB) + 'Z' }));
			}
			svg.appendChild(tag('path', { class: 'timeline-line', d: S.smoothPath(pts) }));
		}
		const at = points.find(p => p[0] === mark) || points[points.length - 1];
		svg.appendChild(tag('circle', { class: 'timeline-dot', cx: x(at[0]), cy: y(at[1]), r: 2.2 }));
		const first = points[0], final = points[points.length - 1];
		svg.appendChild(tag('text', { class: 'timeline-tick', x: x(first[0]), y: h - 3 }, S.runLabel(runs[first[0]])));
		if(final[0] !== first[0]) {
			svg.appendChild(tag('text', { class: 'timeline-tick', x: x(final[0]), y: h - 3, 'text-anchor': 'end' },
				S.runLabel(runs[final[0]])));
		}
		const nearest = ev => {
			const rect = svg.getBoundingClientRect();
			const px = (ev.clientX - rect.left) / (rect.width || 1) * w;
			const i = Math.round((px - padX) / (w - 2 * padX) * Math.max(1, last));
			return points.reduce((best, p) => Math.abs(p[0] - i) < Math.abs(best[0] - i) ? p : best, points[0])[0];
		};
		/* the sparkline is a chart too, so it answers the pointer with the run it is over */
		svg.addEventListener('pointermove', ev => {
			const i = nearest(ev);
			if(onPick) {
				onPick(i);
			}
			showNote(ev, {
				run: runs[i], color: color === undefined ? s.color : color, label: s.label || s.name,
				value: fmtFact(s.values[i], s.unit), notes: [s.name === (s.label || s.name) ? '' : s.name]
			});
		});
		svg.addEventListener('pointerleave', () => {
			if(onPick) {
				onPick(undefined);
			}
			ui.tooltip.hidden = true;
		});
		svg.classList.add('pickable');
		box.appendChild(svg);
		return box;
	}

	function fmtFact(v, unit) {
		if(unit === 'KiB') {
			return v >= 1024 ? (v / 1024).toFixed(1) + ' MiB' : Math.round(v) + ' KiB';
		}
		return Math.round(v).toLocaleString('en-US');
	}

	/**
	 * Indices of the runs at which the group started to state something else, i.e. the releases that shipped a
	 * new database. Two releases that state exactly the same numbers are one state, so they are merged into one
	 * point, and the tracked value alone would call a rebuild that changed nothing a new state.
	 */
	function rebuilds(series, name) {
		const tracked = series.filter(s => s.name === name || s.name.startsWith(name));
		const use = tracked.length ? tracked : series;
		/* the raw numbers, so neither the delta nor the smoothing turns every run into a state of its own */
		return S.stateChanges(use.map(s => s.raw));
	}

	/** the rebuild points as buttons, so one can step through what every database version held */
	function historyOf(group, series, runs, at, spec, box) {
		const points = spec.track ? rebuilds(series, spec.track) : [];
		if(points.length === 0) {
			return null;
		}
		const row = document.createElement('div');
		row.className = 'history';
		row.appendChild(Object.assign(document.createElement('span'), { className: 'note', textContent: spec.history || 'version' }));
		const current = points.filter(i => i <= at).pop();
		const show = i => replaceNode(box, factsOf(group, series, runs, i));
		/** a point spans from its own release up to the one before the next point */
		const spanOf = i => {
			const last = points[points.indexOf(i) + 1];
			const upTo = runs[(last === undefined ? runs.length : last) - 1];
			const label = S.runLabel(runs[i]);
			const end = S.runLabel(upTo);
			return {
				label: label === end ? label : label + ' to ' + end,
				title: label === end ? fmtDate(runs[i].date) : fmtDate(runs[i].date) + ' to ' + fmtDate(upTo.date)
			};
		};
		// a handful of steps read best as buttons, a long history only fits into a list
		if(points.length > 6) {
			const select = document.createElement('select');
			select.className = 'point-select';
			for(const i of points) {
				const span = spanOf(i);
				const option = Object.assign(document.createElement('option'), {
					value: String(i), textContent: span.label, title: span.title
				});
				option.selected = i === current;
				select.appendChild(option);
			}
			select.addEventListener('change', () => show(Number(select.value)));
			row.appendChild(select);
			row.appendChild(Object.assign(document.createElement('span'), {
				className: 'note', textContent: points.length + ' states'
			}));
			return row;
		}
		for(const i of points) {
			const span = spanOf(i);
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'point' + (i === current ? ' on' : '');
			b.textContent = span.label;
			b.title = span.title;
			b.addEventListener('click', () => show(i));
			row.appendChild(b);
		}
		return row;
	}

	/**
	 * Stated numbers of one run, as `[series name, label, always]` rows. A row is skipped where the run
	 * carries no number for it, unless it is marked `always`, which states the gap instead of hiding it.
	 */
	function factGrid(series, rows, at, cls) {
		const dl = dom('dl', { className: cls });
		for(const [name, label, always] of rows || []) {
			const s = series.find(x => x.name === name);
			const v = s ? s.values[at] : null;
			if(typeof v !== 'number' && !always) {
				continue;
			}
			const known = typeof v === 'number';
			dl.append(dom('dt', {
				textContent: known ? fmtFact(v, s.unit) : 'n/a',
				className:   known ? '' : 'missing',
				title:       known ? '' : 'this release did not record the number'
			}), dom('dd', { textContent: label }));
		}
		return dl.children.length ? dl : null;
	}

	/**
	 * A quantity that only moves when it is rebuilt says nothing as a curve. This states the numbers of the
	 * newest run instead, with a donut per split and the releases that changed them.
	 */
	function factsOf(group, series, runs, at) {
		const spec = FACTS[group.id];
		if(!spec || !runs.length) {
			return null;
		}
		at = at === undefined || at < 0 || at >= runs.length ? runs.length - 1 : at;
		const box = document.createElement('div');
		box.className = 'facts';
		const lead = factGrid(series, spec.lead, at, 'lead');
		if(!lead) {
			return null;
		}
		box.appendChild(lead);
		const rest = factGrid(series, spec.rest, at, 'rest');
		if(rest) {
			box.appendChild(rest);
		}
		const trend = spec.trend ? series.find(x => x.name === spec.trend) : null;
		const barParent = BARS[group.id] ? series.find(x => x.name === BARS[group.id].parent) : undefined;
		const swap = swapper(box);
		const timeline = trend ? timelineOf(trend, runs, barParent ? barParent.color : undefined,
			i => swap(() => factsOf(group, series, runs, i)), at) : null;
		if(timeline) {
			box.appendChild(timeline);
		}
		const splits = dom('div', { className: 'splits' });
		let leadColor = '';
		for(const [part, aria] of spec.splits) {
			const donut = splitDonut(series, runs, at, part, aria);
			if(donut) {
				leadColor = leadColor || donut.dataset.lead;
				splits.appendChild(donut);
			}
		}
		if(splits.children.length) {
			box.appendChild(splits);
		}
		const bars = barsOf(group, series, runs, at, leadColor);
		if(bars) {
			box.appendChild(bars);
		}
		const history = historyOf(group, series, runs, at, spec, box);
		if(history) {
			box.appendChild(history);
		}
		return box;
	}

	/**
	 * A group whose numbers are a whole made of parts, which a line chart does not show.
	 * The donut and the bars state the composition of the newest run in the range.
	 */
	function compositionOf(group, series, runs, at) {
		if(!runs.length) {
			return null;
		}
		at = at === undefined || at < 0 || at >= runs.length ? runs.length - 1 : at;
		const donut = group.id === 'builtins' ? builtinDonut(series, runs, at) : null;
		const bars = barsOf(group, series, runs, at);
		if(!donut) {
			return bars;
		}
		if(!bars) {
			return donut;
		}
		const box = document.createElement('div');
		box.appendChild(donut);
		box.appendChild(bars);
		return box;
	}

	function legendOf(group, series, off) {
		const box = dom('div', { className: 'legend' });
		for(const s of series) {
			const b = dom('button', {
				type: 'button', className: off.has(s.name) ? 'off' : '',
				title: [s.name, s.unit, betterText(s.better)].filter(Boolean).join(', ') + '. Click to toggle.'
			}, dom('span', { className: 'swatch s' + s.color }), s.label || s.name);
			b.addEventListener('click', () => {
				const set = hidden.get(group.id) || new Set();
				if(set.has(s.name)) {
					set.delete(s.name);
				} else {
					set.add(s.name);
				}
				hidden.set(group.id, set);
				renderSafe();
			});
			box.appendChild(b);
		}
		return box;
	}

	/** how many series a sheet on a phone states before it would cover the chart */
	const TOUCH_ROWS = 5;

	/** a finger covers what it points at, and a phone has no room next to it either */
	function touching() {
		return typeof window.matchMedia === 'function'
			&& (window.matchMedia('(pointer: coarse)').matches || window.matchMedia(NARROW).matches);
	}

	function placeTooltip(ev) {
		const t = ui.tooltip;
		t.hidden = false;
		if(touching()) {
			// a sheet at the bottom of the screen, out of the way of the hand
			t.classList.add('sheet');
			t.style.left = '';
			t.style.top = '';
			return;
		}
		t.classList.remove('sheet');
		const box = t.getBoundingClientRect();
		t.style.left = Math.min(window.innerWidth - box.width - 8, Math.max(8, ev.clientX + 16)) + 'px';
		t.style.top = Math.min(window.innerHeight - box.height - 8, Math.max(8, ev.clientY + 16)) + 'px';
	}

	/** the run every row below it describes */
	function tipHead(run) {
		return dom('div', { className: 'head', textContent: S.runLabel(run) + ' | ' + fmtDate(run.date) });
	}

	/** a colour is either the index a series was given or the class a breakdown already carries */
	function swatchClass(color) {
		return 'swatch ' + (typeof color === 'number' ? 's' + color : color);
	}

	/** one row: the colour of the series, what it is called, and what it says */
	function tipRow(color, label, value, title, faint) {
		const cell = typeof value === 'string' ? { textContent: value } : { textContent: value.text, className: value.cls || '' };
		return dom('tr',
			{ className: faint ? 'faint' : '' }, dom('td', {}, dom('span', { className: swatchClass(color) })),
			dom('td', { className: 'name', textContent: label, title: title || '' }),
			dom('td', cell));
	}

	/** the same panel and the same layout the charts use, so a breakdown answers as fast and reads the same */
	function showNote(ev, spec) {
		const t = ui.tooltip;
		t.textContent = '';
		t.append(tipHead(spec.run), dom('table', {}, tipRow(spec.color, spec.label, spec.value)));
		for(const line of spec.notes.filter(Boolean)) {
			t.append(dom('div', { className: 'msg', textContent: line }));
		}
		placeTooltip(ev);
	}

	function noteTooltip(node, spec) {
		node.addEventListener('pointerenter', ev => showNote(ev, spec));
		node.addEventListener('pointermove', ev => {
			if(!ui.tooltip.hidden) {
				placeTooltip(ev);
			}
		});
		node.addEventListener('pointerleave', () => {
			ui.tooltip.hidden = true;
		});
	}

	function tooltip(ev, series, run, i) {
		const t = ui.tooltip;
		const isDelta = ui.mode.value === 'delta';
		t.textContent = '';
		t.appendChild(tipHead(run));

		// what a phase takes of its chart, the sum row being the whole rather than a part of it
		const parts = series.filter(s => s.name !== SUM_NAME);
		/* a chart may carry series the sum leaves out, and a reader adding the rows up should see which */
		const outside = s => Boolean(s.outsideSum);
		const chartSum = parts.reduce((a, s) => a + (typeof s.values[i] === 'number' ? Math.abs(s.values[i]) : 0), 0);

		// one precision for the whole tooltip, so the values can be compared at a glance
		const decimals = decimalsFor(series.map(s => s.values[i]));

		// the rows follow the lines, the highest value on top
		const sorted = series.slice().sort((a, b) => {
			const av = typeof a.values[i] === 'number' ? a.values[i] : -Infinity;
			const bv = typeof b.values[i] === 'number' ? b.values[i] : -Infinity;
			return bv - av;
		});
		/* a sheet on a phone may not grow past the chart it explains, so it states the largest series only */
		const brief = touching();
		const rows = brief ? sorted.slice(0, TOUCH_ROWS) : sorted;

		const table = document.createElement('table');
		for(const s of rows) {
			const v = s.values[i];
			let val;
			if(v === null) {
				val = { text: 'n/a', cls: 'msg' };
			} else if(isDelta) {
				val = {
					text: (v > 0 ? '+' : '') + v.toFixed(2) + '%',
					cls:  s.better === 'flat' || Math.abs(v) < 0.05 ? '' : (v > 0) === (s.better === 'up') ? 'good' : 'bad'
				};
			} else {
				val = { text: fmt(v, s.unit, decimals) };
			}
			/* the labels are short forms, the measurement they stand for is one hover away */
			table.appendChild(tipRow(s.color, s.label || s.name, val, s.name, outside(s)));
			const extra = s.name === SUM_NAME ? extraSum(run, parts.filter(o => !outside(o)), s.unit, i) : extraOf(run, s.name);
			const raw = s.raw[i];
			const share = !isDelta && v !== null && chartSum > 0 && parts.length > 1 && s.name !== SUM_NAME
				? (Math.abs(v) / chartSum * 100).toFixed(1) + '% of this chart' : '';
			const note = brief ? '' : [
				isDelta && raw !== null ? 'raw ' + fmt(raw, s.unit) : '',
				raw !== null && s.values[i] !== null && !isDelta && Math.abs(raw - s.values[i]) > 1e-9 ? 'raw ' + fmt(raw, s.unit) : '',
				share,
				extra
			].filter(Boolean).join(', ');
			if(note) {
				const td = dom('td', { className: 'msg', textContent: note });
				td.colSpan = 2;
				table.appendChild(dom('tr', { className: outside(s) ? 'faint' : '' }, dom('td'), td));
			}
		}
		t.appendChild(table);
		if(sorted.length > rows.length) {
			t.append(dom('div', { className: 'msg', textContent: (sorted.length - rows.length) + ' smaller series not shown' }));
		}

		/* one line, whatever its length: a title that wraps pushes the numbers around as the pointer moves */
		t.append(dom('div', {
			className: 'msg commit', title: S.commitTitle(run.commit.message),
			textContent: String(run.commit.id || '').slice(0, 8) + ' ' + S.commitTitle(run.commit.message)
		}));
		if(!brief) {
			/* the panel sits on the chart it belongs to, so naming it again says nothing */
			t.append(dom('div', { className: 'msg', textContent: 'click to open the commit' }));
		} else if(run.commit.url) {
			/* a tap on the chart reads values, so the commit needs a target of its own */
			t.append(dom('a', {
				className: 'msg open-commit', href: run.commit.url, target: '_blank', rel: 'noopener',
				textContent: 'open the commit'
			}));
		}

		placeTooltip(ev);
	}

	/* ---------- downloads ---------- */

	function download(name, text, type) {
		const url = URL.createObjectURL(new Blob([text], { type }));
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function slug(s) {
		return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
	}

	function downloadCsv() {
		const { runs } = visible();
		const names = [...metricsOf(runs).keys()];
		const head = ['version', 'date', 'commit', ...names];
		const rows = runs.map(r => [
			S.runLabel(r), new Date(r.date).toISOString(), String(r.commit.id || ''),
			...names.map(nm => {
				const v = valueOf(r, nm);
				return v === null ? '' : String(v);
			})
		]);
		const esc = c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
		download(slug(selectedKey()) + '.csv', [head, ...rows].map(r => r.map(esc).join(',')).join('\n'), 'text/csv');
	}

	/* ---------- render ---------- */

	/** the release this page is about, which is the one a reader looks for before anything else */
	function showLatest(run) {
		if(!run) {
			ui.latest.hidden = true;
			return;
		}
		const label = S.runLabel(run);
		const name = run.commit.url
			? dom('a', { className: 'version', href: run.commit.url, textContent: label, target: '_blank', rel: 'noopener' })
			: dom('span', { className: 'version', textContent: label });
		/* the line has room for the number and no more, so the rest of what it says waits for a hover */
		name.title = 'newest release, ' + fmtDate(run.date) + ': ' + S.commitTitle(run.commit.message);
		ui.latest.hidden = false;
		ui.latest.replaceChildren(name);
	}

	/**
	 * What decides which tiles the page has and in which order, as opposed to what they draw. A redraw
	 * that leaves this alone is one the reader should not see arriving, see the `rise` animation.
	 */
	function layoutKey() {
		return [selectedKey(), ui.range.value, ui.mode.value, orderedGroups().map(g => g.id).join(','),
			[...collapsed].sort().join(','), S.encodeGroups(hidden)].join('|');
	}

	let drawnLayout = null;

	/**
	 * Draws every tile into a fragment and puts that in place of the old ones in one step. Emptying the
	 * charts first and filling them afterwards collapses the page to nothing in between, which a slider
	 * one drags turns into a flicker and a jumping scroll position.
	 */
	function render() {
		writeUrl();
		writeDigests();
		const { runs, offset } = visible();
		const frame = document.createDocumentFragment();
		ui.baselineField.hidden = ui.mode.value !== 'delta';
		ui.baselineOut.textContent = ui.baseline.value;
		const win = Number(ui.smooth.value) || 1;
		ui.smoothOut.textContent = win === 1 ? 'off' : win + ' runs';

		const all = allRuns();
		if(!runs.length) {
			ui.rangeNote.textContent = selectedKey() ? 'No runs in this range.' : 'This suite was not measured with this engine.';
			/* whatever the range hides, the header must not go on naming a release of the suite before */
			showLatest(all[all.length - 1]);
			ui.charts.replaceChildren(dom('p', { className: 'empty', textContent: 'No runs in this range.' }));
			return;
		}
		ui.rangeNote.textContent = runs.length + ' of ' + all.length + ' runs, ' + fmtDate(runs[0].date) + ' to ' + fmtDate(runs[runs.length - 1].date) + '.';
		showLatest(all[all.length - 1]);

		const calib = usableCalibration(runs, calibrationMetric(runs));
		ui.calibrateField.hidden = !calib;
		ui.calibrationNote.hidden = !calib;
		/* the box keeps its state while it is away, so a suite that carries a calibration again is normalised again */
		if(calib) {
			ui.calibrationNote.textContent = 'A fixed synthetic workload runs in the same CI job, so "' + calib
				+ '" measures how fast or loaded that machine was. Dividing the timings by it cancels the machine out, '
				+ 'while counts, sizes, and ratios stay as measured.';
		}

		const factors = calib && ui.calibrate.checked ? S.calibrationFactors(runs.map(r => valueOf(r, calib))) : null;
		const bumps = S.releaseBumps(all).map(b => ({ ...b, index: b.index - offset }))
			.filter(b => b.index >= 0 && b.index < runs.length);


		const metrics = metricsOf(runs);
		if(!metrics.size) {
			ui.charts.replaceChildren(dom('p', { className: 'empty', textContent: 'These runs carry no measurements.' }));
			return;
		}
		const folded = [];
		for(const group of orderedGroups()) {
			const series = [];
			for(const [name, unit] of metrics) {
				if(S.groupOf(name, unit) === group.id) {
					series.push(build(runs, name, unit, calibrates(name, unit, calib) ? factors : null));
				}
			}
			const lines = series.filter(s => !isBar(s.name));
			/* the lines pick their colours first, so a long breakdown never pushes two of them together */
			const taken = assignColors(lines);
			assignColors(series.filter(s => isBar(s.name)), taken);
			if(!lines.length) {
				continue;
			}
			if(collapsed.has(group.id)) {
				folded.push(group);
			} else {
				makeDraggable(drawGroup(group, lines, runs, bumps, series, frame), group);
			}
		}
		// the folded tiles sit as chips in one row at the end, so they cost a line rather than a column
		if(folded.length) {
			const row = dom('div', { className: 'folded-row' });
			for(const group of folded) {
				const fig = dom('figure', { className: 'folded' }, captionHead(group, true));
				row.appendChild(fig);
				makeDraggable(fig, group);
			}
			frame.appendChild(row);
		}
		/* only a tile the reader did not have before is worth animating in */
		const key = layoutKey();
		if(key !== drawnLayout) {
			for(const node of frame.children) {
				node.classList.add('rise');
			}
			drawnLayout = key;
		}
		ui.charts.replaceChildren(frame);
	}

	let pending = false;
	function renderSafe() {
		if(pending) {
			return;
		}
		// coalesce slider drags into one draw per frame
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			try {
				render();
			} catch(e) {
				say('Something went wrong while drawing the charts: ' + e, true);
			}
		});
	}

	/* ---------- start ---------- */

	function start(raw) {
		try {
			load(raw);
		} catch(e) {
			say('data.js could not be read: ' + e, true);
		}
	}

	/** what the history on the page is and where it came from */
	function showSource() {
		if(!data) {
			ui.sourceNote.textContent = '';
			ui.sourceNote.title = '';
			return;
		}
		const [what, why] = ORIGINS[origin] || ORIGINS.shipped;
		ui.sourceNote.textContent = Object.keys(data.entries).length + ' suites'
			+ (data.lastUpdate ? ', last update ' + fmtDate(data.lastUpdate) : '') + ', ' + what;
		ui.sourceNote.title = why;
	}

	/** puts a history on the page, or leaves the one that is already there if this is not one */
	function load(raw) {
		const next = validate(raw);
		if(!next) {
			if(!data) {
				say('data.js could not be read, it should assign window.BENCHMARK_DATA with an "entries" object.', true);
			}
			return false;
		}
		data = next;
		shownFreshness = freshnessOf(raw);
		/* a history that did load answers whatever complaint was on the page about one that did not */
		if(ui.status.classList.contains('bad')) {
			say('');
		}
		fillSuiteControls(Object.keys(data.entries));
		// the defaults are only known once the suites are, and a link wins over them
		rememberDefaults();
		applyUrl();
		ui.lock.checked = locked;
		urlReady = true;
		showSource();
		offerFullscreen();
		renderSafe();
		return true;
	}

	for(const input of [ui.mode, ui.baseline, ui.smooth, ui.band, ui.calibrate, ui.suite, ui.engine, ui.range]) {
		input.addEventListener('input', () => {
			if(input === ui.suite || input === ui.engine || input === ui.range) {
				hidden.clear();
			}
			renderSafe();
		});
	}
	ui.dlSuite.addEventListener('click', () => download(slug(ui.suite.value) + '.json',
		JSON.stringify({ suite: ui.suite.value, entries: allRuns() }, null, 2), 'application/json'));
	ui.dlAll.addEventListener('click', () => download('data.js',
		'window.BENCHMARK_DATA = ' + JSON.stringify(window.BENCHMARK_DATA, null, 2) + ';\n', 'text/javascript'));
	ui.dlCsv.addEventListener('click', downloadCsv);

	initTheme();
	initFullscreen();
	initPanels();
	watchForUpdates();
	loadLayout();
	ui.lock.checked = locked;
	ui.lock.addEventListener('change', () => {
		locked = ui.lock.checked;
		writeStore('flowr-bench-locked', locked);
		renderSafe();
	});
	ui.resetLayout.addEventListener('click', () => {
		collapsed.clear();
		for(const id of foldedByDefault()) {
			collapsed.add(id);
		}
		order = [];
		barsExpanded.clear();
		writeStore(FOLDED_STORE, [...collapsed]);
		writeStore('flowr-bench-order', []);
		renderSafe();
	});
	ui.copyLink.addEventListener('click', () => {
		writeUrl();
		const link = location.href;
		const done = () => {
			say('The link to this view is in the clipboard.');
			setTimeout(() => say(''), 4000);
		};
		if(navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(link).then(done, () => say('The link could not be copied: ' + link, true));
		} else {
			say('Copy this link: ' + link, true);
		}
	});

	/* a finger never leaves a chart, so a tap anywhere else puts the sheet away */
	document.addEventListener('pointerdown', ev => {
		const t = ui.tooltip;
		if(t.hidden || !t.classList.contains('sheet')) {
			return;
		}
		if(!t.contains(ev.target) && !(ev.target instanceof Element && ev.target.closest('#charts svg'))) {
			t.hidden = true;
		}
	}, true);

	/* a pasted link, or the back button, has to arrive at the view it names */
	window.addEventListener('hashchange', () => {
		if(!data) {
			return;
		}
		applyUrl();
		ui.lock.checked = locked;
		/* the link may newly ask for the screen, which is nothing to do behind the reader's back */
		offerFullscreen();
		renderSafe();
	});

	if(!S) {
		say('stats.js did not load, so the charts cannot be drawn.', true);
		return;
	}

	if(window.BENCHMARK_DATA) {
		start(window.BENCHMARK_DATA);
	} else {
		say('No benchmark data found next to this page, data.js is missing. Looking on main instead.', true);
	}
	/* the page is drawn from what it shipped with first, and only then asks main whether it has newer */
	void adoptNewer().then(() => {
		if(!data) {
			say('No benchmark data found next to this page, and main did not answer with any either.', true);
		}
	});
})();
