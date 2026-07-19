import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import Joi from 'joi';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { bold, italic, color, Colors } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import { RVersion } from '../../../util/r-version';
import { arraysGroupBy } from '../../../util/collections/arrays';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
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
	/** also explode the guessed space into concrete per-dependency version assignments (see {@link GuessExplodeOptions}) */
	readonly explode?:       GuessExplodeOptions;
}

/** how to explode the guessed constraint space into concrete version assignments */
export interface GuessExplodeOptions {
	/** iterate each dependency's versions newest-first (default) or oldest-first */
	readonly order?:  'newest' | 'oldest';
	/** a version to prefer per dependency when it survives the constraints (package name to version) */
	readonly prefer?: Readonly<Record<string, string>>;
	/** cap the number of assignments produced */
	readonly limit?:  number;
}

/** one concrete version choice per resolvable dependency (`package -> version`) */
export interface VersionAssignmentView {
	readonly versions: Readonly<Record<string, string>>;
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
	readonly minVersion?:         string;
	readonly maxVersion?:         string;
	/** how many candidate versions survived every constraint */
	readonly candidateCount:      number;
	/** how many versions the database carries in total for the package (the history the candidates are drawn from) */
	readonly totalVersions?:      number;
	/** the surviving candidate versions, ascending (capped, see {@link GuessDepVersionsQuery.maxCandidates}) */
	readonly candidates?:         readonly string[];
	/** whether the listed {@link candidates} were capped */
	readonly truncated?:          boolean;
	readonly evidence:            readonly GuessVersionEvidence[];
	/** set when the constraints contradict each other so that no version can satisfy them all */
	readonly unsatisfiable?:      boolean;
}

export interface GuessDepVersionsQueryResult extends BaseQueryResult {
	readonly dependencies: readonly GuessedDependency[];
	/** the effective date cutoff that was applied (ISO `YYYY-MM-DD`), if any */
	readonly dateCutoff?:  string;
	/** the R version the guess assumed when bounding base-R packages, if known */
	readonly rVersion?:    string;
	/** concrete version assignments, present when {@link GuessDepVersionsQuery.explode} was requested (most-preferred first) */
	readonly assignments?: readonly VersionAssignmentView[];
	/** a note, e.g. when the signature database is unavailable */
	readonly message?:     string;
}

/** parse a repl line: `[pkg ...] [--date YYYY.MM.DD] [--max N] [--explode [--oldest] [--limit N] [--prefer pkg=ver ...]]` */
function guessDepVersionsLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'guess-dep-versions'> {
	const packages: string[] = [];
	const codeParts: string[] = [];
	let date: string | undefined;
	let maxCandidates: number | undefined;
	let explode = false;
	let order: 'newest' | 'oldest' | undefined;
	let limit: number | undefined;
	const prefer: Record<string, string> = {};
	for(let i = 0; i < line.length; i++) {
		const tok = line[i];
		if(tok.length === 0) {
			continue;
		}
		if(tok === '--date') {
			date = line[++i];
		} else if(tok === '--max') {
			maxCandidates = Number(line[++i]);
		} else if(tok === '--explode') {
			explode = true;
		} else if(tok === '--oldest') {
			order = 'oldest';
		} else if(tok === '--newest') {
			order = 'newest';
		} else if(tok === '--limit') {
			limit = Number(line[++i]);
		} else if(tok === '--prefer') {
			const [pkg, ver] = (line[++i] ?? '').split('=');
			if(pkg && ver) {
				prefer[pkg] = ver;
			}
		} else if(tok === '--only') {
			packages.push(...(line[++i] ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0));
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
			...explodeOpts
		}]
	};
}

const evidenceColor: Record<GuessEvidenceSource, Colors> = {
	declared:   Colors.Cyan,
	transitive: Colors.Blue,
	signature:  Colors.Magenta,
	date:       Colors.Yellow,
	'base-r':   Colors.Green
};

/** a one-letter marker per evidence source (shown instead of a bullet, so the source is legible without color) */
const evidenceLetter: Record<GuessEvidenceSource, string> = {
	declared:   'd',
	transitive: 't',
	signature:  's',
	date:       'D',
	'base-r':   'b'
};

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

export const GuessDepVersionsQueryDefinition = {
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
		for(const dep of out.dependencies) {
			const tag = dep.base ? italic('[base]', formatter) + ' ' : '';
			const range = dep.unsatisfiable ? color('unsatisfiable', Colors.Red, formatter) : bold(dep.range, formatter);
			const count = dep.totalVersions !== undefined ? `${dep.candidateCount}/${dep.totalVersions} versions` : `${dep.candidateCount} candidate${dep.candidateCount === 1 ? '' : 's'}`;
			result.push(`   ${tag}${dep.package}: ${range} (${count})`);
			// non-signature evidence (declared/transitive/date/base-r): one deduplicated bullet each
			const seen = new Set<string>();
			for(const ev of dep.evidence) {
				if(ev.source === 'signature') {
					continue;
				}
				const line = `${ev.bound ? ev.bound + ' ' : ''}${ev.detail} [${ev.origin}]`;
				if(seen.has(line)) {
					continue;
				}
				seen.add(line);
				result.push(`      ${color(evidenceLetter[ev.source], evidenceColor[ev.source], formatter)} ${line}`);
			}
			// signature evidence: one bullet per function, its tightest bound plus what raised it (new/parameters)
			const byFn = arraysGroupBy(dep.evidence.filter(e => e.source === 'signature'), e => e.function ?? e.origin);
			for(const [fn, evs] of byFn) {
				const bounds = [tightestBound(evs, '>='), tightestBound(evs, '<=')].filter(Boolean).join(' ');
				const params = [...new Set(evs.filter(e => e.parameter).map(e => e.parameter as string))];
				const reasons = [evs.some(e => !e.parameter) ? 'new' : undefined, params.length > 0 ? `params: [${params.join(', ')}]` : undefined].filter(Boolean).join(', ');
				result.push(`      ${color(evidenceLetter.signature, evidenceColor.signature, formatter)} ${bounds ? bounds + ' ' : ''}${fn}${reasons ? ` (${reasons})` : ''}`);
			}
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
	schema:   Joi.object({
		type:          Joi.string().valid('guess-dep-versions').required().description('The type of the query.'),
		packages:      Joi.array().items(Joi.string()).optional().description('Restrict the guess to these packages; omit to guess for every declared and used dependency.'),
		date:          Joi.string().optional().description('Only consider versions released on or before this day, written YYYY.MM.DD (also YYYY or YYYY.MM).'),
		maxCandidates: Joi.number().integer().min(0).optional().description('Cap the number of candidate versions listed per dependency.'),
		explode:       Joi.object({
			order:  Joi.string().valid('newest', 'oldest').optional().description('Iterate each dependency newest-first (default) or oldest-first.'),
			prefer: Joi.object().pattern(Joi.string(), Joi.string()).optional().description('A version to prefer per dependency when it survives the constraints.'),
			limit:  Joi.number().integer().min(0).optional().description('Cap the number of concrete assignments produced.')
		}).optional().description('Also explode the guessed space into concrete per-dependency version assignments.')
	}).description('Guesses the possible version range of every dependency from declared constraints and signature-database usage.'),
	flattenInvolvedNodes: (): NodeId[] => []
} as const satisfies SupportedQuery<'guess-dep-versions'>;
