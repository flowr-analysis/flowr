/**
 * Generates the landing page at `index.html`, which is what GitHub Pages serves as the site root.
 *
 * Every number and every answer on that page is produced here, by running flowR over the samples
 * below, so the page ships as plain static HTML with nothing to load and nothing that can go stale
 * without this script noticing.
 */
import fs from 'fs';
import { template, writePage } from './html-page';
import { execSync } from 'child_process';
import path from 'path';
import { TreeSitterExecutor } from '../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrAnalyzerBuilder } from '../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../src/project/flowr-analyzer';
import { OriginType } from '../src/dataflow/origin/dfg-get-origin';
import { stringifyValue } from '../src/dataflow/eval/values/r-value';
import { SliceDirection } from '../src/util/slice-direction';
import { LintingRules } from '../src/linter/linter-rules';
import { LintingPrettyPrintContext } from '../src/linter/linter-format';
import { arraySum } from '../src/util/collections/arrays';
import { highlightR, renderRToken, tokenizeR, escapeHtml as escape } from '../src/util/text/r-highlight';

/**
 * The samples every tab runs on. Each one is written next to the page as a real `.R` file, so the
 * command a tab shows is the command a reader can actually run.
 */
const Samples = {
	'survey.R': [
		'clean <- function(d) {',
		'  d$age <- as.numeric(d$age)',
		'  d',
		'}',
		'survey   <- read.csv("survey.csv")',
		'survey   <- clean(survey)',
		'mean_age <- mean(survey$age)',
		'model    <- lm(income ~ age, data = survey)',
		'plot(survey$age)'
	].join('\n'),
	'project.R':  'library(dplyr)\nsource("helpers.R")\nraw <- read.csv("survey.csv")\nclean <- filter(raw, !is.na(age))\nwrite.csv(clean, "clean.csv")\nplot(clean$age)\nabline(h = mean(clean$age))',
	'messy.R':    'data   <- read.csv("/root/x.txt")\nunused <- 42\nif(FALSE) {\n  print("never runs")\n}\nprint(nrow(data))',
	'shapes.R':   'df <- data.frame(id = 1:3)\ndf <- filter(df, id > 1)\nn  <- 2 * 3',
	'aliases.R':  'square <- function(x) x * x\narea   <- square\nprint(area(3))',
	'packages.R': 'library(dplyr)\nfilter(df, age > 30)'
} as const;

/** The names the reader can point at in the slice demo; every occurrence slices at its own position. */
const Names: readonly string[] = ['clean', 'd', 'survey', 'mean_age', 'model',
	'read.csv', 'as.numeric', 'mean', 'lm', 'plot'];

/** The names the reader can point at in the value and origin demos, as `line@name`. */
const ValueNames = ['1@df', '2@df', '3@n'] as const;
const OriginNames = ['1@square', '2@square', '2@area', '3@area', '3@print'] as const;

const SliceSample = Samples['survey.R'];
const DependencySample = Samples['project.R'];
const LintSample = Samples['messy.R'];
const ValueSample = Samples['shapes.R'];
const OriginSample = Samples['aliases.R'];
const SignatureSample = Samples['packages.R'];

async function analyzerFor(code: string): Promise<FlowrAnalyzer> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
	analyzer.addRequest({ request: 'text', content: code });
	return analyzer;
}

/** The one-based lines a slice for the given criterion keeps, backward (what reaches it) or forward (what it reaches). */
async function sliceLines(code: string, criterion: string, direction = SliceDirection.Backward): Promise<number[]> {
	const analyzer = await analyzerFor(code);
	/* `includeCallees` carries the slice past a function-definition boundary, so pointing at a call keeps
	   the function it reaches instead of stopping at the name */
	const result = await analyzer.query([{ type: 'static-slice', criteria: [criterion], direction, includeCallees: true }] as never) as unknown as Record<string, unknown>;
	const answers = (result['static-slice'] as { results?: Record<string, { slice?: { result?: Iterable<unknown> } }> } | undefined)?.results ?? {};
	const ids = Object.values(answers).flatMap(answer => [...(answer?.slice?.result ?? [])]);
	const map = (await analyzer.normalize()).idMap;
	const lines = new Set<number>();
	for(const id of ids) {
		const node = map?.get(id as never);
		const start = node?.location?.[0];
		if(typeof start !== 'number') {
			continue;
		}
		lines.add(start);
		/* a kept node that closes with a brace keeps the line that brace sits on, the way the
		   reconstructed slice prints it; without it the block looks cut off in the highlighting */
		const full = node?.info?.fullRange;
		if(full !== undefined && full[2] > full[0] && node?.info?.fullLexeme?.trimEnd().endsWith('}')) {
			lines.add(full[2]);
		}
	}
	return [...lines].sort((a, b) => a - b);
}

