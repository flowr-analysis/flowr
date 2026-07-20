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
import { sourceForPackage, type PackageSignatureSource } from '../../../project/sigdb/reader';
import {
	assignmentsOf,
	collectTransitiveConstraints,
	collectUsage,
	dateCutoff,
	DefaultExplodeLimit,
	defaultTargets,
	intersectSurvivors,
	isoDay,
	countRunnableCombinations,
	DefaultFixpointIterations,
	enforceArcConsistency,
	iterateToFixpoint,
	orderedCandidatesOf,
	survivingEntries,
	timelinePackageKey,
	type CountFactor,
	type TransitiveConstraint,
	type DerivedConstraint,
	type OrderedCandidates,
	type SurvivingEntries
} from '../../../project/dependency-version-space';

/** collects and deduplicates provenance-carrying constraints */
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
	let maxIterations: number | undefined;
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
		if(q.maxIterations !== undefined) {
			maxIterations = maxIterations === undefined ? q.maxIterations : Math.max(maxIterations, q.maxIterations);
		}
		explode ??= q.explode;
	}
	// keep the tightest date, or any malformed date to report it
	const date = earliestDate ?? anyDate;
	return {
		type: 'guess-dep-versions',
		...(anyAll || packages.size === 0 ? {} : { packages: [...packages] }),
		...(date ? { date } : {}),
		...(maxCandidates !== undefined ? { maxCandidates } : {}),
		...(maxIterations !== undefined ? { maxIterations } : {}),
		...(explode ? { explode } : {})
	};
}

