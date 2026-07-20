import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, italic, faint, color, Colors } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { RVersion, type VersionString } from '../../../util/r-version';
import { arraysGroupBy } from '../../../util/collections/arrays';
import { Identifier } from '../../../dataflow/environments/identifier';
import { rdrrDocUrl } from '../signature-query/signature-query-executor';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import { VersionSelection, type FlowrConfig } from '../../../config';
import { executeGuessDepVersionsQuery } from './guess-dep-versions-query-executor';
import type { ConstraintSource, DerivedConstraint } from '../../../project/dependency-version-space';

/**
 * Guesses the possible version range of every dependency of a project by combining what the project *declares*
 * (a `DESCRIPTION` range, an `rproject.toml` entry, a lockfile pin, and their transitive constraints) with what
 * the code actually *does* (which package functions it calls and with which arguments, matched against the
 * {@link https://github.com/flowr-analysis/flowr/wiki/Signature-Database|signature database}). A named argument
 * a function only gained in some version raises the lower bound ("this parameter only existed from version X.Y,
 * so it must be at least X.Y"); an optional `date` caps every guess to releases available at that point in time,
 * and base-R packages are additionally bounded by the assumed/declared R version.
 */
export interface GuessDepVersionsQuery extends BaseQueryFormat {
	readonly type:           'guess-dep-versions';
	/** restrict the guess to these packages; omit to guess for every declared and used dependency */
	readonly packages?:      readonly string[];
	/** only consider versions released on or before this day, written `YYYY.MM.DD` (also `YYYY` or `YYYY.MM`) */
	readonly date?:          string;
	/** cap the number of candidate versions listed per dependency in the result (default {@link DefaultCandidateCap}) */
	readonly maxCandidates?: number;
	/** bound both fixpoint loops (mutual transitive refinement and arc consistency), default {@link DefaultFixpointIterations} */
	readonly maxIterations?: number;
	/** ignore the project's declared constraints (`DESCRIPTION` ranges, lockfile pins, transitive requirements); guess purely from code usage and the date/R bounds */
	readonly clean?:         boolean;
	/** exclude these evidence sources from consideration entirely (repl: `--disabled` followed by their one-letter codes, e.g. `--disabled ds` for declared+signature) */
	readonly disabled?:      readonly ConstraintSource[];
	/** also explode the guessed space into concrete per-dependency version assignments (see {@link GuessExplodeOptions}) */
	readonly explode?:       GuessExplodeOptions;
}

/** how to explode the guessed constraint space into concrete version assignments */
export interface GuessExplodeOptions {
	/** iterate each dependency's versions newest-first (default) or oldest-first */
	readonly order?:  'newest' | 'oldest';
	/** a version to prefer per dependency when it survives the constraints (package name to version) */
	readonly prefer?: Readonly<Record<string, VersionString>>;
	/** cap the number of assignments produced */
	readonly limit?:  number;
}

/** one concrete version choice per resolvable dependency (`package -> version`) */
export interface VersionAssignmentView {
	readonly versions: Readonly<Record<string, VersionString>>;
}

/** the default cap on how many surviving candidate versions are listed per dependency */
export const DefaultCandidateCap = 16;

/** where a single bound on a dependency's version came from (the {@link DerivedConstraint} source, from the resolver) */
export type GuessEvidenceSource = ConstraintSource;

/**
 * One provenance-carrying constraint on a dependency's version: where it comes from (`source`/`origin`) and what
 * it requires (`bound`). The set of these on a {@link GuessedDependency} is exactly why the range is what it is, so
 * it can answer "it must be `>= 4.2.0` because ...". This is the resolver's {@link DerivedConstraint}.
 */
export type GuessVersionEvidence = DerivedConstraint;