/** Every dependency, with the line it was found on so the code and the answer can point at each other. */
async function dependencyLines(code: string): Promise<string[][]> {
	const analyzer = await analyzerFor(code);
	const idMap = (await analyzer.normalize()).idMap;
	const found = (await analyzer.query([{ type: 'dependencies' }])).dependencies as unknown as
		Record<string, readonly { value?: string, nodeId?: string | number }[]>;
	return ([['library', 'library'], ['source', 'source'], ['read', 'read'], ['write', 'write'], ['visualize', 'visualize']] as const)
		.flatMap(([key, label]) => (found[key] ?? []).map(entry => [
			label,
			entry.value ?? '?',
			String(idMap?.get(entry.nodeId as never)?.location?.[0] ?? 0)
		]));
}

/**
 * Every finding, in the words the linter itself uses for it (its `prettyPrint`, the same text the
 * REPL prints), and with the exact range it covers so the code underlines that much and no more.
 */
async function lintLines(code: string): Promise<Finding[]> {
	interface Raw { loc?: [number, number, number, number] }
	const analyzer = await analyzerFor(code);
	const answer = (await analyzer.query([{ type: 'linter' }])).linter as unknown as
		{ results?: Record<string, { results?: Raw[], '.meta'?: object }> };
	const rules = answer.results ?? {};
	return Object.entries(rules).flatMap(([rule, found]) => (found?.results ?? []).map((finding): Finding => ({
		rule,
		what: explain(rule, finding, found?.['.meta']),
		line: finding.loc?.[0] ?? 0,
		from: finding.loc?.[1] ?? 1,
		to:   finding.loc?.[0] === finding.loc?.[2] ? finding.loc?.[3] ?? 0 : 0
	})));
}

/**
 * One finding in the linter's own words. `Full` is the phrasing meant for a person; the trailing
 * position is dropped because the underline already points at it.
 */
function explain(rule: string, finding: unknown, meta: unknown): string {
	const rules = LintingRules as unknown as Record<string, { prettyPrint: Record<string, (r: never, m: never) => string> }>;
	const print = rules[rule].prettyPrint;
	const text = (print[LintingPrettyPrintContext.Full] ?? print[LintingPrettyPrintContext.Query])(finding as never, meta as never);
	return text.replace(/\s+at \d+\.\d+(-\d+)?/g, '').trim();
}

interface Finding {
	readonly rule: string;
	readonly what: string;
	readonly line: number;
	readonly from: number;
	readonly to:   number;
}

/**
 * What flowR inferred for each name: the `absint` query answers a domain per criterion, printed by the
 * domain itself, which is how flowR's own summarizer renders it (see `AbsintQueryDefinition`).
 */
async function valueLines(code: string): Promise<string[][]> {
	const analyzer = await analyzerFor(code);
	const criteria = ValueNames.filter(c => !c.endsWith('@n'));
	const result = await analyzer.query([{ type: 'absint', inference: 'df-shape', criteria }] as never) as unknown as
		{ absint?: { result?: Map<string, { toString(): string } | undefined> } };
	const domains = result.absint?.result;
	const shapes = domains instanceof Map
		? [...domains.entries()].map(([criterion, domain]) => [criterion, readable(domain?.toString() ?? 'top'), domain?.toString() ?? 'top'])
		: [];
	/* the value resolver runs for every name; it answers where the shape inference has nothing to say
	   (a plain number) and adds nothing where it does. Its results are keyed by the request rather than
	   by the criterion, so each one is asked for on its own. */
	const resolved: string[][] = [];
	for(const criterion of ValueNames) {
		const answer = await analyzer.query([{ type: 'resolve-value', criteria: [criterion] }]);
		const values = [...new Set(Object.values(answer['resolve-value'].results)
			.flatMap(found => found.values.map(v => stringifyValue(v))))].filter(v => v.length > 0 && !/^(top|⊤|⊥|bottom)$/.test(v));
		if(values.length > 0) {
			/* the comment says what it means, the tooltip keeps flowR's own form (`[6L, 6L]`) */
			resolved.push([criterion, values.map(plain).join(', '), values.join(', ')]);
		}
	}
	const criteriaSeen = new Set(shapes.map(([criterion]) => criterion));
	return [
		...shapes.map(([criterion, raw, said]) => {
			const value = resolved.find(([c]) => c === criterion)?.[2];
			return [criterion, raw, value ? `${said}, resolving to ${value}` : said];
		}),
		...resolved.filter(([criterion]) => !criteriaSeen.has(criterion))
	];
}

