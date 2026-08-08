import type { Range } from 'semver';
import type { BasicQueryData } from '../../base-query-format';
import {
	DefaultCandidateCap,
	type GuessDepVersionsQuery,
	type GuessDepVersionsQueryResult,
	type GuessedDependency,
	type GuessVersionEvidence,
	type OrphanAlternativeView,
	type OrphanEvidenceView
} from './guess-dep-versions-query-format';
import { RVersion } from '../../../util/r-version';
import { compactRecord } from '../../../util/objects';
import { VisualizeFunctions } from '../dependencies-query/function-info/visualize-functions';
import {
	assignmentsOf,
	declaredDependenciesOf,
	collectOrphanUsage,
	collectUsage,
	dateCutoff,
	DefaultExplodeLimit,
	defaultTargets,
	intersectSurvivors,
	isoDay,
	countRunnableCombinations,
	DefaultFixpointIterations,
	enforceArcConsistency,
	NoDisabledSources,
	orderedCandidatesOf,
	VersionSpace,
	type ConstraintSource,
	type CountFactor,
	type DerivedConstraint,
	type OrderedCandidates,
	type SurvivingEntries
} from '../../../project/dependency-version-space';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

/** flowR's curated builtin-library function to package map (e.g. `ggplot` to `ggplot2`), disambiguating an orphan call several packages re-export */
const BuiltinLibraryByFunction: ReadonlyMap<string, string> = new Map(
	VisualizeFunctions.filter(f => f.package !== undefined).map(f => [f.name, f.package as string])
);

/** the sources `query` disables: `clean` is sugar for disabling `declared`+`transitive`, `disabled` adds any others by name */
function disabledSources(query: GuessDepVersionsQuery): ReadonlySet<ConstraintSource> {
	if(!query.clean && !query.disabled?.length) {
		return NoDisabledSources;
	}
	return new Set([...(query.clean ? (['declared', 'transitive'] as const) : []), ...(query.disabled ?? [])]);
}

/** the `line:column` of a node (prefixed by its file when there is one), for pointing evidence at the code */
type Locator = (id: NodeId | undefined) => string | undefined;

function locatorOf(idMap: AstIdMap): Locator {
	return id => {
		const node = id === undefined ? undefined : idMap.get(id);
		const at = node?.location ?? node?.info.fullRange;
		return at === undefined ? undefined : `${node?.info.file ? node.info.file + ':' : ''}${at[0]}:${at[1]}`;
	};
}

/** collects and deduplicates provenance-carrying constraints, resolving their call site to a location */
class EvidenceCollector {
	private readonly seen = new Set<string>();
	public readonly list: GuessVersionEvidence[] = [];

	constructor(private readonly locate: Locator) {}

