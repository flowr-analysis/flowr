'use strict';

/**
 * Pure helpers for the benchmark viewer.
 * Loaded as a plain script in the browser and required from node for the self test.
 */
(function(root) {
	const num = v => typeof v === 'number' && isFinite(v) ? v : null;

	/** median of the finite numbers in `values`, NaN if there are none */
	function median(values) {
		const clean = [];
		for(const v of values || []) {
			if(num(v) !== null) {
				clean.push(v);
			}
		}
		if(clean.length === 0) {
			return NaN;
		}
		clean.sort((a, b) => a - b);
		const mid = clean.length >> 1;
		return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
	}

	/**
	 * Rolling median over a centered window, clipped at the borders.
	 * Holes stay holes so a metric that did not exist yet does not grow a fake value.
	 */
	function rollingMedian(values, window) {
		const w = Math.max(1, Math.floor(window || 1));
		if(w <= 1) {
			return values.slice();
		}
		const half = Math.floor(w / 2);
		return values.map((v, i) => {
			if(num(v) === null) {
				return null;
			}
			const m = median(values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1)));
			return isFinite(m) ? m : null;
		});
	}

	/** the fitted value at `at` of the weighted least squares line through the points, null if there is none */
	function weightedLine(xs, ys, ws, at) {
		let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
		for(let k = 0; k < xs.length; k++) {
			const w = ws[k];
			if(!(w > 0)) {
				continue;
			}
			sw += w;
			sx += w * xs[k];
			sy += w * ys[k];
			sxx += w * xs[k] * xs[k];
			sxy += w * xs[k] * ys[k];
		}
		if(!(sw > 0)) {
			return null;
		}
		const det = sw * sxx - sx * sx;
		if(!isFinite(det) || Math.abs(det) < 1e-12) {
			return sy / sw; // the window carries no slope, so its weighted mean is all it says
		}
		const slope = (sw * sxy - sx * sy) / det;
		return (sy - slope * sx) / sw + slope * at;
	}

	/**
	 * One smoothed point, fitted from the releases within `half` of it. The weight of a release falls off
	 * with its distance (tricube), and `trust` weighs a release that the first pass found to be an outlier
	 * down. Positions are taken relative to `i`, so the fit at `i` is the intercept.
	 */
	function fitPoint(values, i, half, trust) {
		const xs = [], ys = [], ws = [];
		for(let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
			if(num(values[j]) === null) {
				continue;
			}
			const u = Math.abs(j - i) / (half + 1);
			const w = Math.pow(1 - u * u * u, 3) * (trust ? trust[j] : 1);
			if(w > 0) {
				xs.push(j - i);
				ys.push(values[j]);
				ws.push(w);
			}
		}
		if(xs.length === 0) {
			return null;
		}
		if(xs.length < 3) {
			let sw = 0, sy = 0;
			for(let k = 0; k < xs.length; k++) {
				sw += ws[k];
				sy += ws[k] * ys[k];
			}
			return sw > 0 ? sy / sw : null; // two releases carry no slope one should extrapolate from
		}
		return weightedLine(xs, ys, ws, 0);
	}

	/**
	 * How much each release should count in the fit, from how far it lies off the rolling median. The
	 * median is what decides, not the fit itself: a line follows an outlying release at the border of the
	 * data far enough to call it typical, which is exactly the release a decision rests on.
	 */
	function trustOf(values, window) {
		const rough = rollingMedian(values, window);
		const off = values.map((v, i) => num(v) === null || rough[i] === null ? null : Math.abs(v - rough[i]));
		const spread = median(off);
		return off.map(d => {
			if(d === null) {
				return 0;
			}
			if(!isFinite(spread) || spread <= 0) {
				return d === 0 ? 1 : 0; // every release states the same, so the one that does not is the outlier
			}
			const u = d / (6 * spread);
			return u >= 1 ? 0 : Math.pow(1 - u * u, 2);
		});
	}

	/**
	 * Robust local linear smoothing over a centered window of `window` releases.
	 *
	 * A rolling median is robust, but it repeats the middle value of its window: a series that rises by
	 * one per release reads one release behind, and the newest point, the one a decision rests on, is the
	 * one it flattens most. This fits a line through the window instead, weighted by distance from the
	 * release it describes and by how far each release lies off the rolling median, so a trend survives
	 * and a single noisy run still does not set the curve. Holes stay holes, so a metric that did not
	 * exist yet does not grow a fake value.
	 */
	function rollingSmooth(values, window) {
		const w = Math.max(1, Math.floor(window || 1));
		if(w <= 1) {
			return values.slice();
		}
		const half = Math.max(1, Math.floor(w / 2));
		const trust = trustOf(values, w);
		return values.map((v, i) => {
			if(num(v) === null) {
				return null;
			}
			const fit = fitPoint(values, i, half, trust);
			return fit === null ? v : fit;
		});
	}

	/** median of the last `n` finite values, i.e. the baseline of the most recent releases */
	function baselineOf(values, n) {
		const count = Math.max(1, Math.floor(n || 1));
		const tail = [];
		for(let i = values.length - 1; i >= 0 && tail.length < count; i--) {
			if(num(values[i]) !== null) {
				tail.push(values[i]);
			}
		}
		return median(tail);
	}

	/**
	 * Percentage difference of every value against `baseline`.
	 * A baseline of zero still plots the series: a value of zero is no change, anything
	 * else has no finite percentage. That keeps counters that are always zero on the chart.
	 */
	function toPercentDelta(values, baseline) {
		if(!isFinite(baseline)) {
			return values.map(() => null);
		}
		if(baseline === 0) {
			return values.map(v => v === 0 ? 0 : null);
		}
		return values.map(v => num(v) === null ? null : (v / baseline - 1) * 100);
	}

	const CALIBRATION_BREAK = 3;
	/*
	 * How far a single run may be scaled. The break above says "this is a different workload"; this says
	 * "this is the same workload on a machine that was this much faster or slower". A calibration is one
	 * noisy sample of a shared runner, so a wide bound lets its noise, rather than the machine, decide
	 * where a measurement is drawn.
	 */
	const CALIBRATION_MAX_FACTOR = 1.5;
	const CALIBRATION_MIN_SEGMENT = 4;

	/** splits the calibration series wherever its scale breaks, holes stay with the scale around them */
	function calibrationScales(calibration) {
		const scales = [];
		let current = [];
		for(const raw of calibration || []) {
			const v = num(raw) !== null && raw > 0 ? raw : null;
			if(v === null) {
				current.push(null);
				continue;
			}
			const ref = median(current);
			if(isFinite(ref) && ref > 0 && (v / ref >= CALIBRATION_BREAK || ref / v >= CALIBRATION_BREAK)) {
				scales.push(current);
				current = [];
			}
			current.push(v);
		}
		scales.push(current);
		return scales;
	}

	/**
	 * Machine speed factor per run, relative to the *fastest* run measured on the same calibration scale.
	 * Whatever else a shared runner is doing can only ever add time, never take it away, so the fastest
	 * run is the one that saw the machine and every other one carries interference on top. Against the
	 * median instead, half the runs come out below the reference, and dividing by a factor under one
	 * inflates a clean run into a regression that never happened. Every factor here is at least one, so
	 * normalizing only ever takes added time back off.
	 */
	function calibrationFactors(calibration) {
		const factors = new Array((calibration || []).length).fill(1);
		let at = 0;
		for(const scale of calibrationScales(calibration)) {
			const seen = scale.filter(v => v !== null);
			const ref = Math.min.apply(null, seen);
			const usable = seen.length >= CALIBRATION_MIN_SEGMENT && isFinite(ref) && ref > 0;
			for(let i = 0; i < scale.length; i++) {
				const v = scale[i];
				if(usable && v !== null) {
					factors[at + i] = Math.min(CALIBRATION_MAX_FACTOR, v / ref);
				}
			}
			at += scale.length;
		}
		return factors;
	}

	/** divide out the machine speed, keeping the original unit */
	function applyFactors(values, factors) {
		return values.map((v, i) => {
			if(num(v) === null) {
				return null;
			}
			const f = factors ? factors[i] : 1;
			return isFinite(f) && f > 0 ? v / f : v;
		});
	}

	const TAG_LABELS = {
		smell:           'Code smell',
		quickfix:        'Quick fix',
		reproducibility: 'Reproducibility',
		usability:       'Usability',
		robustness:      'Robustness',
		bug:             'Bug',
		readability:     'Readability',
		security:        'Security',
		style:           'Style',
		performance:     'Performance',
		documentation:   'Documentation',
		experimental:    'Experimental',
		deprecated:      'Deprecated'
	};

	/** the linting rule tags are enum values, the chart shows them as words */
	function tagLabel(tag) {
		const key = String(tag);
		return TAG_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1));
	}

	/** the measurements are named after what the code does, the charts name the step */
	const SHORT = {
		'built-in definitions (default handler)':   'Default handler',
		'built-in definitions (own handler)':       'Own handler',
		'built-in definitions (with eval handler)': 'With eval handler',
		'reduction (characters)':        'Characters',
		'reduction (normalized tokens)': 'Normalized tokens',
		'reduction (dataflow vertices)': 'Dataflow vertices',
		'memory (df-graph)':             'Dataflow graph',
		'memory (cfg-graph)':            'Control flow graph',
		'dataflow control flow edges':   'DF (control) edges',
		'files with data frames':      'Files',
		'data frame operations':       'Operations',
		'data frame operation nodes':  'Operation nodes',
		'data frame value nodes':      'Value nodes',
		'data frame constraints':      'Constraints',
		'data frame shapes (exact)':   'Exact',
		'data frame shapes (bottom)':  'Bottom',
		'data frame shapes (top)':     'Top',
		'Retrieve AST from R code':     'Parse',
		'Normalize R AST':              'Normalize',
		'Produce dataflow information': 'Dataflow',
		'Extract control flow graph':   'CFG',
		'Extract call graph':           'CG',
		'Infer data frame shapes':      'Data frames',
		'Dependencies query':           'Dep query',
		'Linter run':                   'Linter',
		'Static slicing':               'Slicing',
		'Reconstruct code':             'Reconstruct'
	};

	/** the measurements are named in whatever case the code that records them uses, a label is one case */
	function capitalize(label) {
		return label.charAt(0).toUpperCase() + label.slice(1);
	}

	/** the measurement names read like sentences, this keeps the charts legible */
	function shortName(name) {
		// the chart is already titled for the database, so its series only need to say what they count
		const sig = /^signature database (.+)$/.exec(String(name));
		if(sig) {
			return capitalize(sig[1]);
		}
		const per = /^(.*?)( per 100 lines)$/.exec(String(name));
		if(per) {
			return shortName(per[1]) + per[2];
		}
		return SHORT[name] || capitalize(String(name)
			.replace(/^(produce|extract|retrieve)\s+/i, m => m[0].toUpperCase() + m.slice(1).trimEnd() + ' ')
			.replace(/\s+information$/i, ''));
	}

	/** version carried by a release commit message, null if there is none */
	function parseVersion(message) {
		const m = /(?:^|[^\d.])(\d+)\.(\d+)\.(\d+)(?![\d.])/.exec(String(message || ''));
		return m ? { major: +m[1], minor: +m[2], patch: +m[3], text: m[1] + '.' + m[2] + '.' + m[3] } : null;
	}

	/**
	 * The first line of a commit message, with the release marker shortened: every release says
	 * `[release:patch]`, and in a tooltip about releases the word `release` is the only part that carries
	 * nothing. `[release:minor] 2.13.0 Guessing Dep. Versions` reads as `[minor] 2.13.0 Guessing Dep. Versions`.
	 */
	function commitTitle(message) {
		return String(message || '').split('\n')[0].trim()
			.replace(/^\[release:(patch|minor|major)]/i, '[$1]');
	}

	/** what the x axis shows for a run: the release version, else the short commit id */
	function runLabel(run) {
		const v = parseVersion(run && run.commit && run.commit.message);
		if(v) {
			return v.text;
		}
		const id = run && run.commit && run.commit.id;
		return id ? String(id).slice(0, 7) : '?';
	}

	/** indices where the major or minor version changed, patches are too frequent to mark */
	function releaseBumps(runs) {
		const out = [];
		let prev = null;
		for(let i = 0; i < runs.length; i++) {
			const v = parseVersion(runs[i] && runs[i].commit && runs[i].commit.message);
			if(!v) {
				continue;
			}
			if(prev) {
				if(v.major > prev.major) {
					out.push({ index: i, version: v.text, kind: 'major' });
				} else if(v.major === prev.major && v.minor > prev.minor) {
					out.push({ index: i, version: v.text, kind: 'minor' });
				}
			}
			if(!prev || v.major > prev.major || (v.major === prev.major && v.minor > prev.minor)) {
				prev = v;
			}
		}
		return out;
	}

	/** consecutive stretches of present values, so gaps are never bridged */
	function segments(values) {
		const out = [];
		let cur = null;
		values.forEach((v, i) => {
			if(num(v) === null) {
				cur = null;
			} else {
				if(!cur) {
					cur = [];
					out.push(cur);
				}
				cur.push(i);
			}
		});
		return out;
	}

	/**
	 * Smooth path through the points, using horizontal control points.
	 * The curve never leaves the value range of the two points it connects, so a band
	 * drawn this way cannot cross its own line even with a hundred noisy points.
	 */
	function smoothPath(points) {
		if(!points.length) {
			return '';
		}
		const p = points.map(q => [round(q[0]), round(q[1])]);
		if(p.length === 1) {
			return 'M' + p[0][0] + ' ' + p[0][1];
		}
		let d = 'M' + p[0][0] + ' ' + p[0][1];
		for(let i = 1; i < p.length; i++) {
			const dx = (p[i][0] - p[i - 1][0]) / 2;
			d += 'C' + round(p[i - 1][0] + dx) + ' ' + p[i - 1][1] + ' ' + round(p[i][0] - dx) + ' ' + p[i][1] + ' ' + p[i][0] + ' ' + p[i][1];
		}
		return d;
	}

	function round(v) {
		return Math.round(v * 100) / 100;
	}

	/** rounded tick values covering [min, max], always including zero */
	function ticks(min, max, count) {
		let lo = Math.min(min, 0), hi = Math.max(max, 0);
		if(!isFinite(lo) || !isFinite(hi)) {
			return { lo: 0, hi: 1, step: 1, values: [0, 1] };
		}
		if(lo === hi) {
			hi = lo + 1;
		}
		const n = Math.max(2, count || 5);
		const raw = (hi - lo) / n;
		const mag = Math.pow(10, Math.floor(Math.log10(raw)));
		const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) || mag * 10;
		lo = Math.floor(lo / step) * step;
		hi = Math.ceil(hi / step) * step;
		const values = [];
		for(let v = lo; v <= hi + step / 2; v += step) {
			values.push(Math.abs(v) < step / 1e6 ? 0 : v);
		}
		return { lo, hi, step, values };
	}

	/**
	 * Ticks for a logarithmic axis: 1, 2 and 5 of every decade the data touches. A chart whose series
	 * differ by orders of magnitude flattens all but the largest one on a linear axis.
	 */
	function logTicks(min, max) {
		const snap = (v, down) => {
			const base = Math.pow(10, Math.floor(Math.log10(v)));
			const f = v / base;
			if(down) {
				return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * base;
			}
			return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base;
		};
		const lo = snap(min > 0 && isFinite(min) ? min : 1, true);
		const hi = Math.max(snap(max > lo ? max : lo * 10, false), lo * 10);
		const values = [];
		for(let e = Math.log10(lo); Math.pow(10, Math.floor(e)) <= hi; e++) {
			for(const f of [1, 2, 5]) {
				const v = f * Math.pow(10, Math.floor(e));
				if(v >= lo && v <= hi) {
					values.push(v);
				}
			}
		}
		return { lo, hi, step: 1, values, log: true };
	}

	/** the runs that carry a label on the axis: evenly spaced, and always ending on the newest one */
	function tickIndices(n, count) {
		if(n <= 0) {
			return [];
		}
		const step = Math.max(1, Math.ceil(n / Math.max(1, count || 6)));
		const out = [];
		for(let i = 0; i < n - 1; i += step) {
			out.push(i);
		}
		/* the last regular tick gives way rather than crowd the newest run */
		if(out.length > 1 && n - 1 - out[out.length - 1] < step / 2) {
			out.pop();
		}
		out.push(n - 1);
		return out;
	}

	/**
	 * Which labels of `[position, width]` fit without touching each other, as a flag per label.
	 * The newest is placed first, so a crowded tail never costs the label a reader looks for.
	 */
	function fitLabels(spans) {
		const placed = [];
		const keep = spans.map(() => false);
		for(let i = spans.length - 1; i >= 0; i--) {
			const [at, width] = spans[i];
			if(placed.every(p => at + width <= p[0] || at >= p[0] + p[1])) {
				placed.push([at, width]);
				keep[i] = true;
			}
		}
		return keep;
	}

	/**
	 * The indices at which the rows start to state something else, one per state. Runs that state
	 * nothing at all are passed over, and runs that repeat what the one before said are merged into it.
	 */
	function stateChanges(rows) {
		const n = rows.reduce((m, r) => Math.max(m, r.length), 0);
		const out = [];
		let prev = null;
		for(let i = 0; i < n; i++) {
			if(rows.every(r => num(r[i]) === null)) {
				continue;
			}
			const key = rows.map(r => num(r[i]) === null ? 'x' : r[i]).join('|');
			if(key !== prev) {
				out.push(i);
			}
			prev = key;
		}
		return out;
	}

	/**
	 * One colour per name, none of them twice. A name keeps the colour `known` gives it unless
	 * something in this chart already holds that one, and the rest fill the gaps that leaves.
	 * Neither `known` nor `taken` is changed.
	 */
	function pickColors(names, known, palette, taken) {
		const used = new Set(taken || []);
		const out = new Map();
		const rest = [];
		for(const name of names) {
			const c = known ? known.get(name) : undefined;
			if(c === undefined || used.has(c)) {
				rest.push(name);
				continue;
			}
			used.add(c);
			out.set(name, c);
		}
		for(const name of rest) {
			let c = used.size % palette;
			for(let i = 0; i < palette; i++) {
				if(!used.has(i)) {
					c = i;
					break;
				}
			}
			used.add(c);
			out.set(name, c);
		}
		return out;
	}

	/**
	 * The counters of a suite are uploaded under a suite of their own, so that a release with more linting
	 * rules is never called a performance regression. The page shows one suite, so the two are merged back
	 * here: an info run joins the run of the same commit, and stands on its own if there is none.
	 */
	const INFO_SUFFIX = ' [info]';

	function mergeInfoSuites(entries) {
		for(const key of Object.keys(entries)) {
			if(!key.endsWith(INFO_SUFFIX)) {
				continue;
			}
			const base = key.slice(0, -INFO_SUFFIX.length);
			const info = entries[key];
			delete entries[key];
			if(!entries[base]) {
				entries[base] = info;
				continue;
			}
			const runs = entries[base];
			const byCommit = new Map(runs.map(r => [String((r.commit || {}).id || ''), r]));
			for(const run of info) {
				const at = byCommit.get(String((run.commit || {}).id || ''));
				if(!at) {
					runs.push(run);
					continue;
				}
				const known = new Set(at.benches.map(b => b.name));
				for(const b of run.benches) {
					if(!known.has(b.name)) {
						at.benches.push(b);
					}
				}
			}
			runs.sort((a, b) => a.date - b.date);
		}
		return entries;
	}

	/** `id:a~b;id2:c` for a map of sets, the shape the page keeps its per-chart choices in */
	function encodeGroups(map) {
		return [...map].filter(([, set]) => set && set.size)
			.map(([id, set]) => id + ':' + [...set].join('~')).join(';');
	}

	function decodeGroups(text) {
		const out = new Map();
		for(const part of String(text || '').split(';').filter(Boolean)) {
			const at = part.indexOf(':');
			if(at > 0) {
				out.set(part.slice(0, at), new Set(part.slice(at + 1).split('~').filter(Boolean)));
			}
		}
		return out;
	}

	/**
	 * The charts, in display order. Every metric lands in exactly one group, but a group without an entry
	 * here is never drawn: the measurement is still recorded and still part of the downloads, it just
	 * stays off the page (see the ids {@link groupOf} hands out that are missing below).
	 */
	const GROUPS = [
		{ id: 'per-file', title: 'Per-file phases', about: 'time the analysis spends on one input file' },
		{ id: 'per-slice', title: 'Per-slice phases', about: 'time per computed slice' },
		{ id: 'memory', title: 'Memory', about: 'size of what the analysis keeps around' },
		{ id: 'reduction', title: 'Slice reduction', about: 'how much of the input a slice drops' },
		{ id: 'failures', title: 'Failures and thresholds', about: 'slices that could not be re-parsed and threshold hits' },
		{ id: 'volume', title: 'Corpus size', about: 'how much input the suite covers', log: true, folded: true },
		{ id: 'graphs', title: 'Graph size', about: 'how large the graphs the analysis builds are' },
		{ id: 'dataframes', title: 'Data frame shapes', about: 'what the shape inference sees and how precise it is', folded: true },
		{ id: 'features', title: 'Feature set', about: 'the linting rules, their tags, and the queries this version carries', perVersion: true },
		{ id: 'builtins', title: 'Built-in definitions', about: 'how the built-ins are handled', perVersion: true },
		{ id: 'calibration', title: 'Machine calibration', about: 'runtime of the fixed synthetic workload', folded: true },
		{ id: 'sigdb', title: 'Signature database', about: 'the package signatures this version ships', perVersion: true, facts: true },
		{ id: 'tests', title: 'Test suite', about: 'the labeled tests and what they cover', perVersion: true, facts: true }
	];

	const PER_SLICE = ['static slicing', 'reconstruct code'];
	/** the reductions worth a line, the others describe the same slice from another angle */
	const REDUCTIONS = ['reduction (characters)', 'reduction (normalized tokens)', 'reduction (dataflow vertices)'];

	function groupOf(name, unit) {
		const n = String(name || '').toLowerCase();
		if(n.includes('calibration')) {
			return 'calibration';
		}
		// the database counters are sizes and counts alike, so they have to be claimed before either
		if(n.startsWith('signature database')) {
			return 'sigdb';
		}
		if(n === 'tests' || n.startsWith('tests ')) {
			return 'tests';
		}
		// the totals dwarf the single phases and add nothing the phases do not show
		if(n.startsWith('total ')) {
			return 'totals';
		}
		if(n.startsWith('built-in definitions')) {
			return 'builtins';
		}
		if(n === 'queries' || n.startsWith('linting rules')) {
			return 'features';
		}
		// only the three reductions that describe the slice itself, the rest is recorded but not shown
		if(n.includes('reduction')) {
			return REDUCTIONS.includes(n) ? 'reduction' : 'reduction-detail';
		}
		if(n === 'memory (df-shapes)') {
			return 'memory-detail';
		}
		if(n.includes('memory') || unit === 'KiB') {
			return 'memory';
		}
		if(n.includes('failed') || n.includes('threshold')) {
			return 'failures';
		}
		// the timing of the inference stays with the other phases, only its counts get their own chart
		if(unit === '#' && n.includes('data frame')) {
			return 'dataframes';
		}
		// a phase measured against the size of the input says what its own line already says
		if(/ per 100 lines$/.test(n)) {
			return 'per-line';
		}
		// the two sizes of a graph, its calls and definitions are a breakdown of them and stay off the page
		if(n === 'dataflow control flow edges' || /^(dataflow|control flow) (vertices|edges)$/.test(n)) {
			return 'graphs';
		}
		if(/^(dataflow|control flow) (calls|function definitions)$/.test(n)) {
			return 'graphs-detail';
		}
		if(n.startsWith('input ') || n === 'number of slices') {
			return 'volume';
		}
		if(n.includes('number of')) {
			return 'volume';
		}
		if(PER_SLICE.includes(n)) {
			return 'per-slice';
		}
		if(unit === 'ms') {
			return 'per-file';
		}
		return 'other';
	}

	/** 'down' if a smaller value is better, 'up' if a larger one is, 'flat' if neither */
	function betterOf(name, unit) {
		const n = String(name || '').toLowerCase();
		// a larger database is neither better nor worse, it just describes more
		if(n.startsWith('signature database')) {
			return 'flat';
		}
		if(n.includes('reduction') || n === 'data frame shapes (exact)') {
			return 'up';
		}
		if(n === 'data frame shapes (top)' || n === 'data frame shapes (bottom)') {
			return 'down';
		}
		if(n.includes('calibration') || n.includes('number of')) {
			return 'flat';
		}
		if(unit === 'ms' || unit === 'KiB' || n.includes('failed') || n.includes('threshold')) {
			return 'down';
		}
		return 'flat';
	}

	root.BenchStats = {
		median, rollingMedian, rollingSmooth, baselineOf, toPercentDelta, calibrationScales, calibrationFactors, applyFactors,
		parseVersion, runLabel, commitTitle, shortName, tagLabel, releaseBumps, segments, smoothPath, ticks, groupOf, betterOf,
		logTicks, tickIndices, fitLabels, stateChanges, pickColors, mergeInfoSuites, encodeGroups, decodeGroups, GROUPS
	};
})(typeof globalThis === 'undefined' ? this : globalThis);

if(typeof module !== 'undefined' && module.exports) {
	module.exports = globalThis.BenchStats;
}
