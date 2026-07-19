/**
 * The dependency version space: for each dependency, the set of signature-database versions that survive the
 * project's constraints (declared ranges, transitive requirements, the base-R/assumed-R bound, a date cutoff, and
 * how the code actually calls the package), and the explosion of that space into concrete per-dependency version
 * assignments. This is a source-agnostic resolver over {@link PackageSignatureSource} and the dependencies context;
 * the `guess-dep-versions` query presents it, but it is usable on its own (e.g. for compatibility-matrix tooling).
 */
import { minVersion, type Range } from 'semver';
import { RRange, RVersion } from '../util/r-version';
import { findByPrefixIfUnique } from '../util/prefix';
import { RBasePrimitives } from '../data/r-base-primitives.generated';
import { availableVersionEntries, type PackageSignatureSource } from './sigdb/reader';
import type { DecodedFunction } from './sigdb/decode';
import { matchArgumentsToSignature } from './sigdb/signature-match';
import { parseDateWindow } from './sigdb/sigdb-version';
import { Identifier } from '../dataflow/environments/identifier';
import { VertexType } from '../dataflow/graph/vertex';
import { FunctionArgument, type DataflowGraph } from '../dataflow/graph/graph';
import { Dataflow } from '../dataflow/graph/df-helper';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from './context/flowr-analyzer-dependencies-context';
import type { ReadonlyFlowrAnalysisProvider } from './flowr-analyzer';

/** where a single bound on a dependency's version came from */
export type ConstraintSource = 'declared' | 'transitive' | 'signature' | 'date' | 'base-r';

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
export type FnResolver = (fn: string, version: string) => DecodedFunction | undefined;

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
interface TimelineEntry {
	readonly ver:   string;
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
	readonly versions: readonly string[];
}

/** options for {@link explodeDependencyVersions} */
export interface VersionExplodeOptions {
	/** iterate each package's versions newest-first (default) or oldest-first */
	readonly order?:    'newest' | 'oldest';
	/** a version to prefer per package, used first when it survives the constraints (package name to version) */
	readonly prefer?:   Readonly<Record<string, string>>;
	/** restrict to these packages (default: every declared and used dependency) */
	readonly packages?: readonly string[];
	/** only consider releases on or before this day, `YYYY.MM.DD` (also `YYYY` or `YYYY.MM`) */
	readonly date?:     string;
	/** cap the number of assignments produced (default {@link DefaultExplodeLimit}) */
	readonly limit?:    number;
}