/** the guessed version range of one dependency */
export interface GuessedDependency {
	readonly package:             string;
	/** whether this is an R-core / base package (then its version *is* the R version) */
	readonly base:                boolean;
	/** the raw version constraints declared for the package (`>= 1.0.0`, a lockfile pin, ...) */
	readonly declaredConstraints: readonly string[];
	/** the resulting range, e.g. `>=1.0.0 <=1.1.4`, an exact `1.1.4`, or `*` when nothing constrains it */
	readonly range:               string;
	readonly minVersion?:         VersionString;
	readonly maxVersion?:         VersionString;
	/** how many candidate versions survived every constraint */
	readonly candidateCount:      number;
	/** how many versions the database carries in total for the package (the history the candidates are drawn from) */
	readonly totalVersions?:      number;
	/** the surviving candidate versions, ascending (capped, see {@link GuessDepVersionsQuery.maxCandidates}) */
	readonly candidates?:         readonly VersionString[];
	/** whether the listed {@link candidates} were capped */
	readonly truncated?:          boolean;
	readonly evidence:            readonly GuessVersionEvidence[];
	/** set when the constraints contradict each other so that no version can satisfy them all */
	readonly unsatisfiable?:      boolean;
	/** the other packages this one shares a version with, so its range is not independent of theirs */
	readonly linkedWith?:         readonly string[];
	/**
	 * Whether the analyzed code actually uses this package (a declared-but-never-used dependency is unconstrained):
	 * either a direct call, or the project's own NAMESPACE registering an S3 method for a class this package OWNS
	 * (see `PackageSignatureSource.classOwner`), e.g. tseries's `S3method("as.irts","zoo")` marks `zoo` used with
	 * no direct `zoo::`/`library(zoo)` call.
	 */
	readonly used?:               boolean;
}

export interface GuessDepVersionsQueryResult extends BaseQueryResult {
	readonly dependencies:          readonly GuessedDependency[];
	/** the effective date cutoff that was applied (ISO `YYYY-MM-DD`), if any */
	readonly dateCutoff?:           string;
	/** the R version the guess assumed when bounding base-R packages, if known */
	readonly rVersion?:             string;
	/** the configured version-selection policy the sample illustrates (newest by default; see `solver.sigdb.versionSelection`) */
	readonly versionSelection?:     VersionSelection;
	/** version tuples that satisfy every interdependency (the base/R hub counted against each dependency) */
	readonly runnableCombinations?: number;
	/** the whole version space those tuples are drawn from (product of each counted factor's total versions) */
	readonly possibleCombinations?: number;
	/** groups of packages interlinked to one shared version (the base/R group plus any configured groups), so their versions are not independent */
	readonly linkedGroups?:         readonly (readonly string[])[];
	/** concrete version assignments, present when {@link GuessDepVersionsQuery.explode} was requested (most-preferred first) */
	readonly assignments?:          readonly VersionAssignmentView[];
	/** a note, e.g. when the signature database is unavailable */
	readonly message?:              string;
}

/** parse a repl line: `[(clean[:<=YYYY])] [pkg ...] [--date YYYY.MM.DD] [--max N] [--iterations N] [--disabled <letters>] [--explode [--oldest] [--limit N] [--prefer pkg=ver ...]]` */
function guessDepVersionsLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'guess-dep-versions'> {
	const packages: string[] = [];
	const codeParts: string[] = [];
	let date: string | undefined;
	let maxCandidates: number | undefined;
	let maxIterations: number | undefined;
	let clean = false;
	let explode = false;
	let order: 'newest' | 'oldest' | undefined;
	let limit: number | undefined;
	const prefer: Record<string, string> = {};
	const disabled = new Set<GuessEvidenceSource>();
	// an optional parenthesised clause `(clean)`, `(<=2025)`, or `(clean:<=2025)`: `clean` drops declared constraints, a (`<=`-prefixed) date caps the window
	const tokens = [...line];
	const open = tokens.findIndex(t => t.startsWith('('));
	const close = open < 0 ? -1 : tokens.findIndex((t, i) => i >= open && t.endsWith(')'));
	if(open >= 0 && close >= open) {
		const clause = tokens.slice(open, close + 1).join(' ').replace(/^\(|\)$/g, '');
		for(const part of clause.split(/[:,]/).map(s => s.trim()).filter(s => s.length > 0)) {
			if(part === 'clean') {
				clean = true;
			} else {
				date = part.replace(/^<=/, '').trim(); // `<=2025` or a bare `2025`/`2025.06` cap
			}
		}
		tokens.splice(open, close - open + 1);
	}
	for(let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if(tok.length === 0) {
			continue;
		}
		if(tok === '--date') {
			date = tokens[++i];
		} else if(tok === '--max') {
			maxCandidates = Number(tokens[++i]);
		} else if(tok === '--iterations' || tok === '--iter') {
			maxIterations = Number(tokens[++i]);
		} else if(tok === '--explode') {
			explode = true;
		} else if(tok === '--oldest') {
			order = 'oldest';
		} else if(tok === '--newest') {
			order = 'newest';
		} else if(tok === '--limit') {
			limit = Number(tokens[++i]);
		} else if(tok === '--prefer') {
			const [pkg, ver] = (tokens[++i] ?? '').split('=');
			if(pkg && ver) {
				prefer[pkg] = ver;
			}
		} else if(tok === '--only') {
			packages.push(...(tokens[++i] ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0));
		} else if(tok === '--disabled') {
			for(const ch of tokens[++i] ?? '') {
				const source = letterToSource[ch];
				if(source) {
					disabled.add(source);
				}
			}
		} else if(!tok.startsWith('--')) {
			// every bare token is the code to analyse (a `file://`/`watch://` target, a bare path -- auto-prepended to
			// `file://` by the repl -- or inline R code); package filters are the explicit `--only` flag, so nothing is guessed
			codeParts.push(tok);
		}
	}
	const explodeOpts = explode ? {
		explode: {
			...(order ? { order } : {}),
			...(limit !== undefined && !Number.isNaN(limit) ? { limit } : {}),
			...(Object.keys(prefer).length > 0 ? { prefer } : {})
		}
	} : {};
	return {
		rCode: codeParts.length > 0 ? codeParts.join(' ') : undefined,
		query: [{
			type: 'guess-dep-versions',
			...(packages.length > 0 ? { packages } : {}),
			...(date ? { date } : {}),
			...(maxCandidates !== undefined && !Number.isNaN(maxCandidates) ? { maxCandidates } : {}),
			...(maxIterations !== undefined && !Number.isNaN(maxIterations) ? { maxIterations } : {}),
			...(clean ? { clean } : {}),
			...(disabled.size > 0 ? { disabled: [...disabled] } : {}),
			...explodeOpts
		}]
	};
}

