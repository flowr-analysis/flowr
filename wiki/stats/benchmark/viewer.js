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
		'fullscreen']) {
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
		} catch{ /* private mode, keep going */ }
	}

	function initTheme() {
		let stored = 'system';
		try {
			stored = localStorage.getItem('flowr-bench-theme') || 'system';
		} catch{ /* ignore */ }
		ui.theme.value = ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
		setTheme(ui.theme.value);
		ui.theme.addEventListener('change', () => {
			setTheme(ui.theme.value);
			writeUrl();
		});
	}

	/** the whole page, so a dashboard can fill a screen of its own */
	function initFullscreen() {
		if(!document.documentElement.requestFullscreen) {
			ui.fullscreen.remove();
			return;
		}
		const sync = () => {
			const on = Boolean(document.fullscreenElement);
			ui.fullscreen.textContent = on ? 'Leave fullscreen' : 'Fullscreen';
			ui.fullscreen.setAttribute('aria-pressed', String(on));
		};
		ui.fullscreen.addEventListener('click', () => {
			const step = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
			Promise.resolve(step).catch(e => say('The browser refused to switch the fullscreen: ' + e, true));
		});
		document.addEventListener('fullscreenchange', sync);
		sync();
	}

	function say(text, bad) {
		ui.status.textContent = text;
		ui.status.className = 'status' + (bad ? ' bad' : '');
		ui.status.hidden = !text;
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
		return Object.keys(entries).length ? { entries, lastUpdate: raw.lastUpdate } : null;
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
		const b = run.benches.find(x => x.name === name);
		const v = b ? Number(b.value) : NaN;
		return isFinite(v) ? v : null;
	}

	function rangeOf(run, name) {
		const b = run.benches.find(x => x.name === name);
		const v = b && b.range !== undefined ? Math.abs(Number(b.range)) : NaN;
		return isFinite(v) && v > 0 ? v : null;
	}

	function extraOf(run, name) {
		const b = run.benches.find(x => x.name === name);
		/* older runs stated a full double, which is unreadable next to a rounded value */
		return b && b.extra ? String(b.extra).replace(/\d+\.\d{4,}/g, m => Number(m).toFixed(3)) : '';
	}

	/**
	 * The parts state a second number in their `extra`, the median or the mean of the files of that run.
	 * Summing them gives the sum row the same figure, as long as every part states the same kind.
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
		return label === null ? '' : label + ': ' + fmt(total, unit);
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

	/** the tiles that start folded away, the detail one only opens when looking for it */
	function foldedByDefault() {
		return S.GROUPS.filter(g => g.folded).map(g => g.id);
	}

	function loadLayout() {
		/* only a reader who folded something has a list of their own, everyone else gets the default */
		for(const id of readStore('flowr-bench-collapsed', null) ?? foldedByDefault()) {
			collapsed.add(String(id));
		}
		order = readStore('flowr-bench-order', []).map(String);
		locked = readStore('flowr-bench-locked', true) !== false;
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
		if(order.length) {
			p.set('order', order.join(','));
		}
		if(collapsed.size) {
			p.set('folded', [...collapsed].join(','));
		}
		if(barsExpanded.size) {
			p.set('open', [...barsExpanded].join(','));
		}
		const off = S.encodeGroups(hidden);
		if(off) {
			p.set('hidden', off);
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
		if(p.has('order')) {
			order = p.get('order').split(',').filter(Boolean);
		}
		if(p.has('folded')) {
			collapsed.clear();
			for(const id of p.get('folded').split(',').filter(Boolean)) {
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
		locked = ui.lock.checked;
	}

	function setCollapsed(id, on) {
		if(on) {
			collapsed.add(id);
		} else {
			collapsed.delete(id);
		}
		writeStore('flowr-bench-collapsed', [...collapsed]);
		render();
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
		render();
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
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'fold' + (on ? ' open' : '');
		b.title = on ? 'show this again' : 'fold this away';
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
		const cap = document.createElement('figcaption');
		const head = document.createElement('span');
		head.className = 'head';
		head.appendChild(Object.assign(document.createElement('span'), { className: 'title', textContent: group.title }));
		if(group.perVersion) {
			head.appendChild(Object.assign(document.createElement('span'), {
				className: 'chip', title: 'a property of the flowR version, identical for every suite and engine',
				textContent: 'independent of data suite'
			}));
		}
		head.appendChild(foldButton(group, folded));
		cap.appendChild(head);
		return cap;
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

	/** a calibration this flat, or measured this rarely, would divide every run by the same number */
	const CALIBRATION_MIN_RUNS = 5, CALIBRATION_MIN_SPREAD = 1.05;

	/**
	 * The name of the calibration if dividing by it would change the picture, null otherwise: it needs
	 * several runs to compare and a machine that actually differed between them.
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
		const win = Number(ui.smooth.value) || 1;
		const cal = S.applyFactors(raw, factors);
		let values = S.rollingMedian(cal, win);
		let err = S.rollingMedian(S.applyFactors(runs.map(r => {
			const e = rangeOf(r, name);
			return typeof e === 'number' ? e * scale : e;
		}), factors), win);
		let baseline = null;
		if(ui.mode.value === 'delta') {
			baseline = S.baselineOf(values, Number(ui.baseline.value) || 3);
			const scale = isFinite(baseline) && baseline !== 0 ? 100 / Math.abs(baseline) : 0;
			values = S.toPercentDelta(values, baseline);
			err = err.map(e => e === null ? null : e * scale);
		}
		return { name, label: S.shortName(name), unit, better: S.betterOf(name, unit), raw, values, err, baseline, color: 0 };
	}

	/* ---------- formatting ---------- */

	/** how many decimals a set of values needs, so one tooltip does not mix 2.21 with 0.256 */
	function decimalsFor(values) {
		let max = 0;
		for(const v of values) {
			if(typeof v === 'number' && isFinite(v)) {
				max = Math.max(max, Math.abs(v));
			}
		}
		return max >= 100 ? 1 : max >= 1 ? 2 : 3;
	}

	function fmt(v, unit, decimals) {
		if(typeof v !== 'number' || !isFinite(v)) {
			return 'n/a';
		}
		const a = Math.abs(v);
		/* counters are whole things, only a median between two runs can land in between */
		const s = unit === '#' ? (Number.isInteger(v) ? String(v) : v.toFixed(1))
			: typeof decimals === 'number' ? v.toFixed(decimals)
				: a >= 1000 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toFixed(3);
		return unit ? s + ' ' + unit : s;
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
	const CORE_PHASES = ['Retrieve AST from R code', 'Normalize R AST', 'Produce dataflow information',
		'Extract control flow graph'];

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

	function drawGroup(group, series, runs, bumps, all) {
		all = all || series;
		const isDelta = ui.mode.value === 'delta';
		const off = hidden.get(group.id) || new Set();
		let shown = series.filter(s => !off.has(s.name));

		// a chart only spans what it has data for, an empty stretch would just waste the axis
		const span = dataSpan(shown);
		if(span) {
			runs = runs.slice(span.from, span.to + 1);
			bumps = bumps.map(b => ({ ...b, index: b.index - span.from }));
			const clip = s => ({ ...s, values: s.values.slice(span.from, span.to + 1), err: s.err.slice(span.from, span.to + 1), raw: s.raw.slice(span.from, span.to + 1) });
			shown = shown.map(clip);
			series = series.map(s => shown.find(o => o.name === s.name) || s);
			all = all.map(clip);
		}

		// the phases add up to the analysis, so their sum is worth a line of its own
		const sum = sumSeries(group, shown, runs.length);
		if(sum) {
			shown = shown.concat(sum);
			series = series.concat(sum);
		}

		const fig = document.createElement('figure');
		const cap = captionHead(group, false);
		const dirs = new Set(series.map(s => s.better));
		const dir = dirs.size === 1 ? betterText(series[0].better) : '';
		const units = [...new Set(series.map(s => s.unit).filter(Boolean))].join(', ');
		const sub = Object.assign(document.createElement('span'), { className: 'sub' });
		const parts = [
			group.about,
			group.facts ? '' : isDelta ? 'percent against the median of the last ' + (Number(ui.baseline.value) || 3) + ' releases' : units,
			group.log && !isDelta && !group.facts ? 'logarithmic axis' : ''
		].filter(Boolean);
		sub.textContent = parts.join(' | ');
		if(dir) {
			sub.appendChild(document.createTextNode(parts.length ? ' | ' : ''));
			// the direction is what one looks for, so the word carries the weight
			sub.appendChild(Object.assign(document.createElement('b'), { textContent: dir.split(' ')[0] }));
			sub.appendChild(document.createTextNode(dir.slice(dir.indexOf(' '))));
		}
		cap.appendChild(sub);
		fig.appendChild(cap);

		if(group.facts) {
			const panel = factsOf(group, all, runs);
			fig.appendChild(panel || Object.assign(document.createElement('p'), {
				className: 'empty', textContent: 'no data in this range'
			}));
			ui.charts.appendChild(fig);
			return fig;
		}

		// the axis follows the lines, the error band is clipped to it. A standard deviation
		// larger than the value itself is common here and would flatten every curve.
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
		const svg = tag('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': group.title });
		if(!any) {
			fig.appendChild(Object.assign(document.createElement('p'), {
				className: 'empty', textContent: shown.length ? 'no data in this range' : 'all series hidden'
			}));
			fig.appendChild(legendOf(group, series, off));
			ui.charts.appendChild(fig);
			return fig;
		}

		// a chart whose series differ by orders of magnitude says nothing on a linear axis, but a delta
		// crosses zero, which no logarithm can place
		const log = Boolean(group.log) && !isDelta && isFinite(least) && lo >= 0;
		const t = log ? S.logTicks(least, hi) : S.ticks(lo, hi, 5);
		const n = runs.length;
		const x = i => PAD_L + (n < 2 ? (W - PAD_L - PAD_R) / 2 : i / (n - 1) * (W - PAD_L - PAD_R));
		const axisSpan = log ? Math.log10(t.hi) - Math.log10(t.lo) : t.hi - t.lo;
		const place = v => log ? Math.log10(Math.min(Math.max(v, t.lo), t.hi)) - Math.log10(t.lo) : v - t.lo;
		const y = v => PAD_T + (1 - place(v) / (axisSpan || 1)) * (H - PAD_T - PAD_B);

		for(const v of t.values) {
			svg.appendChild(tag('line', { class: v === 0 ? 'zero' : 'grid', x1: PAD_L, x2: W - PAD_R, y1: y(v), y2: y(v) }));
			svg.appendChild(tag('text', { class: 'axis', x: PAD_L - 6, y: y(v) + 3, 'text-anchor': 'end' },
				isDelta ? v.toFixed(0) + '%' : log ? fmtShort(v) : fmtTick(v, t.step)));
		}

		// major and minor releases, patches are too frequent to mark
		const marks = bumps.filter(b => b.index >= 0 && b.index < n).map(b => ({
			b, at: x(b.index), text: b.kind === 'major' ? 'v' + b.version : b.version.replace(/\.\d+$/, '')
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

		// the newest run is what one looks at first, so it always carries its label
		for(const i of S.tickIndices(n, 6)) {
			svg.appendChild(tag('text', {
				class: 'axis', x: x(i), y: H - 17, 'text-anchor': i === 0 ? 'start' : x(i) > W - PAD_R - 24 ? 'end' : 'middle'
			}, S.runLabel(runs[i])));
		}
		svg.appendChild(tag('text', { class: 'axis', x: (PAD_L + W - PAD_R) / 2, y: H - 4, 'text-anchor': 'middle' },
			'version, ' + fmtDate(runs[0].date) + ' to ' + fmtDate(runs[n - 1].date)));

		shown.forEach(s => {
			const cls = 's' + s.color;
			for(const seg of S.segments(s.values)) {
				const pts = seg.map(i => [x(i), y(s.values[i])]);
				if(ui.band.checked && seg.some(i => s.err[i] !== null)) {
					const up = seg.map(i => [x(i), y(Math.min(t.hi, s.values[i] + (s.err[i] || 0)))]);
					const down = seg.map(i => [x(i), y(Math.max(t.lo, s.values[i] - (s.err[i] || 0)))]).reverse();
					svg.appendChild(tag('path', { class: 'band ' + cls, d: S.smoothPath(up) + S.smoothPath(down).replace(/^M/, 'L') + 'Z' }));
				}
				if(pts.length === 1) {
					/* a measurement only one release has cannot be a line, so it has to read as a point */
					svg.appendChild(tag('circle', { class: 'dot lone ' + cls, cx: pts[0][0], cy: pts[0][1], r: 3.6 }));
				} else {
					svg.appendChild(tag('path', { class: 'line ' + cls, d: S.smoothPath(pts) }));
				}
			}
		});

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
			cursor.setAttribute('x1', String(x(i)));
			cursor.setAttribute('x2', String(x(i)));
			cursor.setAttribute('visibility', 'visible');
			for(const { s, d } of dots) {
				const v = s.values[i];
				d.setAttribute('visibility', v === null ? 'hidden' : 'visible');
				if(v !== null) {
					d.setAttribute('cx', String(x(i)));
					d.setAttribute('cy', String(y(v)));
				}
			}
			tooltip(ev, group, shown, runs[i], i);
		});
		const leave = () => {
			cursor.setAttribute('visibility', 'hidden');
			dots.forEach(({ d }) => d.setAttribute('visibility', 'hidden'));
			ui.tooltip.hidden = true;
		};
		svg.addEventListener('pointerleave', leave);
		svg.addEventListener('click', ev => {
			const url = runs[at(ev)].commit.url;
			if(url) {
				window.open(url, '_blank', 'noopener');
			}
		});

		fig.appendChild(svg);
		fig.appendChild(legendOf(group, series, off));
		let share = compositionOf(group, all, runs);
		if(share) {
			fig.appendChild(share);
			// the detail follows the pointer, so it always describes the run under the cursor
			svg.addEventListener('mousemove', ev => {
				const next = compositionOf(group, all, runs, at(ev));
				if(next) {
					fig.replaceChild(next, share);
					share = next;
				}
			});
			svg.addEventListener('mouseleave', () => {
				const back = compositionOf(group, all, runs);
				if(back) {
					fig.replaceChild(back, share);
					share = back;
				}
			});
		}
		ui.charts.appendChild(fig);
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

	function barsOf(group, series, runs, at) {
		const spec = BARS[group.id];
		if(!spec) {
			return null;
		}
		const i = at === undefined || at < 0 || at >= runs.length ? runs.length - 1 : at;
		/* the bars break down one series, so they carry its colour */
		const parent = series.find(s => s.name === spec.parent);
		const tags = series
			.map(s => ({ part: spec.part.exec(s.name), value: s.values[i] }))
			.filter(t => t.part && typeof t.value === 'number' && t.value > 0)
			.map(t => ({ label: spec.label(t.part[1]), value: t.value }))
			.sort((a, b) => b.value - a.value);
		if(!tags.length) {
			return null;
		}
		const max = tags[0].value || 1;
		const box = document.createElement('div');
		box.className = 'composition tags';
		const top = spec.top || 3;
		const shownTags = barsExpanded.has(group.id) ? tags : tags.slice(0, top);
		const list = document.createElement('ul');
		const whole = parent && typeof parent.values[i] === 'number' ? parent.values[i] : 0;
		shownTags.forEach((tag, rank) => {
			const li = document.createElement('li');
			const share = whole > 0 ? (tag.value / whole * 100).toFixed(1) + '% of ' + fmtFact(whole, '#') : '';
			const name = Object.assign(document.createElement('span'), { className: 'tag-name', textContent: tag.label });
			li.appendChild(name);
			const bar = document.createElement('span');
			bar.className = 'tag-bar s' + (parent ? parent.color : 0);
			bar.style.width = (tag.value / max * 100) + '%';
			/* one colour, fading down the ranking, so the order reads without turning into a second palette */
			bar.style.opacity = String(Math.max(0.4, 1 - rank * 0.6 / Math.max(1, shownTags.length - 1)).toFixed(2));
			const track = document.createElement('span');
			track.className = 'tag-track';
			track.appendChild(bar);
			li.appendChild(track);
			const value = Object.assign(document.createElement('span'), { className: 'tag-value', textContent: String(tag.value) });
			li.appendChild(value);
			/* the release and its date belong to every bar, the share only where there is a whole */
			for(const cell of [name, track, value]) {
				noteTooltip(cell, {
					run: runs[i], color: parent ? parent.color : 0, label: tag.label,
					value: fmtFact(tag.value, '#'),
					notes: [share, spec.note.replace(/ as of $/, ''), 'as of ' + S.runLabel(runs[i]) + ', ' + fmtDate(runs[i].date)]
						.filter(Boolean)
				});
			}
			list.appendChild(li);
		});
		box.appendChild(list);
		const foot = document.createElement('div');
		foot.className = 'tags-foot';
		if(tags.length > top) {
			const open = barsExpanded.has(group.id);
			const more = document.createElement('button');
			more.type = 'button';
			more.className = 'unfold' + (open ? ' open' : '');
			more.setAttribute('aria-expanded', String(open));
			const chevron = tag('svg', { class: 'chevron', viewBox: '0 0 12 12', 'aria-hidden': 'true' });
			chevron.appendChild(tag('path', { d: 'M3 4.5 L6 8 L9 4.5' }));
			more.appendChild(chevron);
			more.appendChild(document.createTextNode(open ? 'show the top ' + top : 'all ' + tags.length + ' ' + spec.more));
			more.addEventListener('click', () => {
				if(open) {
					barsExpanded.delete(group.id);
				} else {
					barsExpanded.add(group.id);
				}
				writeUrl();
				const next = barsOf(group, series, runs, at);
				if(next && box.parentNode) {
					box.parentNode.replaceChild(next, box);
				}
			});
			foot.appendChild(more);
		}
		const note = Object.assign(document.createElement('p'), {
			className: 'note', textContent: spec.note + S.runLabel(runs[i]) + ' (' + fmtDate(runs[i].date) + ')'
		});
		if(spec.link) {
			note.appendChild(document.createTextNode(', see the '));
			note.appendChild(Object.assign(document.createElement('a'), {
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
		const box = document.createElement('div');
		box.className = 'composition';
		/* the number in the middle means nothing without the thing it counts */
		box.appendChild(Object.assign(document.createElement('p'), { className: 'note subject', textContent: aria }));
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

		const list = document.createElement('ul');
		for(const part of parts) {
			const li = document.createElement('li');
			const dot = document.createElement('span');
			dot.className = 'swatch ' + part.cls;
			li.appendChild(dot);
			li.appendChild(document.createTextNode(part.label + ': ' + fmtShort(part.value) + ' (' + (part.value / total * 100).toFixed(0) + '%)'));
			list.appendChild(li);
		}
		const caption = document.createElement('p');
		caption.className = 'note';
		caption.textContent = 'as of ' + S.runLabel(runs[at]) + ', ' + fmtDate(runs[at].date);
		box.appendChild(list);
		box.appendChild(caption);
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
		if(onPick) {
			const nearest = ev => {
				const rect = svg.getBoundingClientRect();
				const px = (ev.clientX - rect.left) / (rect.width || 1) * w;
				const i = Math.round((px - padX) / (w - 2 * padX) * Math.max(1, last));
				return points.reduce((best, p) => Math.abs(p[0] - i) < Math.abs(best[0] - i) ? p : best, points[0])[0];
			};
			svg.addEventListener('pointermove', ev => onPick(nearest(ev)));
			svg.addEventListener('pointerleave', () => onPick(undefined));
			svg.classList.add('pickable');
		}
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
		const show = i => {
			const next = factsOf(group, series, runs, i);
			if(next && box.parentNode) {
				box.parentNode.replaceChild(next, box);
			}
		};
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
		const dl = document.createElement('dl');
		dl.className = cls;
		for(const [name, label, always] of rows || []) {
			const s = series.find(x => x.name === name);
			const v = s ? s.values[at] : null;
			if(typeof v !== 'number' && !always) {
				continue;
			}
			const dt = Object.assign(document.createElement('dt'), {
				textContent: typeof v === 'number' ? fmtFact(v, s.unit) : 'n/a'
			});
			if(typeof v !== 'number') {
				dt.className = 'missing';
				dt.title = 'this release did not record the number';
			}
			dl.appendChild(dt);
			dl.appendChild(Object.assign(document.createElement('dd'), { textContent: label }));
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
		const timeline = trend ? timelineOf(trend, runs, barParent ? barParent.color : undefined, i => {
			const next = factsOf(group, series, runs, i);
			if(next && box.parentNode) {
				box.parentNode.replaceChild(next, box);
			}
		}, at) : null;
		if(timeline) {
			box.appendChild(timeline);
		}
		const splits = document.createElement('div');
		splits.className = 'splits';
		for(const [part, aria] of spec.splits) {
			const donut = splitDonut(series, runs, at, part, aria);
			if(donut) {
				splits.appendChild(donut);
			}
		}
		if(splits.children.length) {
			box.appendChild(splits);
		}
		const bars = barsOf(group, series, runs, at);
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
		const box = document.createElement('div');
		box.className = 'legend';
		series.forEach(s => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = off.has(s.name) ? 'off' : '';
			b.title = [s.name, s.unit, betterText(s.better)].filter(Boolean).join(', ') + '. Click to toggle.';
			const sw = document.createElement('span');
			sw.className = 'swatch s' + s.color;
			b.appendChild(sw);
			b.appendChild(document.createTextNode(s.label || s.name));
			b.addEventListener('click', () => {
				const set = hidden.get(group.id) || new Set();
				if(set.has(s.name)) {
					set.delete(s.name);
				} else {
					set.add(s.name);
				}
				hidden.set(group.id, set);
				render();
			});
			box.appendChild(b);
		});
		return box;
	}

	function placeTooltip(ev) {
		const t = ui.tooltip;
		t.hidden = false;
		const box = t.getBoundingClientRect();
		t.style.left = Math.min(window.innerWidth - box.width - 8, Math.max(8, ev.clientX + 16)) + 'px';
		t.style.top = Math.min(window.innerHeight - box.height - 8, Math.max(8, ev.clientY + 16)) + 'px';
	}

	/** the same panel and the same layout the charts use, so a breakdown answers as fast and reads the same */
	function noteTooltip(node, spec) {
		node.addEventListener('pointerenter', ev => {
			const t = ui.tooltip;
			t.textContent = '';
			t.appendChild(Object.assign(document.createElement('div'), {
				className: 'head', textContent: S.runLabel(spec.run) + ' | ' + fmtDate(spec.run.date)
			}));
			const table = document.createElement('table');
			const tr = document.createElement('tr');
			const sw = document.createElement('td');
			const dot = document.createElement('span');
			dot.className = 'swatch s' + spec.color;
			sw.appendChild(dot);
			tr.appendChild(sw);
			tr.appendChild(Object.assign(document.createElement('td'), { className: 'name', textContent: spec.label }));
			tr.appendChild(Object.assign(document.createElement('td'), { textContent: spec.value }));
			table.appendChild(tr);
			t.appendChild(table);
			for(const line of spec.notes) {
				t.appendChild(Object.assign(document.createElement('div'), { className: 'msg', textContent: line }));
			}
			placeTooltip(ev);
		});
		node.addEventListener('pointermove', ev => {
			if(!ui.tooltip.hidden) {
				placeTooltip(ev);
			}
		});
		node.addEventListener('pointerleave', () => {
			ui.tooltip.hidden = true;
		});
	}

	function tooltip(ev, group, series, run, i) {
		const t = ui.tooltip;
		const isDelta = ui.mode.value === 'delta';
		t.textContent = '';
		t.appendChild(Object.assign(document.createElement('div'), {
			className: 'head', textContent: S.runLabel(run) + ' | ' + fmtDate(run.date)
		}));

		// what a phase takes of its chart, the sum row being the whole rather than a part of it
		const parts = series.filter(s => s.name !== SUM_NAME);
		const chartSum = parts.reduce((a, s) => a + (typeof s.values[i] === 'number' ? Math.abs(s.values[i]) : 0), 0);

		// one precision for the whole tooltip, so the values can be compared at a glance
		const decimals = decimalsFor(series.map(s => s.values[i]));

		// the rows follow the lines, the highest value on top
		const rows = series.slice().sort((a, b) => {
			const av = typeof a.values[i] === 'number' ? a.values[i] : -Infinity;
			const bv = typeof b.values[i] === 'number' ? b.values[i] : -Infinity;
			return bv - av;
		});

		const table = document.createElement('table');
		for(const s of rows) {
			const v = s.values[i];
			const tr = document.createElement('tr');
			const sw = document.createElement('td');
			const dot = document.createElement('span');
			dot.className = 'swatch s' + s.color;
			sw.appendChild(dot);
			tr.appendChild(sw);
			/* the labels are short forms, the measurement they stand for is one hover away */
			tr.appendChild(Object.assign(document.createElement('td'), {
				className: 'name', textContent: s.label || s.name, title: s.name
			}));
			const val = document.createElement('td');
			if(v === null) {
				val.textContent = 'n/a';
				val.className = 'msg';
			} else if(isDelta) {
				val.textContent = (v > 0 ? '+' : '') + v.toFixed(2) + '%';
				val.className = s.better === 'flat' || Math.abs(v) < 0.05 ? ''
					: (v > 0) === (s.better === 'up') ? 'good' : 'bad';
			} else {
				val.textContent = fmt(v, s.unit, decimals);
			}
			tr.appendChild(val);
			table.appendChild(tr);
			const extra = s.name === SUM_NAME ? extraSum(run, series.filter(o => o.name !== SUM_NAME), s.unit, i) : extraOf(run, s.name);
			const raw = s.raw[i];
			const share = !isDelta && v !== null && chartSum > 0 && parts.length > 1 && s.name !== SUM_NAME
				? (Math.abs(v) / chartSum * 100).toFixed(1) + '% of this chart' : '';
			const note = [
				isDelta && raw !== null ? 'raw ' + fmt(raw, s.unit) : '',
				raw !== null && s.values[i] !== null && !isDelta && Math.abs(raw - s.values[i]) > 1e-9 ? 'raw ' + fmt(raw, s.unit) : '',
				share,
				extra
			].filter(Boolean).join(', ');
			if(note) {
				const nr = document.createElement('tr');
				nr.appendChild(document.createElement('td'));
				const td = Object.assign(document.createElement('td'), { className: 'msg', textContent: note });
				td.colSpan = 2;
				nr.appendChild(td);
				table.appendChild(nr);
			}
		}
		t.appendChild(table);

		const msg = String(run.commit.message || '').split('\n')[0];
		t.appendChild(Object.assign(document.createElement('div'), {
			className:   'msg',
			textContent: String(run.commit.id || '').slice(0, 8) + ' ' + (msg.length > 80 ? msg.slice(0, 80) + '...' : msg)
		}));
		t.appendChild(Object.assign(document.createElement('div'), { className: 'msg', textContent: group.title + ', click to open the commit' }));

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

	function render() {
		writeUrl();
		const { runs, offset } = visible();
		ui.charts.textContent = '';
		ui.baselineField.hidden = ui.mode.value !== 'delta';
		ui.baselineOut.textContent = ui.baseline.value;
		const win = Number(ui.smooth.value) || 1;
		ui.smoothOut.textContent = win === 1 ? 'off' : win + ' runs';

		if(!runs.length) {
			ui.rangeNote.textContent = selectedKey() ? 'No runs in this range.' : 'This suite was not measured with this engine.';
			ui.charts.appendChild(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'No runs in this range.' }));
			return;
		}
		const all = allRuns();
		ui.rangeNote.textContent = runs.length + ' of ' + all.length + ' runs, ' + fmtDate(runs[0].date) + ' to ' + fmtDate(runs[runs.length - 1].date) + '.';

		const calib = usableCalibration(runs, calibrationMetric(runs));
		ui.calibrateField.hidden = !calib;
		ui.calibrationNote.hidden = !calib;
		if(!calib) {
			ui.calibrate.checked = false;
		} else {
			ui.calibrationNote.textContent = 'A fixed synthetic workload runs in the same CI job, so "' + calib
				+ '" measures how fast or loaded that machine was. Dividing the other series by it cancels the machine out.';
		}

		const factors = calib && ui.calibrate.checked ? S.calibrationFactors(runs.map(r => valueOf(r, calib))) : null;
		const bumps = S.releaseBumps(all).map(b => ({ ...b, index: b.index - offset }))
			.filter(b => b.index >= 0 && b.index < runs.length);


		const metrics = metricsOf(runs);
		if(!metrics.size) {
			ui.charts.appendChild(Object.assign(document.createElement('p'), {
				className: 'empty', textContent: 'These runs carry no measurements.'
			}));
			return;
		}
		const folded = [];
		for(const group of orderedGroups()) {
			const series = [];
			for(const [name, unit] of metrics) {
				if(S.groupOf(name, unit) === group.id) {
					series.push(build(runs, name, unit, name === calib ? null : factors));
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
				makeDraggable(drawGroup(group, lines, runs, bumps, series), group);
			}
		}
		// the folded tiles sit as chips in one row at the end, so they cost a line rather than a column
		if(folded.length) {
			const row = document.createElement('div');
			row.className = 'folded-row';
			for(const group of folded) {
				const fig = document.createElement('figure');
				fig.className = 'folded';
				fig.appendChild(captionHead(group, true));
				row.appendChild(fig);
				makeDraggable(fig, group);
			}
			ui.charts.appendChild(row);
		}
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

	function load(raw) {
		data = validate(raw);
		if(!data) {
			say('data.js could not be read, it should assign window.BENCHMARK_DATA with an "entries" object.', true);
			return;
		}
		fillSuiteControls(Object.keys(data.entries));
		// the defaults are only known once the suites are, and a link wins over them
		rememberDefaults();
		applyUrl();
		ui.lock.checked = locked;
		urlReady = true;
		const suites = Object.keys(data.entries);
		ui.sourceNote.textContent = suites.length + ' suites'
			+ (data.lastUpdate ? ', last update ' + fmtDate(data.lastUpdate) : '');
		renderSafe();
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
	loadLayout();
	ui.lock.checked = locked;
	ui.lock.addEventListener('change', () => {
		locked = ui.lock.checked;
		writeStore('flowr-bench-locked', locked);
		render();
	});
	ui.resetLayout.addEventListener('click', () => {
		collapsed.clear();
		for(const id of foldedByDefault()) {
			collapsed.add(id);
		}
		order = [];
		barsExpanded.clear();
		writeStore('flowr-bench-collapsed', [...collapsed]);
		writeStore('flowr-bench-order', []);
		render();
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

	/* a pasted link, or the back button, has to arrive at the view it names */
	window.addEventListener('hashchange', () => {
		if(!data) {
			return;
		}
		applyUrl();
		ui.lock.checked = locked;
		renderSafe();
	});

	if(!S) {
		say('stats.js did not load, so the charts cannot be drawn.', true);
		return;
	}

	if(window.BENCHMARK_DATA) {
		start(window.BENCHMARK_DATA);
	} else {
		say('No benchmark data found next to this page, data.js is missing.', true);
	}
})();
