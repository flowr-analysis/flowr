/**
 * The dependency version space: for each dependency, the set of signature-database versions that survive the
 * project's constraints (declared ranges, transitive requirements, the base-R/assumed-R bound, a date cutoff, and
 * how the code actually calls the package), and the explosion of that space into concrete per-dependency version
 * assignments. This is a source-agnostic resolver over {@link PackageSignatureSource} and the dependencies context;
 * the `guess-dep-versions` query presents it, but it is usable on its own (e.g. for compatibility-matrix tooling).
 */
import { minVersion, type Range } from 'semver';
import { RRange, RVersion, rReleaseDate, type VersionString } from '../util/r-version';
import { findByPrefixIfUnique } from '../util/prefix';
import { RBasePrimitives } from '../data/r-base-primitives.generated';
import { availableVersionEntries, sourceForPackage, type PackageSignatureSource } from './sigdb/reader';
import type { DecodedFunction } from './sigdb/decode';
import { matchArgumentsToSignature } from './sigdb/signature-match';
import { parseDateWindow } from './sigdb/sigdb-version';
import { Identifier } from '../dataflow/environments/identifier';
import { VertexType } from '../dataflow/graph/vertex';
import { FunctionArgument, type DataflowGraph } from '../dataflow/graph/graph';
import { Dataflow } from '../dataflow/graph/df-helper';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from './context/flowr-analyzer-dependencies-context';
import type { ReadonlyFlowrAnalysisProvider } from './flowr-analyzer';

/** where a single bound on a dependency's version came from */
export type ConstraintSource = 'declared' | 'transitive' | 'signature' | 'date' | 'base-r' | 'available' | 'indirect';

/**
 * One provenance-carrying constraint on a dependency's version: *where* it comes from ({@link source}/{@link origin})
 * and *what* it requires ({@link bound}). The set of these is exactly why a range is what it is, so it can answer
 * "it must be `>= 4.2.0` because ...".
 */
export interface DerivedConstraint {
	readonly source:     ConstraintSource;
	/** the concrete origin of the constraint, e.g. `project metadata`, `dplyr 1.1.0`, `dplyr::filter` */
	readonly origin:     string;
	/** a human-readable explanation, e.g. `dplyr::filter has parameter '.by' only from 1.1.0` */
	readonly detail:     string;
	/** the qualified function that carried the evidence (for {@link ConstraintSource|signature} constraints) */
	readonly function?:  string;
	/** the argument/parameter that carried the evidence (for signature constraints) */
	readonly parameter?: string;
	/** the version bound this constraint establishes, if any (e.g. `>=1.1.0`, `<=2021-05-31`) */
	readonly bound?:     string;
}

/** notified of each constraint as it is applied, so a caller can collect provenance (e.g. into the query's evidence) */
export type ConstraintObserver = (constraint: DerivedConstraint) => void;

/** resolves (and memoizes) one function's decoded signature at a given version of the current package */
export type FnResolver = (fn: string, version: VersionString) => DecodedFunction | undefined;

/** how a single function of a package is used in the code */
interface FunctionUsage {
	/** the union of named argument names across all call sites (drives the lower-bound evidence) */
	readonly named: Set<string>;
	/** one representative argument list per distinct call *shape* (drives signature compatibility) */
	readonly calls: Map<string, readonly FunctionArgument[]>;
}
/** per-package function usage, keyed by the function's (unqualified) name */
export type PackageUsage = Map<string, FunctionUsage>;

/** one dated release in a package's version timeline */
export interface TimelineEntry {
	readonly ver:   VersionString;
	readonly date?: Date;
}

/** the version qualifier a package imposes on one of its own dependencies (a transitive constraint) */
export interface TransitiveConstraint {
	readonly range: Range;
	/** the declaring package + version, e.g. `dplyr 1.1.0` */
	readonly from:  string;
}

/** the versions of a package before and after the signature-usage filter, plus the declared inputs used to build them */
export interface SurvivingEntries {
	/** versions after all constraints including signature-usage compatibility */
	readonly survivors:           TimelineEntry[];
	/** versions after the declared/transitive/base/date constraints but *before* the signature filter */
	readonly preSignature:        TimelineEntry[];
	/** the memoized function resolver used for the signature pass (shared so evidence reuses the decodes) */
	readonly getFn:               FnResolver;
	/** the combined, satisfiable declared range (`inferredVersion`), or `undefined` if none/contradictory */
	readonly declaredRange:       Range | undefined;
	/** the raw declared version constraints */
	readonly declaredConstraints: readonly string[];
	/** whether the package is an R-core / base package */
	readonly base:                boolean;
	/** whether the declared + transitive constraints contradict each other (no version can satisfy them all) */
	readonly unsatisfiable:       boolean;
	/** the total number of versions the database carries for the package (the full history the candidates are drawn from) */
	readonly total:               number;
}