const evidenceColor: Record<GuessEvidenceSource, Colors> = {
	declared:   Colors.Cyan,
	transitive: Colors.Blue,
	signature:  Colors.Magenta,
	date:       Colors.Yellow,
	'base-r':   Colors.Green,
	available:  Colors.White,
	indirect:   Colors.Red
};

/** priority when several sources state the same bound: the lowest-ranked stays active, the rest gray out */
const sourceRank: Record<GuessEvidenceSource, number> = {
	declared:   0,
	transitive: 1,
	indirect:   2,
	'base-r':   3,
	date:       4,
	signature:  5,
	available:  6
};

/** a one-letter marker per evidence source (shown instead of a bullet, so the source is legible without color) */
const evidenceLetter: Record<GuessEvidenceSource, string> = {
	declared:   'd',
	transitive: 't',
	signature:  's',
	date:       'D',
	'base-r':   'b',
	available:  '#',
	indirect:   'i'
};

/** inverse of {@link evidenceLetter}, decoding a `--disabled` flag's letters back to sources */
const letterToSource: Record<string, GuessEvidenceSource> = Object.fromEntries(
	(Object.entries(evidenceLetter) as [GuessEvidenceSource, string][]).map(([source, letter]) => [letter, source])
);

/** the tightest bound among a function's signature constraints for the given operator: highest `>=` or lowest `<=` */
function tightestBound(evs: readonly DerivedConstraint[], op: '>=' | '<='): string | undefined {
	let best: string | undefined, bestVer: string | undefined;
	for(const e of evs) {
		if(!e.bound?.startsWith(op)) {
			continue;
		}
		const ver = e.bound.slice(op.length).trim();
		if(bestVer === undefined || (op === '>=' ? RVersion.compare(ver, bestVer) > 0 : RVersion.compare(ver, bestVer) < 0)) {
			bestVer = ver;
			best = e.bound;
		}
	}
	return best;
}

/** a version-valued bound like `>=1.2.0` or `>= 3.1.0` (space-tolerant) split into operator and version (dates such as `<=2021-05-31` are not version bounds) */
function versionBound(bound: string | undefined): { op: '>=' | '<=', ver: string } | undefined {
	const m = /^(>=|<=)\s*(\d[\w.-]*)$/.exec(bound ?? '');
	if(!m || !RVersion.parse(m[2])) {
		return undefined;
	}
	return { op: m[1] === '>=' ? '>=' : '<=', ver: m[2] };
}

/** whether a dependency's version is actually narrowed (not every database version survives); a fully redundant one is unconstrained */
function isConstrained(dep: GuessedDependency): boolean {
	return dep.totalVersions !== undefined && dep.candidateCount !== dep.totalVersions;
}

