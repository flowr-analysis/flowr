import type { Range } from 'semver';
import type { BasicQueryData } from '../../base-query-format';
import {
	DefaultCandidateCap,
	type GuessDepVersionsQuery,
	type GuessDepVersionsQueryResult,
	type GuessedDependency,
	type GuessVersionEvidence
} from './guess-dep-versions-query-format';
import { RVersion } from '../../../util/r-version';
import { compactRecord } from '../../../util/objects';
import {
	assignmentsOf,
	collectTransitiveConstraints,
	collectUsage,
	dateCutoff,
	DefaultExplodeLimit,
	defaultTargets,
	isoDay,
	orderedCandidatesOf,
	survivingEntries,
	type DerivedConstraint,
	type OrderedCandidates,
	type SurvivingEntries
} from '../../../project/dependency-version-space';

/** collects provenance-carrying constraints for one dependency, deduplicating identical ones; `add` is a resolver `ConstraintObserver` */
class EvidenceCollector {
	private readonly seen = new Set<string>();
	public readonly list: GuessVersionEvidence[] = [];

	public readonly add = (c: DerivedConstraint): void => {
		const key = `${c.source}|${c.origin}|${c.bound ?? ''}|${c.detail}`;
		if(this.seen.has(key)) {
			return;
		}
		this.seen.add(key);
		this.list.push(compactRecord({ ...c }) as GuessVersionEvidence);
	};
}

/** merge several guess-dep-versions queries into one: union the packages, keep the tightest (earliest date, smallest cap) */
function mergeQueries(queries: readonly GuessDepVersionsQuery[]): GuessDepVersionsQuery {
	if(queries.length === 1) {
		return queries[0];
	}
	const packages = new Set<string>();
	let anyAll = false;
	let earliestDate: string | undefined, earliestTime = Infinity, anyDate: string | undefined;
	let maxCandidates: number | undefined;
	let explode: GuessDepVersionsQuery['explode'];
	for(const q of queries) {
		if(q.packages) {
			for(const p of q.packages) {
				packages.add(p);
			}
		} else {
			anyAll = true;
		}
		if(q.date) {
			anyDate ??= q.date;
			const parsed = dateCutoff(q.date);
			if(parsed && parsed.getTime() < earliestTime) {
				earliestTime = parsed.getTime();
				earliestDate = q.date;
			}
		}
		if(q.maxCandidates !== undefined) {
			maxCandidates = maxCandidates === undefined ? q.maxCandidates : Math.min(maxCandidates, q.maxCandidates);
		}
		explode ??= q.explode;
	}
	// the tightest valid date wins; if every given date was malformed, keep one so the executor can report it
	const date = earliestDate ?? anyDate;
	return {
		type: 'guess-dep-versions',
		...(anyAll || packages.size === 0 ? {} : { packages: [...packages] }),
		...(date ? { date } : {}),
		...(maxCandidates !== undefined ? { maxCandidates } : {}),
		...(explode ? { explode } : {})
	};
}

/** the version range string from the surviving candidates (honest about gaps) and the declared fallbacks */
function rangeString(survivors: readonly string[], nonContiguous: boolean, unsatisfiable: boolean, declaredRange: Range | undefined, declaredConstraints: readonly string[], cap: number): string {
	if(survivors.length === 0) {
		if(unsatisfiable) {
			return declaredConstraints.join(' ') || '<contradiction>';
		}
		return declaredRange ? declaredRange.raw : '*';
	}
	if(survivors.length === 1) {
		return survivors[0];
	}
	const min = survivors[0], max = survivors[survivors.length - 1];
	if(!nonContiguous) {
		return `>=${min} <=${max}`;
	}
	// a version between min and max was rejected, so `>=min <=max` would falsely imply it is acceptable: be explicit
	return survivors.length <= cap ? survivors.join(', ') : `${min}...${max} (${survivors.length} discrete)`;
}