/** one package's surviving versions, ordered by preference for the constraint-space explosion */
export interface OrderedCandidates {
	readonly pkg:      string;
	readonly versions: readonly VersionString[];
}

/** options for {@link explodeDependencyVersions} */
export interface VersionExplodeOptions {
	/** iterate each package's versions newest-first (default) or oldest-first */
	readonly order?:    'newest' | 'oldest';
	/** a version to prefer per package, used first when it survives the constraints (package name to version) */
	readonly prefer?:   Readonly<Record<string, VersionString>>;
	/** restrict to these packages (default: every declared and used dependency) */
	readonly packages?: readonly string[];
	/** only consider releases on or before this day, `YYYY.MM.DD` (also `YYYY` or `YYYY.MM`) */
	readonly date?:     string;
	/** cap the number of assignments produced (default {@link DefaultExplodeLimit}) */
	readonly limit?:    number;
}

/** a concrete, sigdb-available version choice for every resolvable dependency */
export interface VersionAssignment {
	readonly versions: ReadonlyMap<string, VersionString>;
}

/** default safety cap on how many assignments {@link explodeDependencyVersions} yields */
export const DefaultExplodeLimit = 256;

/** the date cutoff (end of the named day/month/year) for a `YYYY.MM.DD` spec, or `undefined` if malformed */
export function dateCutoff(spec: string): Date | undefined {
	const window = parseDateWindow(spec);
	return window ? new Date(window.upper) : undefined;
}

/** an ISO `YYYY-MM-DD` day */
export function isoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** memoizing resolver for one function's signature, one decode per (function, version) pair */
function makeFnResolver(src: PackageSignatureSource | undefined, name: string): FnResolver {
	const cache = new Map<string, DecodedFunction | undefined>();
	return (fn, version) => {
		const key = version + '\0' + fn;
		if(!cache.has(key)) {
			cache.set(key, src?.functionByName(name, fn, version));
		}
		return cache.get(key);
	};
}

/**
 * Every S3 class the analyzed project's own NAMESPACE registers a method for (its `S3method(generic, class)`
 * directives, flattened across every generic), deduplicated.
 */
function projectS3Classes(deps: ReadOnlyFlowrAnalyzerDependenciesContext): Set<string> {
	const generics = deps.getDependency('current')?.namespaceInfo?.exportS3Generics;
	return new Set([...(generics?.values() ?? [])].flat());
}

/** builtins whose string-literal argument names an S3/S4 class in use, and which slot carries it */
const ClassUsageArgs: Record<string, { readonly positional?: number, readonly named?: string }> = {
	inherits:  { positional: 1, named: 'what' },
	is:        { positional: 1, named: 'class2' },
	as:        { positional: 1, named: 'Class' },
	new:       { positional: 0, named: 'Class' },
	structure: { named: 'class' }
};

function argStringLiteral(graph: DataflowGraph, arg: FunctionArgument): string | undefined {
	const id = FunctionArgument.isNamed(arg) ? arg.valueId : FunctionArgument.getId(arg);
	if(id === undefined) {
		return undefined;
	}
	const node = graph.idMap?.get(id);
	return node?.type === RType.String ? node.content.str : undefined;
}

/** class names used as a string literal in the code (`inherits(x, "zoo")`, `new("Foo")`, ...); only direct literals, not variables or `c(...)` */
function collectCodeClassUses(graph: DataflowGraph): Set<string> {
	const classes = new Set<string>();
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const qualified = Dataflow.qualify(id, graph, true);
		const fn = qualified === undefined ? undefined : Identifier.getName(qualified);
		const spec = fn === undefined ? undefined : ClassUsageArgs[fn];
		if(spec === undefined) {
			continue;
		}
		let positional = 0;
		for(const arg of vertex.args) {
			if(FunctionArgument.isEmpty(arg)) {
				continue;
			}
			const named = FunctionArgument.isNamed(arg);
			const target = named ? arg.name === spec.named : spec.positional === positional;
			if(!named) {
				positional++;
			}
			if(target) {
				const literal = argStringLiteral(graph, arg);
				if(literal !== undefined && literal.length > 0) {
					classes.add(literal);
				}
			}
		}
	}
	return classes;
}