/** a version-combination count with thousands separators (exponential only past a trillion, where digits stop being useful) */
function formatCombinations(n: number): string {
	return n >= 1e12 ? n.toExponential(1) : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** a parameter list, truncated with `...` once it gets long so a many-argument function stays on one readable line */
function formatParams(params: readonly string[]): string {
	const shown = 4;
	return params.length > shown ? `${params.slice(0, shown).join(', ')} (+${params.length - shown})` : params.join(', ');
}

/** a short, readable phrase for one non-signature bound, its origin(s) folded in (so several packages sharing a bound collapse to one line) */
function nonSignaturePhrase(source: GuessEvidenceSource, bound: string | undefined, origins: readonly string[]): string {
	const b = bound ? bound.replace(/([<>]=?)\s+/g, '$1') + ' ' : '';
	switch(source) {
		case 'declared':   return `${b}declared`;
		case 'transitive': return `${b}required by ${origins.join(', ')}`;
		case 'date':       return `releases up to ${origins[0]}`;
		case 'base-r':     return `${b}bounded by ${origins[0]}`;
		case 'available':  return `${b}available in database`;
		case 'indirect':   return `${b}via ${origins.join(', ')}`;
		default:           return b.trim();
	}
}

/** a version bound is dominated when a strictly tighter same-direction bound exists (a redundant `>=`/`<=`) */
function isDominated(bound: string | undefined, tightestGe: string | undefined, tightestLe: string | undefined): boolean {
	const b = versionBound(bound);
	if(!b) {
		return false;
	}
	return b.op === '>=' ? tightestGe !== undefined && RVersion.compare(b.ver, tightestGe) < 0
		: tightestLe !== undefined && RVersion.compare(b.ver, tightestLe) > 0;
}

export const GuessDepVersionsQueryDefinition = {
	title:           'Guess Dependency Versions Query',
	executor:        executeGuessDepVersionsQuery,
	asciiSummarizer: (formatter, _analyzer, queryResults, result, _query) => {
		const out = queryResults as QueryResults<'guess-dep-versions'>['guess-dep-versions'];
		result.push(`Query: ${bold('guess-dep-versions', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		if(out.dateCutoff) {
			result.push(`   ╰ up to ${italic(out.dateCutoff, formatter)}${out.rVersion ? `, R ${italic(out.rVersion, formatter)}` : ''}`);
		} else if(out.rVersion) {
			result.push(`   ╰ R ${italic(out.rVersion, formatter)}`);
		}
		if(out.dependencies.some(d => d.evidence.length > 0)) {
			const legend = (Object.keys(evidenceLetter) as GuessEvidenceSource[]).map(s => `${color(evidenceLetter[s], evidenceColor[s], formatter)} ${s}`).join('  ');
			result.push(`   ${italic('evidence', formatter)}: ${legend}`);
		}
		if(out.message) {
			result.push(`   ╰ ${color(out.message, Colors.Red, formatter)}`);
		}
		const resolvable = out.dependencies.filter(d => d.totalVersions !== undefined && d.totalVersions > 0);
		// the sample illustrates the configured selection policy: the oldest satisfying version, else the newest
		const selection = out.versionSelection ?? VersionSelection.Newest;
		const pick = (d: GuessedDependency): VersionString | undefined => selection === VersionSelection.Oldest ? d.minVersion : d.maxVersion;
		const sample = resolvable.filter(d => pick(d)).map(d => `${d.package}@${pick(d)}`);
		if(sample.length > 0) {
			// only the newest-selection sample can claim "works with all newest versions"; the reference "newest" is the
			// newest release the date window allows (== each pick when a date cutoff is set), else the database's latest
			const latestChecks = selection !== VersionSelection.Newest ? [] : out.dependencies
				.map(d => ({ name: d.package, max: d.maxVersion, newest: out.dateCutoff !== undefined ? d.maxVersion : versionBound(tightestBound(d.evidence.filter(e => e.source === 'available'), '<='))?.ver }))
				.filter((c): c is { name: string, max: string, newest: string } => c.max !== undefined && c.newest !== undefined);
			const staleLatest = latestChecks.filter(c => c.max !== c.newest);
			const latestSuffix = latestChecks.length === 0 ? ''
				: staleLatest.length === 0
					? ' ' + color('(works with all newest versions)', Colors.Green, formatter)
					: ' ' + faint(`(newest excluded: ${staleLatest.map(c => `${c.name} ${c.newest}, use ${c.max}`).join('; ')})`, formatter);
			result.push(`   ${color('▶', Colors.Green, formatter)} ${bold('sample', formatter)} ${faint(`(${selection})`, formatter)}: ${sample.join(', ')}${latestSuffix}`);
			const runnable = out.runnableCombinations, possible = out.possibleCombinations;
			if(runnable !== undefined && possible !== undefined && possible > 0) {
				const pct = runnable / possible * 100;
				result.push(`     ${italic('runnable combinations', formatter)}: ${bold(formatCombinations(runnable), formatter)} ${faint(`(${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%)`, formatter)}`);
			}
		}
		// the packages locked to one shared version
		for(const group of out.linkedGroups ?? []) {
			const rep = out.dependencies.find(d => group.includes(d.package) && d.maxVersion !== undefined);
			result.push(`   ${italic('linked', formatter)}: ${group.join(' + ')}${rep?.maxVersion ? faint(' @ ' + rep.maxVersion, formatter) : ''}`);
		}
		for(const dep of out.dependencies) {
			const groupTag = dep.base ? ' ' + italic('[base]', formatter)
				: dep.linkedWith ? ' ' + italic(`[linked: ${dep.linkedWith.join(', ')}]`, formatter) : '';
			const note = dep.base ? '' : dep.used === false ? ' ' + faint('(not called)', formatter) : !isConstrained(dep) && dep.totalVersions ? ' ' + faint('(any version)', formatter) : '';
			const tag = groupTag + note;
			const range = dep.unsatisfiable ? color('unsatisfiable', Colors.Red, formatter) : bold(dep.range, formatter);
			const count = dep.totalVersions !== undefined ? `${dep.candidateCount}/${dep.totalVersions} versions` : `${dep.candidateCount} candidate${dep.candidateCount === 1 ? '' : 's'}`;
			const avail = dep.evidence.filter(e => e.source === 'available');
			const dbGe = versionBound(tightestBound(avail, '>='))?.ver, dbLe = versionBound(tightestBound(avail, '<='))?.ver;
			const dbRange = dbGe !== undefined && dbLe !== undefined ? `, db ${dbGe} - ${dbLe}` : '';
			result.push(`   ${bold('━ ' + dep.package, formatter)}${tag}  ${range}  ${faint('(' + count + dbRange + ')', formatter)}`);
			const tightestGe = versionBound(tightestBound(dep.evidence, '>='))?.ver;
			const tightestLe = versionBound(tightestBound(dep.evidence.filter(e => versionBound(e.bound)), '<='))?.ver;
			const active: string[] = [], dominated: string[] = [];
			const nonSig = [...arraysGroupBy(dep.evidence.filter(e => e.source !== 'signature' && e.source !== 'available'), e => `${e.source}|${e.bound ?? ''}`)]
				.map(([, evs]) => ({ ev: evs[0], origins: [...new Set(evs.map(e => e.origin))] }));
			const bestRankByBound = new Map<string, number>();
			for(const { ev } of nonSig) {
				const vb = versionBound(ev.bound);
				if(vb === undefined || isDominated(ev.bound, tightestGe, tightestLe)) {
					continue;
				}
				const key = vb.op + vb.ver, rank = sourceRank[ev.source];
				const prev = bestRankByBound.get(key);
				if(prev === undefined || rank < prev) {
					bestRankByBound.set(key, rank);
				}
			}
			for(const { ev, origins } of nonSig) {
				const phrase = nonSignaturePhrase(ev.source, ev.bound, origins);
				const vb = versionBound(ev.bound);
				const best = vb === undefined ? undefined : bestRankByBound.get(vb.op + vb.ver);
				const redundant = best !== undefined && sourceRank[ev.source] > best;
				if(isDominated(ev.bound, tightestGe, tightestLe) || redundant) {
					dominated.push(`      ${faint(evidenceLetter[ev.source] + ' ' + phrase, formatter)}`);
				} else {
					active.push(`      ${color(evidenceLetter[ev.source], evidenceColor[ev.source], formatter)} ${phrase}`);
				}
			}
			// signature evidence: bare names, grouped by bound, tightest first; non-tightest bounds are redundant (grayed)
			const sigMarker = color(evidenceLetter.signature, evidenceColor.signature, formatter);
			const sigRecords = [...arraysGroupBy(dep.evidence.filter(e => e.source === 'signature'), e => e.function ?? e.origin)].map(([fn, evs]) => {
				const ge = tightestBound(evs, '>='), le = tightestBound(evs, '<=');
				const geVer = versionBound(ge)?.ver, leVer = versionBound(le)?.ver;
				const params = [...new Set(evs.map(e => e.parameter).filter((pm): pm is string => pm !== undefined))];
				const reasons = [evs.some(e => !e.parameter) ? 'new' : undefined, params.length > 0 ? `params: [${formatParams(params)}]` : undefined].filter(Boolean).join(', ');
				const name = Identifier.getName(Identifier.parse(fn));
				const url = rdrrDocUrl(dep.package, name, { base: dep.base, cran: !dep.base });
				const label = (url ? formatter.hyperlink(name, url) : name) + (reasons ? ` (${reasons})` : '');
				const redundant = !(geVer !== undefined && geVer === tightestGe) && !(leVer !== undefined && leVer === tightestLe);
				return { bounds: [ge, le].filter(Boolean).join(' '), label, redundant, geVer, leVer };
			}).sort((a, b) => RVersion.compare(b.geVer, a.geVer) || RVersion.compare(b.leVer, a.leVer));
			for(const [bounds, recs] of arraysGroupBy(sigRecords, r => r.bounds)) {
				const body = `${bounds ? bounds + ' ' : ''}${recs.map(r => r.label).join(', ')}`;
				if(recs[0].redundant) {
					dominated.push(`      ${faint(evidenceLetter.signature + ' ' + body, formatter)}`);
				} else {
					active.push(`      ${sigMarker} ${body}`);
				}
			}
			result.push(...active, ...dominated);
		}
		if(out.assignments) {
			result.push(`   ${bold('assignments', formatter)}: ${out.assignments.length}`);
			const first = out.assignments[0];
			if(first) {
				result.push(`      ${italic('preferred', formatter)}: ${Object.entries(first.versions).map(([p, v]) => `${p}@${v}`).join(', ')}`);
			}
		}
		return true;
	},
	fromLine: guessDepVersionsLineParser,
	syntax:   '@guess-dep-versions [<pkg> ...] [(clean | <=YYYY.MM.DD)] [--date YYYY.MM.DD] [--max <n>] [--iterations <n>] [--disabled <letters>] [--explode [--oldest] [--limit <n>] [--prefer <pkg>=<ver>]] <code | file://path>',
	schema:   Joi.object({
		type:          Joi.string().valid('guess-dep-versions').required().description('The type of the query.'),
		packages:      Joi.array().items(Joi.string()).optional().description('Restrict the guess to these packages; omit to guess for every declared and used dependency.'),
		date:          Joi.string().optional().description('Only consider versions released on or before this day, written YYYY.MM.DD (also YYYY or YYYY.MM).'),
		maxCandidates: Joi.number().integer().min(0).optional().description('Cap the number of candidate versions listed per dependency.'),
		maxIterations: Joi.number().integer().min(0).optional().description('Bound both fixpoint loops (mutual transitive refinement and arc consistency).'),
		clean:         Joi.boolean().optional().description('Ignore the project declared constraints (DESCRIPTION/lockfile/transitive); guess purely from code usage and the date/R bounds.'),
		disabled:      Joi.array().items(Joi.string().valid('declared', 'transitive', 'signature', 'date', 'base-r', 'available', 'indirect')).optional()
			.description('Exclude these evidence sources from consideration entirely (repl: --disabled followed by their one-letter codes, e.g. --disabled ds for declared+signature).'),
		explode: Joi.object({
			order:  Joi.string().valid('newest', 'oldest').optional().description('Iterate each dependency newest-first (default) or oldest-first.'),
			prefer: Joi.object().pattern(Joi.string(), Joi.string()).optional().description('A version to prefer per dependency when it survives the constraints.'),
			limit:  Joi.number().integer().min(0).optional().description('Cap the number of concrete assignments produced.')
		}).optional().description('Also explode the guessed space into concrete per-dependency version assignments.')
	}).description('Guesses the possible version range of every dependency from declared constraints and signature-database usage.'),
	flattenInvolvedNodes: (): NodeId[] => []
} as const satisfies SupportedQuery<'guess-dep-versions'>;