	public readonly add = (c: DerivedConstraint): void => {
		const key = `${c.source}|${c.origin}|${c.bound ?? ''}|${c.detail}`;
		if(this.seen.has(key)) {
			return;
		}
		this.seen.add(key);
		this.list.push(compactRecord({ ...c, location: this.locate(c.at) }));
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
	const disabled = new Set<ConstraintSource>();
	let anyClean = false;
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
		anyClean ||= q.clean === true;
		for(const s of q.disabled ?? []) {
			disabled.add(s);
		}
	}
	// keep the tightest date, or any malformed date to report it
	const date = earliestDate ?? anyDate;
	return {
		type: 'guess-dep-versions',
		...(anyAll || packages.size === 0 ? {} : { packages: [...packages] }),
		...(date ? { date } : {}),
		...(maxCandidates !== undefined ? { maxCandidates } : {}),
		...(maxIterations !== undefined ? { maxIterations } : {}),
		...(explode ? { explode } : {}),
		...(anyClean ? { clean: true } : {}),
		...(disabled.size > 0 ? { disabled: [...disabled] } : {})
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

/** what a guessed package is related to: the packages it shares a version with, and those its choice interacts with */
interface PackageRelations {
	readonly used:                boolean;
	readonly linkedWith?:         readonly string[];
	readonly coupledWith?:        readonly string[];
	/** the undefined orphan functions that inferred this package (e.g. `ggplot()` inferring `ggplot2`), if any */
	readonly orphanFunctions?:    readonly string[];
	/** per such function, where the undefined call is and why it was pinned on this package */
	readonly orphanEvidence?:     readonly OrphanEvidenceView[];
	/** the other packages exporting those functions, each with the versions of it that would fit the calls */
	readonly orphanAlternatives?: readonly OrphanAlternativeView[];
}

/** build the reported guess for one package from its already-computed surviving versions and provenance */
function guessPackage(name: string, cap: number, surviving: SurvivingEntries, evidence: EvidenceCollector, { used, linkedWith, coupledWith, orphanFunctions, orphanEvidence, orphanAlternatives }: PackageRelations): GuessedDependency {
	const { declaredRange, declaredConstraints, unsatisfiable } = surviving;
	const survivors = surviving.survivors.map(e => e.ver);
	const preSignature = surviving.preSignature.map(e => e.ver);
	// non-contiguous: the signature pass rejected a version that lies between the surviving min and max
	const nonContiguous = survivors.length > 1 && preSignature.some(v =>
		RVersion.compare(v, survivors[0]) > 0 && RVersion.compare(v, survivors[survivors.length - 1]) < 0 && !survivors.includes(v));
	const candidates = survivors.slice(0, cap);

	return compactRecord({
		package:            name,
		base:               surviving.base,
		declaredConstraints,
		range:              rangeString(survivors, nonContiguous, unsatisfiable, declaredRange, declaredConstraints, cap),
		minVersion:         survivors.length > 0 ? survivors[0] : undefined,
		maxVersion:         survivors.length > 0 ? survivors[survivors.length - 1] : undefined,
		candidateCount:     survivors.length,
		totalVersions:      surviving.total,
		candidates:         candidates.length > 0 ? candidates : undefined,
		truncated:          survivors.length > cap ? true : undefined,
		evidence:           evidence.list,
		unsatisfiable:      unsatisfiable ? true : undefined,
		linkedWith:         linkedWith && linkedWith.length > 0 ? linkedWith : undefined,
		coupledWith:        coupledWith && coupledWith.length > 0 ? coupledWith : undefined,
		known:              surviving.known ? undefined : false,
		orphan:             orphanFunctions && orphanFunctions.length > 0 ? true : undefined,
		orphanFunctions:    orphanFunctions && orphanFunctions.length > 0 ? orphanFunctions : undefined,
		orphanEvidence:     orphanEvidence && orphanEvidence.length > 0 ? orphanEvidence : undefined,
		orphanAlternatives: orphanAlternatives && orphanAlternatives.length > 0 ? orphanAlternatives : undefined,
		used
	});
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

	// the analyzed package guesses versions for its dependencies, not for itself
	const self = ctx.meta.getNamespace();
	const graph = (await analyzer.dataflow()).graph;
	const locate = locatorOf((await analyzer.normalize()).idMap);
	const usage = collectUsage(graph, deps);
	// fold orphan calls (`ggplot()` with ggplot2 neither declared nor loaded) into usage; a package the project does
	// not already know is flagged for downstream attachment (see collectOrphanUsage)
	const known = new Set<string>([...deps.getDependencies().map(d => d.name), ...deps.declaredPackageNames()]);
	const orphans = collectOrphanUsage(graph, deps, usage, pkg => known.has(pkg), { self, builtinLibraryOf: name => BuiltinLibraryByFunction.get(name) });
	const sorted = (query.packages && query.packages.length > 0 ? [...query.packages] : defaultTargets(deps, usage)).filter(name => name !== self).sort();

	const disabled = disabledSources(query);
	const space = new VersionSpace({ deps, usage, cutoff, rVersion, disabled });
	const maxIterations = query.maxIterations ?? DefaultFixpointIterations;
	const transitive = space.refineTransitive(sorted, maxIterations);

	const cap = query.maxCandidates ?? DefaultCandidateCap;
	const explodeOrder = query.explode?.order ?? 'newest';

	const guessedAll = sorted.map(name => {
		const evidence = new EvidenceCollector(locate);
		const surviving = space.survivors(name, transitive.get(name) ?? [], evidence.add);
		return { name, evidence, surviving };
	});

	const initial = new Map(guessedAll.map(g => [g.name, g.surviving.survivors]));
	const { survivors: pruned, blockers } = query.clean || disabled.has('indirect')
		? { survivors: initial, blockers: new Map<string, Map<string, string>>() }
		: enforceArcConsistency(space, initial, maxIterations);
	guessedAll.forEach(g => {
		g.surviving = { ...g.surviving, survivors: pruned.get(g.name) ?? g.surviving.survivors };
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

	// a package is a counted factor only when a *real* constraint bears on it (declared/transitive/signature/indirect);
	// date/available narrowing alone must not promote an otherwise any-version package into the product, or a tighter
	// date cutoff could paradoxically grow the count by turning more packages into factors. A partial constraint does
	// count: it does not narrow the package on its own, but it does couple it to the package that declares it
	const reallyConstrained = (g: typeof guessedAll[number]): boolean =>
		g.evidence.list.some(e => e.source === 'declared' || e.source === 'transitive' || e.source === 'signature' || e.source === 'indirect');
	// one factor per linked group (its members share a version) plus every other constrained package
	const grouped = new Set(linkedGroups.flat());
	const representatives = [
		...linkedGroups.map(group => guessedAll.find(g => group.includes(g.name))).filter(g => g !== undefined),
		...guessedAll.filter(g => !grouped.has(g.name) && (g.surviving.total ?? 0) > 0 && reallyConstrained(g))
	];
	const factors: CountFactor[] = representatives.map(g => ({ name: g.name, survivors: g.surviving.survivors.map(e => e.ver) }));
	const { total: runnableCombinations, couplings } = countRunnableCombinations(space, factors);
	const possibleCombinations = representatives.reduce((p, g) => p * (g.surviving.total ?? 1), 1);
	// the baseline the guess narrows down from: what the project already declares, before usage and interdependencies
	const anyDeclared = !disabled.has('declared') && representatives.some(g => g.surviving.declaredConstraints.length > 0);
	const declaredCombinations = anyDeclared ? representatives.reduce((p, g) => p * g.surviving.declared, 1) : undefined;
	// a coupled package's version is not free: report the partners, flagging one that only some versions impose
	const coupledWith = new Map<string, string[]>();
	for(const c of couplings) {
		for(const [pkg, partner] of [[c.a, c.b], [c.b, c.a]]) {
			coupledWith.set(pkg, [...coupledWith.get(pkg) ?? [], c.always ? partner : `${partner} (partial)`]);
		}
	}

	// the packages an orphan could have meant instead, resolved in a space of their own so that reporting them
	// does not turn them into dependencies of the project; built only when an orphan actually had a choice
	const altSpace = orphans.alternativeUsage.size > 0
		? new VersionSpace({ deps, usage: orphans.alternativeUsage, cutoff, rVersion, disabled }) : undefined;
	const orphanAlternatives = (pkg: string): OrphanAlternativeView[] =>
		(orphans.alternatives.get(pkg) ?? []).map(alt => {
			const s = (altSpace as VersionSpace).survivors(alt, []);
			const versions = s.survivors.map(e => e.ver);
			return compactRecord({
				package:        alt,
				range:          rangeString(versions, false, s.unsatisfiable, s.declaredRange, s.declaredConstraints, cap),
				minVersion:     versions[0],
				maxVersion:     versions[versions.length - 1],
				candidateCount: versions.length,
				totalVersions:  s.total
			});
		});

	const dependencies: GuessedDependency[] = [];
	const ordered: OrderedCandidates[] = [];
	for(const g of guessedAll) {
		const orphanCalls = [...orphans.attributed.get(g.name) ?? []].sort(([a], [b]) => a.localeCompare(b));
		dependencies.push(guessPackage(g.name, cap, g.surviving, g.evidence, {
			used:               usage.has(g.name),
			linkedWith:         linkedWith.get(g.name),
			coupledWith:        coupledWith.get(g.name),
			orphanFunctions:    orphanCalls.map(([fn]) => fn),
			orphanEvidence:     orphanCalls.map(([fn, call]) => compactRecord({ function: fn, location: locate(call.at), reason: call.reason, exporters: call.exporters })),
			orphanAlternatives: orphanAlternatives(g.name)
		}));
		const oc = query.explode ? orderedCandidatesOf(space.resolve(g.name).src, g.name, g.surviving, query.explode.prefer?.[g.name], explodeOrder) : undefined;
		if(oc) {
			ordered.push(oc);
		}
	}

	const assignments = query.explode
		? [...assignmentsOf(ordered, query.explode.limit ?? DefaultExplodeLimit, declaredDependenciesOf(space))].map(a => ({ versions: Object.fromEntries(a.versions) }))
		: undefined;

	return compactRecord({
		'.meta':          { timing: Date.now() - start },
		dependencies,
		dateCutoff:       cutoff ? isoDay(cutoff) : undefined,
		rVersion,
		versionSelection: ctx.config.solver.sigdb.versionSelection,
		runnableCombinations,
		possibleCombinations,
		declaredCombinations,
		linkedGroups:     linkedGroups.length > 0 ? linkedGroups : undefined,
		assignments,
		message
	});
}