/** a concrete, sigdb-available version choice for every resolvable dependency */
export interface VersionAssignment {
	readonly versions: ReadonlyMap<string, string>;
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

/** a memoizing resolver of one function's decoded signature at a version of `name` (one decode per (function, version)) */
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

/** scan the dataflow graph for every call that resolves (via {@link Dataflow.qualify}) to a package export */
export function collectUsage(graph: DataflowGraph): Map<string, PackageUsage> {
	const usage = new Map<string, PackageUsage>();
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		// prefer the canonical qualification over hand-rolled origin inspection: it reconstructs the pkg::fn
		// identifier (including edge-free base-R qualification) straight from the graph
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
		// dedupe by call shape (named names + positional count): identical shapes match a signature identically
		const key = named.sort().join(',') + '#' + positional;
		if(!entry.calls.has(key)) {
			entry.calls.set(key, [...vertex.args]);
		}
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

/**
 * Whether a *carried* package version's signatures can accept how the code calls the package (R's argument matching).
 * A name in `tracked` is known to the package's signature history, so its absence here means it was removed in this
 * version (reject); a name never tracked at all is an untracked primitive (base `c`/`is.na`/`round`, ...) and cannot
 * disprove a version, so it is ignored.
 */
function isCompatible(getFn: FnResolver, version: string, usage: PackageUsage, tracked: ReadonlySet<string>): boolean {
	for(const [fn, use] of usage) {
		const decoded = getFn(fn, version);
		if(decoded === undefined) {
			if(tracked.has(fn)) {
				return false; // a tracked function removed in this version
			}
			continue; // an untracked primitive: unknown, not a removal
		}
		for(const args of use.calls.values()) {
			// R's matching rules (exact, then pmatch prefix, then positional; `...` absorbs the rest); an argument
			// that finds no home means this version's signature cannot accept the call
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

/** whether a named argument would bind to a parameter of `decoded` under R's matching (exact, pmatch, or `...`); `undefined` = the function is absent, so no */
function argumentSupported(decoded: DecodedFunction | undefined, arg: string): boolean {
	if(decoded === undefined) {
		return false;
	}
	const names = decoded.signature.map(p => p.name);
	return names.includes('...') || names.includes(findByPrefixIfUnique(arg, names) ?? arg);
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

/** one probe of a function feature (the function itself, or one of its named arguments) across the version timeline */
interface SignatureFeature {
	readonly supported:  (version: string) => boolean;
	/** the verb for an introduction (`>=`) bound, e.g. `exists only from` */
	readonly from:       string;
	/** the verb for a removal (`<=`) bound, e.g. `removed after` */
	readonly after:      string;
	readonly parameter?: string;
}

/** emit one signature bound: `>=v` only when `v` is after the floor, `<=v` only when before the ceiling */
function emitSignatureBound(observe: ConstraintObserver, fn: Identifier, v: string | undefined, op: '>=' | '<=', ref: string, verb: string, parameter?: string): void {
	if(v !== undefined && (op === '>=' ? RVersion.compare(v, ref) > 0 : RVersion.compare(v, ref) < 0)) {
		const qualified = Identifier.toString(fn);
		observe({ source: 'signature', origin: qualified, detail: `${qualified} ${verb} ${v}`, bound: `${op}${v}`, function: qualified, parameter });
	}
}

/**
 * Emit signature-database provenance: each used function, and each of its named arguments, is a feature whose
 * support window in the carried timeline yields a bound -- `>=first` when it appears after the earliest carried
 * version (introduced), `<=last` when it vanishes before the newest (dropped).
 */
function addSignatureEvidence(observe: ConstraintObserver, src: PackageSignatureSource, getFn: FnResolver, pkg: string, usage: PackageUsage, timeline: readonly TimelineEntry[]): void {
	const floor = earliestSupporting(src, pkg, timeline, () => true);
	const ceiling = latestSupporting(src, pkg, timeline, () => true);
	if(floor === undefined || ceiling === undefined) {
		return; // no carried version to compare against
	}
	for(const [fn, use] of usage) {
		const qualified = Identifier.make(fn, pkg);
		const features: SignatureFeature[] = [
			{ supported: v => getFn(fn, v) !== undefined, from: 'exists only from', after: 'removed after' },
			...[...use.named].map((arg): SignatureFeature => ({
				supported: v => argumentSupported(getFn(fn, v), arg), from: `has parameter '${arg}' only from`, after: `dropped parameter '${arg}' after`, parameter: arg
			}))
		];
		for(const f of features) {
			emitSignatureBound(observe, qualified, earliestSupporting(src, pkg, timeline, f.supported), '>=', floor, f.from, f.parameter);
			emitSignatureBound(observe, qualified, latestSupporting(src, pkg, timeline, f.supported), '<=', ceiling, f.after, f.parameter);
		}
	}
}

/** the transitive constraints declared packages place on their own dependencies (one level deep) */
export function collectTransitiveConstraints(deps: ReadOnlyFlowrAnalyzerDependenciesContext, sources: readonly PackageSignatureSource[]): Map<string, TransitiveConstraint[]> {
	const out = new Map<string, TransitiveConstraint[]>();
	for(const pkg of deps.getDependencies()) {
		const src = sources.find(s => s.has(pkg.name));
		if(!src) {
			continue;
		}
		const version = pkg.resolvedVersion;
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

/**
 * Filter a version timeline by the declared range, transitive constraints, base-R version bound, and date cutoff,
 * emitting each constraint to `observe` (when given) as it is applied -- so the filtering and its explanation cannot
 * drift apart.
 */
function applyConstraints(timeline: readonly TimelineEntry[], name: string, declaredRange: Range | undefined, declaredConstraints: readonly string[], transitive: readonly TransitiveConstraint[], base: boolean, rVersion: string | undefined, cutoff: Date | undefined, observe?: ConstraintObserver): TimelineEntry[] {
	for(const c of declaredConstraints) {
		observe?.({ source: 'declared', origin: 'project metadata', detail: `declared as ${c}`, bound: c });
	}
	let t = declaredRange ? timeline.filter(e => RRange.satisfies(e.ver, declaredRange)) : [...timeline];
	for(const c of transitive) {
		observe?.({ source: 'transitive', origin: c.from, detail: `${c.from} requires ${name} ${c.range.raw}`, bound: c.range.raw });
		t = t.filter(e => RRange.satisfies(e.ver, c.range));
	}
	// a base package's version *is* the R version, so it is bounded by the assumed/declared R (only when that is known)
	const rv = base && rVersion ? RVersion.parse(rVersion) : undefined;
	if(rv) {
		observe?.({ source: 'base-r', origin: `R ${rVersion}`, detail: `base package bounded by R ${rVersion}`, bound: `<=${rVersion}` });
		t = t.filter(e => RVersion.compare(e.ver, rv.str) <= 0);
	}
	if(cutoff) {
		observe?.({ source: 'date', origin: isoDay(cutoff), detail: `only releases up to ${isoDay(cutoff)}`, bound: `<=${isoDay(cutoff)}` });
		// an undated release cannot be proven to predate the cutoff, so drop it -- unless it is an R-bounded base core version
		t = t.filter(e => e.date !== undefined ? e.date.getTime() <= cutoff.getTime() : rv !== undefined);
	}
	return t;
}

/**
 * Apply every constraint (declared, transitive, base-R, date, then signature usage) to a package's timeline. When an
 * `observe` callback is given, emits the provenance of each constraint (including the signature lower bounds).
 */
export function survivingEntries(name: string, src: PackageSignatureSource | undefined, deps: ReadOnlyFlowrAnalyzerDependenciesContext, usage: PackageUsage | undefined, transitive: readonly TransitiveConstraint[], cutoff: Date | undefined, rVersion: string | undefined, observe?: ConstraintObserver): SurvivingEntries {
	const getFn = makeFnResolver(src, name);
	const declaredRange = deps.inferredVersion(name);
	const declaredConstraints = deps.getDependency(name)?.versionConstraints.map(c => c.raw) ?? [];
	// a genuine contradiction is a property of the *constraints*, not of the db being empty after date/signature filters
	const unsatisfiable = constraintsContradict(declaredConstraints, declaredRange, transitive);
	if(!src) {
		return { survivors: [], preSignature: [], getFn, declaredRange, declaredConstraints, base: false, unsatisfiable, total: 0 };
	}
	const base = src.isBaseR(name);
	const timeline = versionTimeline(src, name);
	const total = timeline.length;
	const preSignature = applyConstraints(timeline, name, declaredRange, declaredConstraints, transitive, base, rVersion, cutoff, observe);
	if(!usage) {
		return { survivors: preSignature, preSignature, getFn, declaredRange, declaredConstraints, base, unsatisfiable, total };
	}
	// base primitives (`c`, `as.integer`, ...) are captured inconsistently across R releases in the db, so their
	// absence in a later version is a data gap, not a removal -- they must not drive base's bounds or reject versions
	const relevant = base ? new Map([...usage].filter(([fn]) => !RBasePrimitives.has(fn))) : usage;
	if(observe) {
		addSignatureEvidence(observe, src, getFn, name, relevant, preSignature);
	}
	// a used name is "tracked" only if it appears in some carried version; an untracked name is unknown to the db and
	// must not reject every version (which zeroed base packages out)
	const tracked = new Set([...relevant.keys()].filter(fn => preSignature.some(e => getFn(fn, e.ver) !== undefined)));
	const survivors = preSignature.filter(e => !src.hasVersion(name, e.ver) || isCompatible(getFn, e.ver, relevant, tracked));
	return { survivors, preSignature, getFn, declaredRange, declaredConstraints, base, unsatisfiable, total };
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

/** the default explosion targets: every declared and used dependency */
export function defaultTargets(deps: ReadOnlyFlowrAnalyzerDependenciesContext, usage: ReadonlyMap<string, PackageUsage>): string[] {
	return [...new Set([...deps.getDependencies().map(d => d.name), ...usage.keys()])];
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
	const rVersion = ctx.meta.getRVersion() ?? ctx.resolvedRVersion;
	const usage = collectUsage((await analyzer.dataflow()).graph);
	const transitive = collectTransitiveConstraints(deps, sources);
	const targets = options.packages && options.packages.length > 0 ? [...options.packages] : defaultTargets(deps, usage);
	const order = options.order ?? 'newest';
	const out: OrderedCandidates[] = [];
	for(const name of targets.sort()) {
		const src = sources.find(s => s.has(name));
		const surviving = survivingEntries(name, src, deps, usage.get(name), transitive.get(name) ?? [], cutoff, rVersion);
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