/** build the reported guess for one package from its already-computed surviving versions and provenance */
function guessPackage(name: string, cap: number, surviving: SurvivingEntries, evidence: EvidenceCollector): GuessedDependency {
	const { declaredRange, declaredConstraints, unsatisfiable } = surviving;
	const survivors = surviving.survivors.map(e => e.ver);
	const preSignature = surviving.preSignature.map(e => e.ver);
	// non-contiguous: the signature pass rejected a version that lies between the surviving min and max
	const nonContiguous = survivors.length > 1 && preSignature.some(v =>
		RVersion.compare(v, survivors[0]) > 0 && RVersion.compare(v, survivors[survivors.length - 1]) < 0 && !survivors.includes(v));
	const candidates = survivors.slice(0, cap);

	return compactRecord({
		package:        name,
		base:           surviving.base,
		declaredConstraints,
		range:          rangeString(survivors, nonContiguous, unsatisfiable, declaredRange, declaredConstraints, cap),
		minVersion:     survivors.length > 0 ? survivors[0] : undefined,
		maxVersion:     survivors.length > 0 ? survivors[survivors.length - 1] : undefined,
		candidateCount: survivors.length,
		totalVersions:  surviving.total,
		candidates:     candidates.length > 0 ? candidates : undefined,
		truncated:      survivors.length > cap ? true : undefined,
		evidence:       evidence.list,
		unsatisfiable:  unsatisfiable ? true : undefined
	}) as GuessedDependency;
}

/**
 * Executes a guess-dep-versions query.
 */
export async function executeGuessDepVersionsQuery(
	{ analyzer }: BasicQueryData, queries: readonly GuessDepVersionsQuery[]
): Promise<GuessDepVersionsQueryResult> {
	const start = Date.now();
	const query = mergeQueries(queries);

	const ctx = analyzer.inspectContext();
	const deps = ctx.deps;
	const sources = deps.signatureSources();
	if(sources.length === 0) {
		return {
			'.meta':      { timing: Date.now() - start },
			dependencies: [],
			message:      'No signature database is loaded; version guessing needs the signature database (see the Signature Database wiki).'
		};
	}

	let message: string | undefined;
	let cutoff: Date | undefined;
	if(query.date) {
		cutoff = dateCutoff(query.date);
		if(!cutoff) {
			message = `could not parse date '${query.date}', expected YYYY.MM.DD; ignoring the date bound`;
		}
	}
	const rVersion = ctx.meta.getRVersion() ?? ctx.resolvedRVersion;

	const usage = collectUsage((await analyzer.dataflow()).graph);
	const transitive = collectTransitiveConstraints(deps, sources);
	const targets = query.packages && query.packages.length > 0 ? [...query.packages] : defaultTargets(deps, usage);

	const cap = query.maxCandidates ?? DefaultCandidateCap;
	const explodeOrder = query.explode?.order ?? 'newest';
	const dependencies: GuessedDependency[] = [];
	const ordered: OrderedCandidates[] = [];
	for(const name of [...targets].sort()) {
		const src = sources.find(s => s.has(name));
		const evidence = new EvidenceCollector();
		const surviving = survivingEntries(name, src, deps, usage.get(name), transitive.get(name) ?? [], cutoff, rVersion, evidence.add);
		dependencies.push(guessPackage(name, cap, surviving, evidence));
		const oc = query.explode ? orderedCandidatesOf(src, name, surviving, query.explode.prefer?.[name], explodeOrder) : undefined;
		if(oc) {
			ordered.push(oc);
		}
	}

	const assignments = query.explode
		? [...assignmentsOf(ordered, query.explode.limit ?? DefaultExplodeLimit)].map(a => ({ versions: Object.fromEntries(a.versions) }))
		: undefined;

	return compactRecord({
		'.meta':    { timing: Date.now() - start },
		dependencies,
		dateCutoff: cutoff ? isoDay(cutoff) : undefined,
		rVersion,
		assignments,
		message
	}) as GuessDepVersionsQueryResult;
}