/** `[6L, 6L]` is one certain integer, and reads better as `6`. */
function plain(value: string): string {
	return value.replace(/^\[(.*), \1\]$/, '$1').replace(/(\d)L\b/g, '$1');
}

/** A domain prints as `(colnames: [..], cols: [1, 1], rows: [3, 3])`; a reader wants sentences. */
function readable(domain: string): string {
	const parts = /colnames:\s*\[(.*)\],\s*cols:\s*\[(\d+), (\d+)\],\s*rows:\s*\[(\d+), (\d+)\]/.exec(domain);
	if(parts === null) {
		return domain;
	}
	const range = (low: string, high: string): string => low === high ? low : `${low} to ${high}`;
	const columns = parts[1].replace(/[{}"]/g, '').split(',').map(c => c.trim()).filter(c => c.length > 0);
	return `${range(parts[4], parts[5])} rows, ${range(parts[2], parts[3])} column${parts[3] === '1' ? '' : 's'}`
		+ (columns.length > 0 ? ` named ${columns.join(', ')}` : '');
}

/**
 * Where each name in {@link OriginSample} comes from: the `origin` query answers one {@link Origin} list per
 * criterion, and each origin points at a node, so the id map turns it back into the line a reader can see.
 */
async function originLines(code: string): Promise<string[][]> {
	const analyzer = await analyzerFor(code);
	const idMap = (await analyzer.normalize()).idMap;
	const lines: string[][] = [];
	for(const criterion of OriginNames) {
		const result = await analyzer.query([{ type: 'origin', criterion }]);
		for(const origin of result.origin.results[criterion] ?? []) {
			const at = idMap?.get(origin.id);
			const line = at?.location?.[0];
			const what = at?.lexeme ?? String(origin.id);
			lines.push([criterion, phrase(origin.type, what, line, origin.type === OriginType.BuiltInFunctionOrigin ? String(origin.fn.name) : what), String(line ?? 0),
				origin.type === OriginType.FunctionCallOrigin ? 'call' : 'read']);
		}
	}
	/* pointing at a name should light one thing: the definition it reaches, which for a call is the
	   function, not the variable that happens to hold it. Everything a name answers goes on one row,
	   so the tab stays as tall as the others. */
	const merged: string[][] = [];
	for(const [criterion, text, line, kind] of lines) {
		const already = merged.find(([c]) => c === criterion);
		if(already === undefined) {
			merged.push([criterion, text, line, kind]);
		} else {
			already[1] += ` and ${text}`;
			if(already[3] !== 'call' && kind === 'call') {
				already[2] = line;   // a call points at the function it reaches
				already[3] = kind;
			}
		}
	}
	return merged.map(([criterion, text, line]) => [criterion, text, line]);
}

/** What one origin is, in as few words as say it: `calls function (line 3)` rather than a sentence. */
function phrase(type: OriginType, what: string, line: number | undefined, builtIn: string): string {
	const where = line !== undefined ? ` (line ${line})` : '';
	switch(type) {
		case OriginType.ReadVariableOrigin:    return `reads ${what}${where}`;
		case OriginType.WriteVariableOrigin:   return `writes ${what}${where}`;
		case OriginType.ConstantOrigin:        return `constant ${what}`;
		case OriginType.FunctionCallOrigin:    return `calls function${where}`;
		case OriginType.BuiltInFunctionOrigin: return `calls built-in ${builtIn}`;
	}
}

/** What the database holds for one function, straight off the `signature` query's {@link SignatureFunctionView}. */
async function signatureLines(code: string, pkg: string, fn: string): Promise<string[][]> {
	const analyzer = await analyzerFor(code);
	const found = (await analyzer.query([{ type: 'signature', package: pkg, function: fn }])).signature.function;
	if(found === undefined) {
		return [];
	}
	return [
		['function', `${found.package}::${found.name}${found.version ? ` (${found.version})` : ''}`],
		['parameters', found.parameters.map(p => p.name + (p.default !== undefined ? ' = ' + p.default : '')).join(', ')],
		['defined in', found.file ? `${found.file}${found.line ? `, line ${found.line}` : ''}` : 'unknown'],
		['calls', found.callees.slice(0, 6).join(', ')]
	].filter(([, value]) => value.length > 0);
}

/** what a dependency line does, said out loud */
const Verbs: Readonly<Record<string, string>> = {
	library: 'loads', source: 'sources', read: 'reads', write: 'writes', visualize: 'plots to'
};

/** the same, for a dependency the query found without a name to go with it */
const Silent: Readonly<Record<string, string>> = {
	library:   'loads a package', source:    'sources a file', read:      'reads a file',
	write:     'writes a file', visualize: 'draws a plot'
};

/**
 * What each answer costs, read from the file the benchmark page plots so the two can never disagree.
 * `analysis` is parse plus normalize plus dataflow, the same sum the README quotes.
 */
function timings(): { rows: string[][], files: string, lines: string, when: string, release: string, calibration: string } | undefined {
	const file = path.join('wiki', 'stats', 'benchmark', 'data.js');
	if(!fs.existsSync(file)) {
		return undefined;
	}
	const source = fs.readFileSync(file, 'utf8');
	const entries = (JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1)) as BenchmarkData).entries;
	const runs = entries['"real-world" Benchmark Suite (tree-sitter)'];
	const info = entries['"real-world" Benchmark Suite (tree-sitter) [info]'];
	if(runs === undefined || runs.length === 0) {
		return undefined;
	}
	const of = (benches: Benchmark[], name: string): number | undefined => benches.find(b => b.name === name)?.value;
	const sum = (benches: Benchmark[], names: string[]): number | undefined => {
		const parts = names.map(n => of(benches, n));
		return parts.every(v => v !== undefined) ? arraySum(parts) : undefined;
	};
	const Analysis = ['Retrieve AST from R code', 'Normalize R AST', 'Produce dataflow information'];
	const wanted: [string, (b: Benchmark[]) => number | undefined][] = [
		['analyzing a script', b => sum(b, Analysis)],
		['linting it', b => of(b, 'Linter run')],
		['slicing for one name', b => of(b, 'Static slicing')]
	];
	/* the trend covers the last two months of releases, which is recent enough to mean something */
	const since = Date.parse(runs[runs.length - 1].commit.timestamp) - 60 * 24 * 60 * 60 * 1000;
	const recent = runs.filter(r => Date.parse(r.commit.timestamp) >= since);
	const rows = wanted.map(([label, pick]) => {
		const series = recent.map(r => pick(r.benches)).filter((v): v is number => v !== undefined);
		const now = pick(runs[runs.length - 1].benches);
		return now === undefined ? undefined : [label, now < 10 ? now.toFixed(1) : String(Math.round(now)), spark(series)];
	}).filter((row): row is string[] => row !== undefined);

	const facts = info?.[info.length - 1]?.benches ?? [];
	const last = runs[runs.length - 1];
	/* the calibration is the same fixed workload on every run, so it says how quick that runner was */
	const calibration = of(last.benches, 'Calibration');
	const release = /\b(\d+\.\d+\.\d+)\b/.exec(last.commit.message)?.[1];
	return {
		rows,
		files:       String(Math.round(of(facts, 'number of files') ?? 0)),
		lines:       String(Math.round(of(facts, 'input lines') ?? 0)),
		when:        last.commit.timestamp.slice(0, 10),
		release:     release ? `v${release}` : '',
		calibration: calibration === undefined ? '' : calibration.toFixed(1)
	};
}