/**
 * Mark the package that OWNS a used S3/S4 class as used, from the project's NAMESPACE `S3method`/`exportClasses`
 * registrations and from class-name literals in the code. The same-named constructor is recorded as a synthetic
 * use so the version is bounded by its function-export history, not by the pre-NAMESPACE-biased `s3Classes` set.
 */
function addClassOwnershipUsage(usage: Map<string, PackageUsage>, deps: ReadOnlyFlowrAnalyzerDependenciesContext, graph: DataflowGraph): void {
	const namespaceClasses = projectS3Classes(deps);
	const codeClasses = collectCodeClassUses(graph);
	if(namespaceClasses.size === 0 && codeClasses.size === 0) {
		return;
	}
	const sources = deps.signatureSources();
	// a class-name literal in code is weak (names collide across CRAN): it may only refine an existing dependency,
	// never introduce one; a NAMESPACE registration is deliberate wiring, so it may introduce the owner
	const anchored = new Set<string>([...usage.keys(), ...deps.getDependencies().map(d => d.name)]);

	const attribute = (cls: string, mayIntroduce: boolean): void => {
		for(const src of sources) {
			const owner = src.classOwner(cls);
			if(owner === undefined) {
				continue;
			}
			if(!mayIntroduce && !anchored.has(owner)) {
				return;
			}
			let pkgUsage = usage.get(owner);
			if(pkgUsage === undefined) {
				pkgUsage = new Map();
				usage.set(owner, pkgUsage);
			}
			// narrow by the same-named constructor's presence only when it actually resolves (else just mark used)
			if(!pkgUsage.has(cls) && src.functionByName(owner, cls) !== undefined) {
				pkgUsage.set(cls, { named: new Set(), calls: new Map([['#0', []]]) });
			}
			return;
		}
	};
	for(const cls of namespaceClasses) {
		attribute(cls, true);
	}
	for(const cls of codeClasses) {
		attribute(cls, false);
	}
}

/** scan the dataflow graph for every call that resolves (via {@link Dataflow.qualify}) to a package export */
export function collectUsage(graph: DataflowGraph, deps?: ReadOnlyFlowrAnalyzerDependenciesContext): Map<string, PackageUsage> {
	const usage = new Map<string, PackageUsage>();
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		// use canonical qualification to reconstruct pkg::fn identifier
		const qualified = Dataflow.qualify(id, graph, true);
		if(qualified === undefined) {
			continue;
		}
		const pkg = Identifier.getNamespace(qualified);
		if(pkg === undefined) {
			continue;
		}
		const fn = Identifier.getName(qualified);
		let pkgUsage = usage.get(pkg);
		if(pkgUsage === undefined) {
			pkgUsage = new Map();
			usage.set(pkg, pkgUsage);
		}
		let entry = pkgUsage.get(fn);
		if(entry === undefined) {
			entry = { named: new Set(), calls: new Map() };
			pkgUsage.set(fn, entry);
		}
		const named: string[] = [];
		let positional = 0;
		for(const arg of vertex.args) {
			if(FunctionArgument.isNamed(arg)) {
				entry.named.add(arg.name);
				named.push(arg.name);
			} else if(FunctionArgument.isPositional(arg)) {
				positional++;
			}
		}
		// dedupe by call shape: named names + positional count
		const key = named.sort().join(',') + '#' + positional;
		if(!entry.calls.has(key)) {
			entry.calls.set(key, [...vertex.args]);
		}
	}
	if(deps) {
		addClassOwnershipUsage(usage, deps, graph);
	}
	return usage;
}

/** the dated releases + base-R core releases + latest of a package, ascending by R-version order */
function versionTimeline(src: PackageSignatureSource, pkg: string): TimelineEntry[] {
	return availableVersionEntries(src, pkg).map(e => ({ ver: e.version, ...(e.date ? { date: e.date } : {}) }));
}

/** the number of arguments a call actually supplies (empty positional slots do not count) */
function suppliedArgs(args: readonly FunctionArgument[]): number {
	return args.reduce((n, a) => n + (FunctionArgument.isEmpty(a) ? 0 : 1), 0);
}