/** format version range string from survivors and declared constraints, honest about gaps */
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
function guessPackage(name: string, cap: number, surviving: SurvivingEntries, evidence: EvidenceCollector, used: boolean, linkedWith?: readonly string[]): GuessedDependency {
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
		unsatisfiable:  unsatisfiable ? true : undefined,
		linkedWith:     linkedWith && linkedWith.length > 0 ? linkedWith : undefined,
		used
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
	// bound base packages by R only when the version is genuinely known; in `auto` mode with nothing detected, base tries every R release
	const rVersion = ctx.rVersionKnown ? (ctx.meta.getRVersion() ?? ctx.resolvedRVersion) : undefined;

	const usage = collectUsage((await analyzer.dataflow()).graph, deps);
	// the analyzed package guesses versions for its dependencies, not for itself
	const self = ctx.meta.getNamespace();
	const sorted = (query.packages && query.packages.length > 0 ? [...query.packages] : defaultTargets(deps, usage)).filter(name => name !== self).sort();

	// resolve (and cache) each target's timeline package key + merged source once, reused across both guess passes
	const sourceByName = new Map<string, { readonly key: string, readonly src: PackageSignatureSource | undefined }>();
	const sourceFor = (name: string): { readonly key: string, readonly src: PackageSignatureSource | undefined } => {
		let entry = sourceByName.get(name);
		if(entry === undefined) {
			const key = timelinePackageKey(name, sources);
			entry = { key, src: sourceForPackage(sources, key) };
			sourceByName.set(name, entry);
		}
		return entry;
	};

	// the guessed lower bound of every target under a set of transitive constraints (drives the mutual-constraint refinement)
	const guessLowerBounds = (trans: Map<string, TransitiveConstraint[]>): Map<string, string> => {
		const out = new Map<string, string>();
		for(const name of sorted) {
			const { key, src } = sourceFor(name);
			const s = survivingEntries(name, src, deps, usage.get(name), trans.get(name) ?? [], cutoff, rVersion, undefined, query.clean, key);
			if(s.survivors.length > 0) {
				out.set(name, s.survivors[0].ver);
			}
		}
		return out;
	};

	const maxIterations = query.maxIterations ?? DefaultFixpointIterations;
	let transitive = collectTransitiveConstraints(deps, sources);
	if(!query.clean) {
		let prev = '';
		iterateToFixpoint(maxIterations, () => {
			const pass = guessLowerBounds(transitive);
			const signature = Array.from(pass, ([k, v]) => `${k}=${v}`).sort().join(',');
			if(signature === prev) {
				return false;
			}
			prev = signature;
			transitive = collectTransitiveConstraints(deps, sources, name => pass.get(name));
			return true;
		});
	}

	const cap = query.maxCandidates ?? DefaultCandidateCap;
	const explodeOrder = query.explode?.order ?? 'newest';

	const guessedAll = sorted.map(name => {
		const { key, src } = sourceFor(name);
		const evidence = new EvidenceCollector();
		const surviving = survivingEntries(name, src, deps, usage.get(name), transitive.get(name) ?? [], cutoff, rVersion, evidence.add, query.clean, key);
		return { name, src, key, evidence, surviving };
	});

	const arcEntries = guessedAll.map(g => ({ name: g.name, src: g.src, key: g.key, survivors: g.surviving.survivors }));
	const blockers = query.clean ? new Map<string, Map<string, string>>() : enforceArcConsistency(arcEntries, maxIterations);
	guessedAll.forEach((g, i) => {
		g.surviving = { ...g.surviving, survivors: arcEntries[i].survivors };
		const max = g.surviving.survivors.at(-1)?.ver;
		for(const [partner, constraint] of blockers.get(g.name) ?? []) {
			if(max !== undefined) {
				g.evidence.add({ source: 'indirect', origin: `${partner} ${constraint}`, detail: `${g.name} capped by ${partner}`, bound: `<=${max}` });
			}
		}
	});

	// linked packages share one version: base/R group and configured groups; intersect survivor sets to keep them consistent
	const groups = [
		guessedAll.filter(g => g.surviving.base).map(g => g.name),
		...(ctx.config.solver.versionManagement?.linkedVersionGroups ?? [])
	];
	const linkedGroups: string[][] = [];
	const linkedWith = new Map<string, string[]>();
	for(const group of groups) {
		const members = guessedAll.filter(g => group.includes(g.name));
		if(members.length > 1) {
			const shared = intersectSurvivors(members.map(m => m.surviving.survivors));
			for(const m of members) {
				m.surviving = { ...m.surviving, survivors: shared };
			}
			linkedGroups.push(members.map(m => m.name));
			for(const m of members) {
				linkedWith.set(m.name, members.filter(o => o !== m).map(o => o.name));
			}
		}
	}

	// runnable combinations: the base/R group is the shared hub every other constrained package is counted against
	const grouped = new Set(linkedGroups.flat());
	const factorOf = (g: typeof guessedAll[number]): CountFactor => ({ name: g.name, src: g.src, key: g.key, survivors: g.surviving.survivors.map(e => e.ver) });
	let hub: CountFactor | undefined, hubTotal = 1, othersTotal = 1;
	const others: CountFactor[] = [];
	for(const group of linkedGroups) {
		const rep = guessedAll.find(g => group.includes(g.name));
		if(rep === undefined) {
			continue;
		}
		if(rep.surviving.base && hub === undefined) {
			hub = factorOf(rep);
			hubTotal = rep.surviving.total ?? 1;
		} else {
			others.push(factorOf(rep));
			othersTotal *= rep.surviving.total ?? 1;
		}
	}
	// a package is a counted factor only when a *real* constraint narrows it (declared/transitive/signature/indirect);
	// date/available narrowing alone must not promote an otherwise any-version package into the product, or a tighter
	// date cutoff could paradoxically grow the count by turning more packages into factors
	const reallyConstrained = (g: typeof guessedAll[number]): boolean =>
		g.evidence.list.some(e => e.source === 'declared' || e.source === 'transitive' || e.source === 'signature' || e.source === 'indirect');
	for(const g of guessedAll) {
		const total = g.surviving.total ?? 0;
		if(grouped.has(g.name) || total === 0 || !reallyConstrained(g)) {
			continue;
		}
		others.push(factorOf(g));
		othersTotal *= total;
	}
	const runnableCombinations = countRunnableCombinations(hub, others);
	const possibleCombinations = hubTotal * othersTotal;

	const dependencies: GuessedDependency[] = [];
	const ordered: OrderedCandidates[] = [];
	for(const g of guessedAll) {
		dependencies.push(guessPackage(g.name, cap, g.surviving, g.evidence, usage.has(g.name), linkedWith.get(g.name)));
		const oc = query.explode ? orderedCandidatesOf(g.src, g.name, g.surviving, query.explode.prefer?.[g.name], explodeOrder) : undefined;
		if(oc) {
			ordered.push(oc);
		}
	}

	const assignments = query.explode
		? [...assignmentsOf(ordered, query.explode.limit ?? DefaultExplodeLimit)].map(a => ({ versions: Object.fromEntries(a.versions) }))
		: undefined;

	return compactRecord({
		'.meta':          { timing: Date.now() - start },
		dependencies,
		dateCutoff:       cutoff ? isoDay(cutoff) : undefined,
		rVersion,
		versionSelection: ctx.config.solver.sigdb.versionSelection,
		runnableCombinations,
		possibleCombinations,
		linkedGroups:     linkedGroups.length > 0 ? linkedGroups : undefined,
		assignments,
		message
	}) as GuessDepVersionsQueryResult;
}