/** a measurement over the last releases, small enough to sit inside a sentence */
function spark(series: readonly number[]): string {
	if(series.length < 2) {
		return '';
	}
	const low = Math.min(...series), high = Math.max(...series), span = high - low || 1;
	const points = series.map((v, i) =>
		`${(i / (series.length - 1) * 46).toFixed(1)},${(11 - (v - low) / span * 9).toFixed(1)}`).join(' ');
	return '<svg class="spark" viewBox="0 0 46 12" width="46" height="12" aria-hidden="true">'
		+ `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.1"`
		+ ' stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

interface Benchmark { name: string, value: number, unit: string }
interface BenchmarkData { entries: Record<string, { commit: { timestamp: string, message: string }, benches: Benchmark[] }[]> }

/** when the page was last updated, taken from the repository so that rebuilding alone does not change it */
function lastUpdated(): string {
	try {
		return execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim().slice(0, 16).replace('T', ', ');
	} catch{
		return new Date().toISOString().slice(0, 16).replace('T', ', ');
	}
}

async function main(): Promise<void> {
	await TreeSitterExecutor.initTreeSitter();
	const code = SliceSample;

	/* one slice per occurrence, so pointing at `survey` on the last line answers for that use, and
	   one per `x$y` access, whose criterion is the position of the `$` rather than a name */
	const slices: Record<string, number[]> = {};
	for(const [index, text] of SliceSample.split('\n').entries()) {
		const criteria = Names
			.filter(name => new RegExp(`(?<![\\w.$])${name}(?![\\w.$])`).test(text))
			.map(name => `${index + 1}@${name}`)
			.concat(accessesOf(text, index + 1).map(access => access.criterion));
		for(const criterion of criteria) {
			/* both directions, so the page can answer "what reaches this" and "what does this reach" */
			slices[criterion] = await sliceLines(code, criterion);
			slices[`${criterion}>`] = await sliceLines(code, criterion, SliceDirection.Forward);
			console.log(`  ${criterion.padEnd(14)} back ${slices[criterion].join(',')} | forward ${slices[`${criterion}>`].join(',')}`);
		}
	}

	const page = render({
		slices,
		dependencies: await dependencyLines(DependencySample),
		lint:         await lintLines(LintSample),
		values:       await valueLines(ValueSample),
		origin:       await originLines(OriginSample),
		signature:    await signatureLines(SignatureSample, 'dplyr', 'filter'),
	});
	const target = 'index.html';
	console.log(`  wrote ${target} (${(writePage(target, page) / 1024).toFixed(1)} kB)`);
}

interface PageData {
	slices:       Record<string, number[]>;
	dependencies: string[][];
	lint:         readonly Finding[];
	values:       string[][];
	origin:       string[][];
	signature:    string[][];
}

/** `survey$age` is one thing to slice for, and its criterion sits on the `$` that does the access. */
const Access = /([A-Za-z._][\w.]*)\$([A-Za-z._][\w.]*)/g;

/** every `x$y` on a line: its criterion, text, and the 1-indexed inclusive column range it covers */
function accessesOf(line: string, number: number): { criterion: string, text: string, from: number, to: number }[] {
	return [...line.matchAll(Access)].map(match => ({
		criterion: `${number}:${(match.index) + match[1].length + 1}`,
		text:      match[0],
		from:      match.index + 1,
		to:        match.index + match[0].length
	}));
}

/** one stretch of a line's own columns to wrap in a tag, laid over the R highlighting rather than into it */
interface Mark {
	readonly from:  number;   // 1-indexed column, inclusive
	readonly to:    number;   // 1-indexed column, inclusive
	readonly tag:   string;
	readonly attrs: string;
}

function overlaps(a: { from: number, to: number }, b: { from: number, to: number }): boolean {
	return a.from <= b.to && b.from <= a.to;
}

/** columns `name` occupies in `line`, via tokens so a mark never lands inside a string or comment */
function nameRanges(line: string, name: string): { from: number, to: number }[] {
	const ranges: { from: number, to: number }[] = [];
	let col = 1;
	for(const token of tokenizeR(line)) {
		const from = col;
		col += token.text.length;
		if((token.kind === 'name' || token.kind === 'call') && token.text === name) {
			ranges.push({ from, to: col - 1 });
		}
	}
	return ranges;
}

/** marks a line's names and, if asked, its a$b accesses; access wins over the plain name inside it */
function marksFor(line: string, number: number, names: readonly { criterion: string, name: string, tip?: string }[], withAccesses: boolean): Mark[] {
	const marks: Mark[] = [];
	const covered: { from: number, to: number }[] = [];
	if(withAccesses) {
		for(const access of accessesOf(line, number)) {
			covered.push(access);
			marks.push({ from: access.from, to: access.to, tag: 'v', attrs: `data-name="${access.criterion}" data-label="${escape(access.text)}"` });
		}
	}
	for(const { criterion, name, tip } of names) {
		for(const range of nameRanges(line, name)) {
			if(covered.some(c => overlaps(c, range))) {
				continue;
			}
			marks.push({ from: range.from, to: range.to, tag: 'v', attrs: `data-name="${criterion}" data-label="${escape(name)}"${tip ? ` data-tip="${escape(tip)}"` : ''}` });
		}
	}
	return marks;
}

/** renders a line by tokenizing it whole, so a mark's tag wraps tokens without re-tokenizing in isolation */
function highlightWithMarks(line: string, marks: readonly Mark[]): string {
	const sorted = [...marks].sort((a, b) => a.from - b.from);
	let out = '';
	let col = 1;
	let mi = 0;
	let active: { mark: Mark, buf: string } | undefined;
	for(const token of tokenizeR(line)) {
		const from = col;
		const to = col + token.text.length - 1;
		col = to + 1;
		while(!active && mi < sorted.length && sorted[mi].from < from) {
			mi++;   // a mark that starts inside a token already rendered plain; drop it
		}
		if(!active && mi < sorted.length && sorted[mi].from === from) {
			active = { mark: sorted[mi], buf: '' };
			mi++;
		}
		const rendered = renderRToken(token);
		if(active) {
			active.buf += rendered;
			if(to >= active.mark.to) {
				out += `<${active.mark.tag} ${active.mark.attrs}>${active.buf}</${active.mark.tag}>`;
				active = undefined;
			}
		} else {
			out += rendered;
		}
	}
	return out;
}

function render(data: PageData): string {
	const sliceCode = SliceSample.split('\n').map((line, index) => {
		const number = index + 1;
		const keeps = Object.entries(data.slices).filter(([, lines]) => lines.includes(number)).map(([key]) => key);
		/* every occurrence carries its own criterion (`5@survey` and `9@survey` are different questions) */
		const marked = highlightWithMarks(line, marksFor(line, number,
			Names.map(name => ({ criterion: `${number}@${name}`, name })), true));
		return `\t\t\t<span class="line"${keeps.length > 0 ? ` data-keep="${keeps.join(' ')}"` : ''}>${marked}</span>`;
	}).join('\n');

	/**
	 * The pointing mechanic of the slice tab, for a tab whose answers are per name: every name carries
	 * its criterion, and `found` (when given) writes the answer beside the line and into the tooltip.
	 */
	const pointable = (code: string, criteria: readonly string[], found: string[][] = []): string => code.split('\n').map((line, index) => {
		const mine = criteria.filter(c => c.startsWith(`${index + 1}@`));
		const said = (criterion: string): string => found.filter(([c]) => c === criterion).map(([, , text]) => text).join('; ');
		const named = highlightWithMarks(line, marksFor(line, index + 1, mine.map(criterion => ({
			criterion,
			name: criterion.slice(criterion.indexOf('@') + 1),
			tip:  said(criterion) ? `value: ${said(criterion)}` : undefined
		})), false));
		const note = found.filter(([c]) => mine.includes(c)).map(([, value]) => value).join('; ');
		return `\t\t\t<span class="line" data-line="${index + 1}"${note ? ` data-note="# ${escape(note)}"` : ''}>${named}</span>`;
	}).join('\n');

	const rows = (pairs: string[][], pointing = false): string => pairs.map(([label, value, target]) => {
		const at = pointing ? ` data-for="${escape(label)}"${target && target !== '0' ? ` data-target="${target}"` : ''}` : '';
		return `\t\t\t<span class="line"${at}><b>${escape(label)}</b>${escape(value)}</span>`;
	}).join('\n');

	const flagged = (code: string, found: readonly Finding[]): string => code.split('\n').map((line, index) => {
		const number = index + 1;
		/* several rules can point at the very same token, and marks must not nest: one mark per range,
		   applied right to left so the earlier columns still refer to the untouched text */
		const ranges = new Map<string, { from: number, to: number, rules: string[] }>();
		for(const f of found.filter(f => f.line === number && f.to > f.from)) {
			const key = `${f.from}-${f.to}`;
			const range = ranges.get(key) ?? { from: f.from, to: f.to, rules: [] };
			ranges.set(key, range);
			range.rules.push(f.what);
		}
		let covered = Infinity;
		const marks: Mark[] = [];
		for(const range of [...ranges.values()].sort((a, b) => b.from - a.from)) {
			if(range.to >= covered) {
				continue;   // overlaps a mark that is already there
			}
			covered = range.from;
			marks.push({ from: range.from, to: range.to, tag: 'bad', attrs: `data-tip="${escape(range.rules.join(' + '))}"` });
		}
		const html = highlightWithMarks(line, marks);
		return `\t\t\t<span class="line" data-line="${number}">${html}</span>`;
	}).join('\n');

	const kindsOn = (pairs: string[][], line: number): string[] =>
		[...new Set(pairs.filter(([, , at]) => at === String(line)).map(([kind]) => kind))];
	const depSource = (code: string, pairs: string[][]): string => code.split('\n').map((line, index) => {
		const number = index + 1;
		const mine = pairs.filter(([, , at]) => at === String(number));
		const kinds = kindsOn(pairs, number);
		/* a run of lines doing the same thing (`plot` then `abline` on it) is labelled once, at its start */
		const repeats = kinds.length > 0 && kinds.join() === kindsOn(pairs, number - 1).join();
		const continues = kinds.length > 0 && kinds.join() === kindsOn(pairs, number + 1).join();
		const tag = kinds.length > 0 && !repeats ? ` data-kind="${escape(kinds.join(', '))}"` : '';
		const run = kinds.length > 0 ? ` data-run="${escape(kinds.join())}"` : '';
		const edge = repeats && continues ? ' mid' : repeats ? ' last' : continues ? ' first' : '';
		const said = mine.map(([kind, value]) => value === '?' ? Silent[kind] ?? kind : `${Verbs[kind] ?? kind} ${value}`).join(', ');
		const tip = said.length > 0 ? ` data-tip="${escape(said)}"` : '';
		return `\t\t\t<span class="line${kinds.length > 0 ? ' dep ' + kinds[0] + edge : ''}" data-line="${number}"${run}${tag}${tip}>${highlightR(line)}</span>`;
	}).join('\n');

	/* one bar per answer, scaled against the slowest of them */
	const measured = timings();
	const bars = (measured?.rows ?? [])
		.map(([label, ms, trend]) => `\t\t<span class="timing">${escape(label)}${trend}<b>${escape(ms)} ms</b></span>`)
		.join('\n');

	return Template
		.replace('<!--UPDATED-->', lastUpdated())
		.replace('<!--TIMES-->', bars)
		.replace('<!--BENCHFILES-->', measured?.files ?? '')
		.replace('<!--BENCHLINES-->', measured?.lines ?? '')
		.replace('<!--BENCHWHEN-->', measured?.when ?? '')
		.replace('<!--BENCHRELEASE-->', measured?.release ?? '')
		.replace('<!--BENCHCALIBRATION-->', measured?.calibration ?? '')
		.replace('<!--SLICE-->', sliceCode)
		.replace('<!--DEPSOURCE-->', depSource(DependencySample, data.dependencies))
		.replace('<!--LINTSOURCE-->', flagged(LintSample, data.lint))
		.replace('<!--ORIGIN-->', rows(data.origin, true))
		.replace('<!--SIGNATURE-->', rows(data.signature))
		.replace('<!--VALUESOURCE-->', pointable(ValueSample, ValueNames, data.values))
		.replace('<!--ORIGINSOURCE-->', pointable(OriginSample, OriginNames))
	;
}

const Template = template('landing-template.html');

void main();
