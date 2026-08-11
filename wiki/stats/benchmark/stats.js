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

	/**
	 * Machine speed factor per run, relative to the median run of the calibration series.
	 * A factor above one means the runner was slower than usual.
	 */
	function calibrationFactors(calibration) {
		const med = median(calibration);
		if(!isFinite(med) || med === 0) {
			return calibration.map(() => 1);
		}
		return calibration.map(v => num(v) !== null && v > 0 ? v / med : 1);
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
		'built-in definitions (default handler)':   'default handler',
		'built-in definitions (own handler)':       'own handler',
		'built-in definitions (with eval handler)': 'with eval handler',
		'files with data frames':      'files',
		'data frame operations':       'operations',
		'data frame operation nodes':  'operation nodes',
		'data frame value nodes':      'value nodes',
		'data frame constraints':      'constraints',
		'data frame shapes (exact)':   'exact',
		'data frame shapes (bottom)':  'bottom',
		'data frame shapes (top)':     'top',
		'Retrieve AST from R code':     'Parse',
		'Normalize R AST':              'Normalize',
		'Produce dataflow information': 'Dataflow',
		'Extract control flow graph':   'Control flow',
		'Extract call graph':           'Call graph',
		'Infer data frame shapes':      'Data frames',
		'Static slicing':               'Slicing',
		'Reconstruct code':             'Reconstruct'
	};

	/** the measurement names read like sentences, this keeps the charts legible */
	function shortName(name) {
		// the chart is already titled for the database, so its series only need to say what they count
		const sig = /^signature database (.+)$/.exec(String(name));
		if(sig) {
			return sig[1];
		}
		const per = /^(.*?)( per 100 lines)$/.exec(String(name));
		if(per) {
			return shortName(per[1]) + per[2];
		}
		return SHORT[name] || String(name).replace(/^(produce|extract|retrieve)\s+/i, m => m[0].toUpperCase() + m.slice(1).trimEnd() + ' ')
			.replace(/\s+information$/i, '');
	}

	/** version carried by a release commit message, null if there is none */
	function parseVersion(message) {
		const m = /(?:^|[^\d.])(\d+)\.(\d+)\.(\d+)(?![\d.])/.exec(String(message || ''));
		return m ? { major: +m[1], minor: +m[2], patch: +m[3], text: m[1] + '.' + m[2] + '.' + m[3] } : null;
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

	/** the major releases among {@link releaseBumps} */
	function majorBumps(runs) {
		return releaseBumps(runs).filter(b => b.kind === 'major');
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

	/** the charts, in display order. Every metric lands in exactly one of them */
	const GROUPS = [
		{ id: 'per-file', title: 'Per-file phases', about: 'time the analysis spends on one input file' },
		{ id: 'per-slice', title: 'Per-slice phases', about: 'time per computed slice' },
		{ id: 'memory', title: 'Memory', about: 'size of what the analysis keeps around' },
		{ id: 'reduction', title: 'Slice reduction', about: 'how much of the input a slice drops' },
		{ id: 'failures', title: 'Failures and thresholds', about: 'slices that could not be re-parsed and threshold hits' },
		{ id: 'volume', title: 'Corpus size', about: 'how much input the suite covers' },
		{ id: 'graphs', title: 'Graph size', about: 'how large the graphs the analysis builds are' },
		{ id: 'dataframes', title: 'Data frame shapes', about: 'what the shape inference sees and how precise it is' },
		{ id: 'features', title: 'Feature set', about: 'the linting rules, their tags, and the queries this version carries', perVersion: true },
		{ id: 'builtins', title: 'Built-in definitions', about: 'how the built-ins are handled', perVersion: true },
		{ id: 'calibration', title: 'Machine calibration', about: 'runtime of the fixed synthetic workload' },
		{ id: 'other', title: 'Other', about: '' },
		{ id: 'sigdb', title: 'Signature database', about: 'the package signatures this version ships', perVersion: true, facts: true }
	];

	const PER_SLICE = ['static slicing', 'reconstruct code'];

	function groupOf(name, unit) {
		const n = String(name || '').toLowerCase();
		if(n.includes('calibration')) {
			return 'calibration';
		}
		// the database counters are sizes and counts alike, so they have to be claimed before either
		if(n.startsWith('signature database')) {
			return 'sigdb';
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
		if(n.includes('reduction')) {
			return 'reduction';
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
		if(/^(dataflow|control flow) (vertices|edges|calls|function definitions)$/.test(n)) {
			return 'graphs';
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
		median, rollingMedian, baselineOf, toPercentDelta, calibrationFactors, applyFactors,
		parseVersion, runLabel, shortName, tagLabel, majorBumps, releaseBumps, segments, smoothPath, ticks, groupOf, betterOf, GROUPS
	};
})(typeof globalThis === 'undefined' ? this : globalThis);

if(typeof module !== 'undefined' && module.exports) {
	module.exports = globalThis.BenchStats;
}