/** whether a version's signatures accept how the code calls it; tracked names absent here are removals, untracked names are unknown primitives */
function isCompatible(getFn: FnResolver, version: string, usage: PackageUsage, tracked: ReadonlySet<string>): boolean {
	for(const [fn, use] of usage) {
		const decoded = getFn(fn, version);
		if(decoded === undefined) {
			if(tracked.has(fn)) {
				return false; // a tracked function removed in this version
			}
			continue; // an untracked primitive: unknown, not a removal
		}
		if(decoded.signature.length === 0) {
			continue; // an empty capture is uninformative (a generic like `seq`, or a data gap): it cannot disprove a call
		}
		for(const args of use.calls.values()) {
			// R's matching: exact, pmatch prefix, or positional; `...` absorbs the rest
			const bound = matchArgumentsToSignature(args, decoded.signature);
			let placed = 0;
			for(const ids of bound.values()) {
				placed += ids.length;
			}
			if(placed < suppliedArgs(args)) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Whether a named argument would bind to a parameter of `decoded` under R's matching (exact, pmatch, or `...`).
 * `undefined` (the function is absent) is a no; an empty capture -- a generic like `seq` whose formals became
 * `UseMethod`, or a data gap -- is uninformative and treated as accepting (so it never reports a false removal).
 */
function argumentSupported(decoded: DecodedFunction | undefined, arg: string): boolean {
	if(decoded === undefined) {
		return false;
	}
	const names = decoded.signature.map(p => p.name);
	return names.length === 0 || names.includes('...') || names.includes(findByPrefixIfUnique(arg, names) ?? arg);
}

/** the earliest *carried* version in `timeline` (ascending) whose signature satisfies `predicate` */
function earliestSupporting(src: PackageSignatureSource, pkg: string, timeline: readonly TimelineEntry[], predicate: (version: string) => boolean): string | undefined {
	for(const entry of timeline) {
		if(src.hasVersion(pkg, entry.ver) && predicate(entry.ver)) {
			return entry.ver;
		}
	}
	return undefined;
}

/** the latest *carried* version in `timeline` (ascending) whose signature satisfies `predicate` */
function latestSupporting(src: PackageSignatureSource, pkg: string, timeline: readonly TimelineEntry[], predicate: (version: string) => boolean): string | undefined {
	for(let i = timeline.length - 1; i >= 0; i--) {
		if(src.hasVersion(pkg, timeline[i].ver) && predicate(timeline[i].ver)) {
			return timeline[i].ver;
		}
	}
	return undefined;
}

/** emit one signature bound: `>=v` only when `v` is after the floor, `<=v` only when before the ceiling */
function emitSignatureBound(observe: ConstraintObserver, fn: Identifier, v: string | undefined, op: '>=' | '<=', ref: string, verb: string, parameter?: string): void {
	if(v !== undefined && (op === '>=' ? RVersion.compare(v, ref) > 0 : RVersion.compare(v, ref) < 0)) {
		const qualified = Identifier.toString(fn);
		observe({ source: 'signature', origin: qualified, detail: `${qualified} ${verb} ${v}`, bound: `${op}${v}`, function: qualified, parameter });
	}
}

/** emit signature bounds from a package's version history: when functions/parameters appear or vanish */
function addSignatureEvidence(observe: ConstraintObserver, src: PackageSignatureSource, getFn: FnResolver, pkg: string, usage: PackageUsage, timeline: readonly TimelineEntry[]): void {
	const floor = earliestSupporting(src, pkg, timeline, () => true);
	const ceiling = latestSupporting(src, pkg, timeline, () => true);
	if(floor === undefined || ceiling === undefined) {
		return; // no carried version to compare against
	}
	for(const [fn, use] of usage) {
		const qualified = Identifier.make(fn, pkg);
		const present = (v: string) => getFn(fn, v) !== undefined;
		emitSignatureBound(observe, qualified, earliestSupporting(src, pkg, timeline, present), '>=', floor, 'exists only from');
		emitSignatureBound(observe, qualified, latestSupporting(src, pkg, timeline, present), '<=', ceiling, 'removed after');
		for(const arg of use.named) {
			const supported = (v: string) => argumentSupported(getFn(fn, v), arg);
			emitSignatureBound(observe, qualified, earliestSupporting(src, pkg, timeline, supported), '>=', floor, `has parameter '${arg}' only from`, arg);
			emitSignatureBound(observe, qualified, latestSupporting(src, pkg, timeline, supported), '<=', ceiling, `dropped parameter '${arg}' after`, arg);
		}
	}
}

/** intersection of multiple survivor sets -- versions that survive in every set */
export function intersectSurvivors(survivorSets: readonly (readonly TimelineEntry[])[]): TimelineEntry[] {
	if(survivorSets.length === 0) {
		return [];
	}
	const [first, ...rest] = survivorSets;
	const restVersions = rest.map(set => new Set(set.map(e => e.ver)));
	return first.filter(e => restVersions.every(set => set.has(e.ver)));
}

/**
 * The transitive constraints declared packages place on their own dependencies (one level deep). `versionOf` overrides
 * which version of each declaring package to read the requirements from -- passing the previous pass's guessed versions
 * lets two packages tighten each other (a bounded fixpoint over mutual constraints).
 */
export function collectTransitiveConstraints(deps: ReadOnlyFlowrAnalyzerDependenciesContext, sources: readonly PackageSignatureSource[], versionOf?: (pkg: string) => string | undefined): Map<string, TransitiveConstraint[]> {
	const out = new Map<string, TransitiveConstraint[]>();
	for(const pkg of deps.getDependencies()) {
		const src = sources.find(s => s.has(pkg.name));
		if(!src) {
			continue;
		}
		const version = versionOf?.(pkg.name) ?? pkg.resolvedVersion;
		for(const dep of src.dependencies(pkg.name, version) ?? []) {
			if(!dep.constraint) {
				continue;
			}
			const range = RRange.parse(dep.constraint);
			if(!range) {
				continue;
			}
			const arr = out.get(dep.name) ?? [];
			arr.push({ range, from: `${pkg.name}${version ? ' ' + version : ''}` });
			out.set(dep.name, arr);
		}
	}
	return out;
}

/** the default bound for the fixpoint loops, overridable per query with {@link GuessDepVersionsQuery.maxIterations} */
export const DefaultFixpointIterations = 8;

/** repeatedly run `step` until it reports no further change (returns `false`) or `maxIterations` is reached */
export function iterateToFixpoint(maxIterations: number, step: () => boolean): void {
	for(let i = 0; i < maxIterations && step(); i++) { /* repeat until a step makes no change */ }
}

/** one package's mutable surviving set for the arc-consistency pass */
export interface ArcEntry {
	readonly name: string;
	readonly src:  PackageSignatureSource | undefined;
	/** the sigdb package its versions are drawn from (see {@link timelinePackageKey}) */
	readonly key:  string;
	survivors:     readonly TimelineEntry[];
}

/** drop, to a fixpoint, versions no co-guessed dependency can satisfy; returns the blocking partners per package */
export function enforceArcConsistency(entries: readonly ArcEntry[], maxIterations = DefaultFixpointIterations): Map<string, Map<string, string>> {
	const blockers = new Map<string, Map<string, string>>();
	iterateToFixpoint(maxIterations, () => {
		const survivorsByName = new Map(entries.map(e => [e.name, e.survivors.map(s => s.ver)]));
		let changed = false;
		for(const e of entries) {
			const src = e.src;
			if(src === undefined) {
				continue;
			}
			const kept = e.survivors.filter(v => versionMeetsPartners(src, e.key, v.ver, survivorsByName, e.name, (partner, constraint) => {
				const forPkg = blockers.get(e.name) ?? new Map<string, string>();
				forPkg.set(partner, constraint);
				blockers.set(e.name, forPkg);
			}));
			if(kept.length !== e.survivors.length) {
				changed = true;
				e.survivors = kept;
			}
		}
		return changed;
	});
	return blockers;
}

/** a package (or a linked group sharing one version) and its surviving versions, one factor of the combination count */
export interface CountFactor {
	readonly name:      string;
	readonly src:       PackageSignatureSource | undefined;
	readonly key:       string;
	readonly survivors: readonly string[];
}

/**
 * The runnable-combination count. Everything depends on the shared base/R `hub`, so for each hub version take the
 * product of how many versions of every other factor are compatible with it, and sum over the hub. With no hub the
 * factors are independent, so it is the plain product. (Constraints between two non-hub factors are not modelled.)
 */
export function countRunnableCombinations(hub: CountFactor | undefined, others: readonly CountFactor[]): number {
	if(hub === undefined) {
		return others.reduce((p, f) => p * f.survivors.length, 1);
	}
	// each factor version's constraint on the hub, resolved once (it does not depend on which hub version we count against)
	const hubRanges = others.map(f => f.survivors.map(v => {
		const dep = f.src?.dependencies(f.key, v)?.find(d => d.name === hub.name && d.constraint);
		return dep?.constraint ? RRange.parse(dep.constraint) : undefined;
	}));
	return hub.survivors.reduce((sum, h) =>
		sum + hubRanges.reduce((prod, ranges) => prod * ranges.filter(r => !r || RRange.satisfies(h, r)).length, 1), 0);
}

/** whether every requirement `pkg@ver` places on a co-guessed dependency is met by one of that partner's surviving versions */
export function versionMeetsPartners(src: PackageSignatureSource, pkg: string, ver: string, partnerSurvivors: ReadonlyMap<string, readonly string[]>, selfName: string, onReject?: (partner: string, constraint: string) => void): boolean {
	for(const dep of src.dependencies(pkg, ver) ?? []) {
		if(dep.name === selfName || !dep.constraint) {
			continue;
		}
		const partner = partnerSurvivors.get(dep.name);
		if(partner === undefined || partner.length === 0) {
			continue;
		}
		const req = RRange.parse(dep.constraint);
		if(req && !partner.some(v => RRange.satisfies(v, req))) {
			onReject?.(dep.name, dep.constraint);
			return false;
		}
	}
	return true;
}

/** an empty set, shared so callers that do not disable anything need not allocate one */
export const NoDisabledSources: ReadonlySet<ConstraintSource> = new Set();

/**
 * Filter a version timeline by the declared range, transitive constraints, base-R version bound, and date cutoff,
 * emitting each constraint to `observe` (when given) as it is applied -- so the filtering and its explanation cannot
 * drift apart. A source in `disabled` is skipped entirely: neither filtered on nor reported as evidence.
 */
function applyConstraints(timeline: readonly TimelineEntry[], name: string, declaredRange: Range | undefined, declaredConstraints: readonly string[], transitive: readonly TransitiveConstraint[], base: boolean, rVersion: string | undefined, cutoff: Date | undefined, observe?: ConstraintObserver, disabled: ReadonlySet<ConstraintSource> = NoDisabledSources): TimelineEntry[] {
	let t = [...timeline];
	if(!disabled.has('declared')) {
		for(const c of declaredConstraints) {
			observe?.({ source: 'declared', origin: 'project metadata', detail: `declared as ${c}`, bound: c });
		}
		t = declaredRange ? t.filter(e => RRange.satisfies(e.ver, declaredRange)) : t;
	}
	if(!disabled.has('transitive')) {
		for(const c of transitive) {
			observe?.({ source: 'transitive', origin: c.from, detail: `${c.from} requires ${name} ${c.range.raw}`, bound: c.range.raw });
			t = t.filter(e => RRange.satisfies(e.ver, c.range));
		}
	}
	// a base package's version *is* the R version, so it is bounded by the assumed/declared R (only when that is known)
	const rv = !disabled.has('base-r') && base && rVersion ? RVersion.parse(rVersion) : undefined;
	if(rv) {
		observe?.({ source: 'base-r', origin: `R ${rVersion}`, detail: `base package bounded by R ${rVersion}`, bound: `<=${rVersion}` });
		t = t.filter(e => RVersion.compare(e.ver, rv.str) <= 0);
	}
	if(cutoff && !disabled.has('date')) {
		observe?.({ source: 'date', origin: isoDay(cutoff), detail: `only releases up to ${isoDay(cutoff)}`, bound: `<=${isoDay(cutoff)}` });
		// base R is stored undated, so fall back to its R release date; a dated release must predate the cutoff, and an
		// undated one is dropped -- except base R older than the release table (kept, as it predates any real cutoff)
		t = t.filter(e => {
			const date = e.date ?? (base ? rReleaseDate(e.ver) : undefined);
			return date !== undefined ? date.getTime() <= cutoff.getTime() : base;
		});
	}
	return t;
}

/**
 * Apply every constraint (declared, transitive, base-R, date, then signature usage) to a package's timeline. When an
 * `observe` callback is given, emits the provenance of each constraint (including the signature lower bounds).
 */
export function survivingEntries(name: string, src: PackageSignatureSource | undefined, deps: ReadOnlyFlowrAnalyzerDependenciesContext, usage: PackageUsage | undefined, transitive: readonly TransitiveConstraint[], cutoff: Date | undefined, rVersion: string | undefined, observe?: ConstraintObserver, disabled: ReadonlySet<ConstraintSource> = NoDisabledSources, packageKey: string = name): SurvivingEntries {
	// packageKey: sigdb package (R reuses base, others use themselves)
	const getFn = makeFnResolver(src, packageKey);
	const declaredRange = disabled.has('declared') ? undefined : deps.inferredVersion(name);
	const declaredConstraints = disabled.has('declared') ? [] : (deps.getDependency(name)?.versionConstraints.map(c => c.raw) ?? []);
	const effectiveTransitive = disabled.has('transitive') ? [] : transitive;
	// contradiction is a constraint property, not an empty database
	const unsatisfiable = constraintsContradict(declaredConstraints, declaredRange, effectiveTransitive);
	if(!src) {
		return { survivors: [], preSignature: [], getFn, declaredRange, declaredConstraints, base: false, unsatisfiable, total: 0 };
	}
	const base = src.isBaseR(packageKey);
	const timeline = versionTimeline(src, packageKey);
	const total = timeline.length;
	// emit database coverage envelope as outer bounds
	if(observe && timeline.length > 0 && !disabled.has('available')) {
		observe({ source: 'available', origin: 'signature database', detail: `data available from ${timeline[0].ver}`, bound: `>=${timeline[0].ver}` });
		observe({ source: 'available', origin: 'signature database', detail: `data available up to ${timeline[timeline.length - 1].ver}`, bound: `<=${timeline[timeline.length - 1].ver}` });
	}
	const preSignature = applyConstraints(timeline, name, declaredRange, declaredConstraints, effectiveTransitive, base, rVersion, cutoff, observe, disabled);
	if(!usage || disabled.has('signature')) {
		return { survivors: preSignature, preSignature, getFn, declaredRange, declaredConstraints, base, unsatisfiable, total };
	}
	// exclude base primitives from base packages (captured inconsistently, so absence is data gap not removal)
	const relevant = base ? new Map([...usage].filter(([fn]) => !RBasePrimitives.has(fn))) : usage;
	if(observe) {
		addSignatureEvidence(observe, src, getFn, packageKey, relevant, preSignature);
	}
	// tracked names appear in some carried version; untracked names must not reject all versions
	const tracked = new Set([...relevant.keys()].filter(fn => preSignature.some(e => getFn(fn, e.ver) !== undefined)));
	const survivors = preSignature.filter(e => !src.hasVersion(packageKey, e.ver) || isCompatible(getFn, e.ver, relevant, tracked));
	return { survivors, preSignature, getFn, declaredRange, declaredConstraints, base, unsatisfiable, total };
}

/** the sigdb package a target's version history is drawn from: `R` reuses `base` (their releases coincide), everything else is itself */
export function timelinePackageKey(name: string, sources: readonly PackageSignatureSource[]): string {
	return name === 'R' && !sources.some(s => s.has(name)) ? 'base' : name;
}

/** whether the (combined) declared and transitive constraints can be satisfied by no version at all */
function constraintsContradict(declaredConstraints: readonly string[], declaredRange: Range | undefined, transitive: readonly TransitiveConstraint[]): boolean {
	// declared constraints exist but do not combine into a satisfiable range
	if(declaredConstraints.length > 0 && declaredRange === undefined) {
		return true;
	}
	const ranges = [declaredRange, ...transitive.map(t => t.range)].filter((r): r is Range => r !== undefined);
	if(ranges.length === 0) {
		return false;
	}
	const combined = RRange.parse(ranges.map(r => r.raw).join(' '));
	return combined === undefined || minVersion(combined) === null;
}

/**
 * Order a package's surviving versions by preference: an explicitly {@link VersionExplodeOptions.prefer|preferred}
 * version first, then still-on-CRAN (non-archived) releases before archived ones, then by release (newest or oldest
 * first per {@link VersionExplodeOptions.order}).
 */
function orderCandidates(src: PackageSignatureSource, name: string, survivors: readonly TimelineEntry[], prefer: string | undefined, order: 'newest' | 'oldest'): string[] {
	const preferred = prefer !== undefined && survivors.some(e => e.ver === prefer) ? prefer : undefined;
	// decide archived/non-CRAN status once per version (a cheap `noncran` check), not inside the O(n log n) comparator
	const archived = new Set(survivors.filter(e => !src.isCranVersion(name, e.ver)).map(e => e.ver));
	const rest = survivors.filter(e => e.ver !== preferred).sort((a, b) =>
		(archived.has(a.ver) ? 1 : 0) - (archived.has(b.ver) ? 1 : 0) || (order === 'oldest' ? RVersion.compare(a.ver, b.ver) : RVersion.compare(b.ver, a.ver)));
	return preferred !== undefined ? [preferred, ...rest.map(e => e.ver)] : rest.map(e => e.ver);
}

/** the ordered candidate list for one package, or `undefined` when nothing survives (shared by the query and the iterator) */
export function orderedCandidatesOf(src: PackageSignatureSource | undefined, name: string, surviving: SurvivingEntries, prefer: string | undefined, order: 'newest' | 'oldest'): OrderedCandidates | undefined {
	return src && surviving.survivors.length > 0 ? { pkg: name, versions: orderCandidates(src, name, surviving.survivors, prefer, order) } : undefined;
}

/** the default explosion targets: every declared and used dependency (excluding `current`, the analyzed package's own namespace) */
export function defaultTargets(deps: ReadOnlyFlowrAnalyzerDependenciesContext, usage: ReadonlyMap<string, PackageUsage>): string[] {
	return [...new Set([...deps.getDependencies().map(d => d.name), ...usage.keys()])].filter(name => name !== 'current');
}

/** lazily yield concrete version assignments (one version per package) in odometer order over the per-package lists */
export function* assignmentsOf(perPackage: readonly OrderedCandidates[], limit: number): Generator<VersionAssignment> {
	if(perPackage.length === 0 || perPackage.some(p => p.versions.length === 0)) {
		return;
	}
	const idx = perPackage.map(() => 0);
	for(let count = 0; count < limit; count++) {
		const versions = new Map<string, string>();
		for(let i = 0; i < perPackage.length; i++) {
			versions.set(perPackage[i].pkg, perPackage[i].versions[idx[i]]);
		}
		yield { versions };
		// advance the odometer: the last package varies fastest
		let k = perPackage.length - 1;
		for(; k >= 0; k--) {
			if(++idx[k] < perPackage[k].versions.length) {
				break;
			}
			idx[k] = 0;
		}
		if(k < 0) {
			return; // wrapped around: the whole space is exhausted
		}
	}
}

/** the per-package ordered candidate lists for the constraint-space explosion (only packages with a surviving version) */
async function orderedCandidatesFor(analyzer: ReadonlyFlowrAnalysisProvider, options: VersionExplodeOptions): Promise<OrderedCandidates[]> {
	const ctx = analyzer.inspectContext();
	const deps = ctx.deps;
	const sources = deps.signatureSources();
	if(sources.length === 0) {
		return [];
	}
	const cutoff = options.date ? dateCutoff(options.date) : undefined;
	// bound base packages by R only when genuinely known (a config pin, metadata, or detection); `auto` with nothing detected imposes no R ceiling
	const rVersion = ctx.rVersionKnown ? (ctx.meta.getRVersion() ?? ctx.resolvedRVersion) : undefined;
	const usage = collectUsage((await analyzer.dataflow()).graph, deps);
	const transitive = collectTransitiveConstraints(deps, sources);
	const targets = options.packages && options.packages.length > 0 ? [...options.packages] : defaultTargets(deps, usage);
	const order = options.order ?? 'newest';
	const out: OrderedCandidates[] = [];
	for(const name of targets.sort()) {
		const packageKey = timelinePackageKey(name, sources);
		const src = sourceForPackage(sources, packageKey);
		const surviving = survivingEntries(name, src, deps, usage.get(name), transitive.get(name) ?? [], cutoff, rVersion, undefined, NoDisabledSources, packageKey);
		const oc = orderedCandidatesOf(src, name, surviving, options.prefer?.[name], order);
		if(oc) {
			out.push(oc);
		}
	}
	return out;
}

/**
 * Explode the guessed constraint space into concrete, signature-database-available version assignments: a lazy
 * iterator over one chosen version per resolvable dependency. Each package's versions are ordered by preference
 * (an explicitly {@link VersionExplodeOptions.prefer|preferred} version, then non-archived releases, then newest or
 * oldest first), so the first assignments are the most preferred. The iterator is bounded by
 * {@link VersionExplodeOptions.limit} so an enormous product cannot run away.
 */
export async function* explodeDependencyVersions(analyzer: ReadonlyFlowrAnalysisProvider, options: VersionExplodeOptions = {}): AsyncGenerator<VersionAssignment> {
	yield* assignmentsOf(await orderedCandidatesFor(analyzer, options), options.limit ?? DefaultExplodeLimit);
}
