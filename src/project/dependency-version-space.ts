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
import { availableVersionEntries, classOwnerIndexFor, sourceForPackage, type PackageSignatureSource } from './sigdb/reader';
import type { DecodedFunction, ResolvedDependency } from './sigdb/decode';
import { matchArgumentsToSignature } from './sigdb/signature-match';
import { parseDateWindow } from './sigdb/sigdb-version';
import { Identifier } from '../dataflow/environments/identifier';
import { VertexType } from '../dataflow/graph/vertex';
import { FunctionArgument, type DataflowGraph } from '../dataflow/graph/graph';
import { Dataflow } from '../dataflow/graph/df-helper';
import { getOriginInDfg, OriginType } from '../dataflow/origin/dfg-get-origin';
import { AttachedBasePackages, baseRExportOwner } from '../util/r-base-packages';
import { collectScopeDefinedNames, isDefinedInEnclosingScope, isNonStandardEvaluated } from '../linter/rules/undefined-symbol-util';
import { RType } from '../r-bridge/lang-4.x/ast/model/type';
import { S7SyntheticFunArgSuffix } from '../dataflow/internal/process/functions/call/built-in/built-in-s-seven-new-generic';
import type { ReadOnlyFlowrAnalyzerDependenciesContext } from './context/flowr-analyzer-dependencies-context';
import type { ReadonlyFlowrAnalysisProvider } from './flowr-analyzer';

/** the pseudo-package standing for the analyzed project itself, never one of its own dependencies */
export const ProjectPackage = 'current';

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
	/**
	 * Set when the bound only holds for *some* of the origin's own candidate versions (e.g. only the newer releases
	 * of `dplyr` require `R >= 4.1`). Such a constraint is reported but never filters, as picking another version of
	 * the origin avoids it.
	 */
	readonly partial?:   boolean;
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

/**
 * The version qualifier a package imposes on one of its own dependencies (a transitive constraint). Because the
 * declaring package's own version is usually a guess too, the requirement is read from *every* version of it that is
 * still in play: {@link ranges} holds one alternative per distinct requirement found, and only a
 * {@link universal} constraint (one that every one of those versions declares) may filter.
 */
export interface TransitiveConstraint {
	/** the alternative requirements; a version satisfying any one of them is acceptable */
	readonly ranges:    readonly Range[];
	/** the declaring package + version, e.g. `dplyr 1.1.0`, or just `dplyr` when read from several of its versions */
	readonly from:      string;
	/** whether every considered version of the declaring package requires *something*, so the constraint can filter */
	readonly universal: boolean;
}

/** the versions of a package before and after the signature-usage filter, plus the declared inputs used to build them */
export interface SurvivingEntries {
	/** versions after all constraints including signature-usage compatibility */
	readonly survivors:           TimelineEntry[];
	/** versions after the declared/transitive/base/date constraints but *before* the signature filter */
	readonly preSignature:        TimelineEntry[];
	/** the memoized function resolver used for the signature pass (shared so evidence reuses the decodes) */
	readonly getFn:               FnResolver;
	/** the combined, satisfiable declared range (`inferredRange`), or `undefined` if none/contradictory */
	readonly declaredRange:       Range | undefined;
	/** the raw declared version constraints */
	readonly declaredConstraints: readonly string[];
	/** whether the package is an R-core / base package */
	readonly base:                boolean;
	/** whether the declared + transitive constraints contradict each other (no version can satisfy them all) */
	readonly unsatisfiable:       boolean;
	/** the total number of versions the database carries for the package (the full history the candidates are drawn from) */
	readonly total:               number;
	/** whether the database carries the package at all: `false` means "no record", not "no constraint" */
	readonly known:               boolean;
	/** how many of those versions the *declared* constraints alone allow, the baseline the guess narrows down from */
	readonly declared:            number;
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
	const generics = deps.getDependency(ProjectPackage)?.namespaceInfo?.exportS3Generics;
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
 *
 * The owner is looked for among the packages already in play (called or declared). A NAMESPACE registration is
 * deliberate wiring, so it may still introduce a package from outside that set, but only for a project that declares
 * no dependencies at all. Class names collide heavily across CRAN: with declared dependencies present, the
 * whole-database {@link PackageSignatureSource.classOwner} answer is decided by database order (attributing `POSIXlt`
 * or `function` to whichever unrelated package comes first), so it is a collision far more often than a hidden
 * dependency, and it costs reading every package in the database. A class-name literal in code is weaker still and
 * may only ever refine a package already in play.
 */
function addClassOwnershipUsage(usage: Map<string, PackageUsage>, deps: ReadOnlyFlowrAnalyzerDependenciesContext, graph: DataflowGraph): void {
	const namespaceClasses = projectS3Classes(deps);
	const codeClasses = collectCodeClassUses(graph);
	if(namespaceClasses.size === 0 && codeClasses.size === 0) {
		return;
	}
	const sources = deps.signatureSources();
	const declared = deps.declaredPackageNames();
	// `current` is the analyzed project itself, not a dependency (see `defaultTargets`)
	const anchored = new Set<string>([...usage.keys(), ...deps.getDependencies().map(d => d.name), ...declared].filter(n => n !== ProjectPackage));
	const owners = sources.map(src => classOwnerIndexFor(src, anchored));
	const mayIntroduce = declared.length === 0;

	const attribute = (cls: string, fromNamespace: boolean): void => {
		for(const [i, src] of sources.entries()) {
			const owner = owners[i].get(cls) ?? (fromNamespace && mayIntroduce ? src.classOwner(cls) : undefined);
			if(owner === undefined) {
				continue;
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

/**
 * Whether an argument was synthesized by flowR rather than written in the code. Such an argument is not evidence of
 * how the package is called, so a signature that lacks its parameter must not reject the version (S7's `new_class`
 * has no `fun` parameter, yet flowR appends one to model the constructor it returns).
 */
function isSyntheticArgument(arg: FunctionArgument): boolean {
	return !FunctionArgument.isEmpty(arg) && String(arg.nodeId).endsWith(S7SyntheticFunArgSuffix);
}

/** record one call of `fn` into `pkgUsage`: union its named argument names and keep one representative per call shape */
function recordCallUsage(pkgUsage: PackageUsage, fn: string, rawArgs: readonly FunctionArgument[]): void {
	let entry = pkgUsage.get(fn);
	if(entry === undefined) {
		entry = { named: new Set(), calls: new Map() };
		pkgUsage.set(fn, entry);
	}
	const args = rawArgs.some(isSyntheticArgument) ? rawArgs.filter(a => !isSyntheticArgument(a)) : rawArgs;
	const named: string[] = [];
	let positional = 0;
	for(const arg of args) {
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
		entry.calls.set(key, [...args]);
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
		let pkgUsage = usage.get(pkg);
		if(pkgUsage === undefined) {
			pkgUsage = new Map();
			usage.set(pkg, pkgUsage);
		}
		recordCallUsage(pkgUsage, Identifier.getName(qualified), vertex.args);
	}
	if(deps) {
		addClassOwnershipUsage(usage, deps, graph);
	}
	return usage;
}

/**
 * How many packages may export an orphan's name before it is dropped as too generic. Up to this many, the most
 * downloaded one is taken (see {@link collectOrphanUsage}); beyond it the name carries no information.
 */
const MaxOrphanProviders = 5;

/**
 * What the orphan calls of one analyzed program implicated, as {@link collectOrphanUsage} reports it.
 */
export interface OrphanUsage {
	/** per package the project does not already know: the orphan function names that pointed at it */
	readonly attributed:       Map<string, Set<string>>;
	/** per such package: the other exporters of those names that lost the pick, most downloaded first */
	readonly alternatives:     Map<string, string[]>;
	/** the same calls recorded against every alternative, so a caller can ask which of its versions would fit */
	readonly alternativeUsage: Map<string, PackageUsage>;
}

/** options for {@link collectOrphanUsage} */
export interface OrphanUsageOptions {
	/** the analyzed project's own namespace, never inferred as one of its own orphan dependencies */
	readonly self?:             string;
	/** flowR's curated map of a builtin-modeled library function to its package (e.g. `ggplot` to `ggplot2`), the authoritative disambiguator when several packages export the name */
	readonly builtinLibraryOf?: (name: string) => string | undefined;
}

/**
 * Fold the analyzed code's *orphan* calls into `usage` and report which functions implicated each **unknown**
 * package. An orphan is a bare call (`ggplot()`) whose name is not bound to a local/parameter/closure/import
 * definition and is not a default-attached base export, but is exported by exactly one signature-database package.
 * Such a call never qualifies to `pkg::fn`, so {@link collectUsage} is blind to it (even when flowR models the
 * function as a builtin, as it does for `ggplot`), yet it pins the package's version just as a qualified call
 * would; folding it into `usage` makes the package a guess target. The returned map lists, per package the project
 * does not already declare or load (`isKnown` is `false`), the orphan function names that pointed at it (e.g.
 * `ggplot2` from `ggplot()`) -- a note for a downstream handler to attach the library, since the symbol would be
 * undefined were the package not loaded. Disambiguation is `options.builtinLibraryOf` (flowR's curated map, e.g.
 * `ggplot` to `ggplot2`, authoritative even when several packages re-export the name), then a package the project
 * already declares or loads, and finally the most downloaded of at most {@link MaxOrphanProviders} exporters; a
 * name beyond that many packages export says nothing about which one is meant and is skipped, as are quoted (NSE)
 * uses and forward-referenced closures. The exporters that lost the pick are kept as
 * {@link OrphanUsage.alternatives}, since the guess is exactly that -- a guess.
 */
export function collectOrphanUsage(graph: DataflowGraph, deps: ReadOnlyFlowrAnalyzerDependenciesContext, usage: Map<string, PackageUsage>, isKnown: (pkg: string) => boolean, options: OrphanUsageOptions = {}): OrphanUsage {
	const { self, builtinLibraryOf } = options;
	const attributed = new Map<string, Set<string>>();
	const alternatives = new Map<string, string[]>();
	const alternativeUsage = new Map<string, PackageUsage>();
	const scopeDefined = collectScopeDefinedNames(graph);
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		// an anonymous callee, or an already-qualified `pkg::fn` (handled by collectUsage)
		if(vertex.origin === 'unnamed' || Identifier.getNamespace(vertex.name) !== undefined) {
			continue;
		}
		const name = Identifier.getName(vertex.name);
		// a call bound to a real definition (local, parameter, closure, or import) *is* that definition, not a package
		// export; only an unresolved or builtin-modeled call can be an orphan (flowR models e.g. `ggplot` as a builtin)
		if(getOriginInDfg(graph, id)?.some(o => o.type === OriginType.FunctionCallOrigin) === true) {
			continue;
		}
		// a bare name from a default-attached base package (or a base primitive) is defined without a library() call
		const baseOwner = baseRExportOwner(name);
		if(baseOwner !== undefined && AttachedBasePackages.includes(baseOwner)) {
			continue;
		}
		// a quoted use, or a forward-referenced closure binding flowR did not statically link, is not a real orphan call
		if(isNonStandardEvaluated(graph, id) || isDefinedInEnclosingScope(graph, scopeDefined, id, name)) {
			continue;
		}
		// flowR's curated map disambiguates a name several packages export (ggplot to ggplot2); failing that, a
		// package the project already declares or loads explains the call and needs no library attached (dplyr
		// re-exports tidyselect's `everything`); failing that the most downloaded exporter wins, as
		// `packagesExporting` hands them over in that order and a script calling a bare name almost always means
		// the popular package. A name half of CRAN exports says nothing, so it is skipped.
		const mapped = builtinLibraryOf?.(name);
		const providers = deps.packagesExporting(name).filter(p => p !== self);
		const known = providers.filter(isKnown);
		const pkg = mapped !== undefined && mapped !== self ? mapped
			: known.length === 1 ? known[0]
				: known.length === 0 && providers.length > 0 && providers.length <= MaxOrphanProviders ? providers[0] : undefined;
		if(pkg === undefined) {
			continue;
		}
		recordCallUsage(atKey(usage, pkg, (): PackageUsage => new Map()), name, vertex.args);
		// a package the project already declares or loads is a normal target, not an orphan needing attachment
		if(isKnown(pkg)) {
			continue;
		}
		atKey(attributed, pkg, () => new Set<string>()).add(name);
		// the exporters that lost, with the same calls recorded, so the guess can report what each of them would fit
		const losers = providers.filter(p => p !== pkg);
		alternatives.set(pkg, [...new Set([...alternatives.get(pkg) ?? [], ...losers])]);
		for(const alt of losers) {
			recordCallUsage(atKey(alternativeUsage, alt, (): PackageUsage => new Map()), name, vertex.args);
		}
	}
	return { attributed, alternatives, alternativeUsage };
}

/** the entry of `key`, inserting what `make` builds when the map has none yet */
function atKey<V>(map: Map<string, V>, key: string, make: () => V): V {
	let found = map.get(key);
	if(found === undefined) {
		map.set(key, found = make());
	}
	return found;
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
 * `undefined` (the function is absent) is a no; an empty capture (a generic like `seq` whose formals became
 * `UseMethod`, or a data gap) is uninformative and treated as accepting (so it never reports a false removal).
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

/** intersection of multiple survivor sets: versions that survive in every set */
export function intersectSurvivors(survivorSets: readonly (readonly TimelineEntry[])[]): TimelineEntry[] {
	if(survivorSets.length === 0) {
		return [];
	}
	const [first, ...rest] = survivorSets;
	const restVersions = rest.map(set => new Set(set.map(e => e.ver)));
	return first.filter(e => restVersions.every(set => set.has(e.ver)));
}

/**
 * Collapse alternative requirements that are all simple lower bounds (or all simple upper bounds) into the single
 * weakest one, which *is* their union: `>= 3.5.0 || >= 4.0.0` is just `>= 3.5.0`. This filters identically and keeps
 * a package with a long release history from reporting a dozen redundant alternatives.
 */
function collapseAlternatives(ranges: readonly Range[]): readonly Range[] {
	if(ranges.length < 2) {
		return ranges;
	}
	// only single-comparator ranges are comparable this cheaply; anything compound (`>=1.0 <2.0`) keeps its alternatives
	const simple = ranges.map(r => r.set.length === 1 && r.set[0].length === 1 ? r.set[0][0] : undefined);
	if(simple.some(c => c === undefined || (c.operator !== '>=' && c.operator !== '>' && c.operator !== '<=' && c.operator !== '<'))) {
		return ranges;
	}
	const lower = simple.every(c => c?.operator === '>=' || c?.operator === '>');
	const upper = simple.every(c => c?.operator === '<=' || c?.operator === '<');
	if(!lower && !upper) {
		return ranges;
	}
	let best = 0;
	for(let i = 1; i < ranges.length; i++) {
		const cmp = RVersion.compare(simple[i]?.semver.version, simple[best]?.semver.version);
		// the weakest bound wins; at the same version the inclusive one (`>=` over `>`) is the weaker
		if(cmp === 0 ? simple[i]?.operator.length === 2 : (lower ? cmp < 0 : cmp > 0)) {
			best = i;
		}
	}
	return [ranges[best]];
}

/**
 * The transitive constraints declared packages place on their own dependencies (one level deep). `versionsOf` gives
 * the versions of each declaring package that are still in play. The requirements are read from all of them, so a
 * constraint only ever filters when *every* one of them declares it (see {@link TransitiveConstraint}). Without it,
 * the single {@link Package.resolvedVersion|resolved version} is used, which is by definition universal.
 */
export function collectTransitiveConstraints(deps: ReadOnlyFlowrAnalyzerDependenciesContext, sources: readonly PackageSignatureSource[], versionsOf?: (pkg: string) => readonly VersionString[] | undefined): Map<string, TransitiveConstraint[]> {
	const out = new Map<string, TransitiveConstraint[]>();
	for(const pkg of deps.getDependencies()) {
		// merged across sources: a single source may only carry part of the package's history, and a version it lacks
		// would look like "declares nothing" and wrongly turn the requirement into a partial one
		const src = sourceForPackage(sources, pkg.name);
		if(!src) {
			continue;
		}
		const known = versionsOf?.(pkg.name);
		// `undefined` asks the source for its own default version, so a package with no candidates still yields its requirements
		const versions: readonly (VersionString | undefined)[] = known && known.length > 0 ? known : [pkg.resolvedVersion];
		// per required package: the distinct requirements found, and from how many of `versions` they were read
		const perDep = new Map<string, { readonly ranges: Map<string, Range>, declaredBy: number }>();
		for(const version of versions) {
			const seen = new Set<string>();
			for(const dep of src.dependencies(pkg.name, version) ?? []) {
				const range = dep.constraint ? RRange.parse(dep.constraint) : undefined;
				if(!range || seen.has(dep.name)) {
					continue;
				}
				seen.add(dep.name);
				let entry = perDep.get(dep.name);
				if(entry === undefined) {
					entry = { ranges: new Map(), declaredBy: 0 };
					perDep.set(dep.name, entry);
				}
				entry.ranges.set(range.raw, range);
				entry.declaredBy++;
			}
		}
		const only = versions.length === 1 ? versions[0] : undefined;
		const from = `${pkg.name}${only ? ' ' + only : ''}`;
		for(const [name, entry] of perDep) {
			const arr = out.get(name) ?? [];
			arr.push({ ranges: collapseAlternatives([...entry.ranges.values()]), from, universal: entry.declaredBy === versions.length });
			out.set(name, arr);
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

/** the per-analysis inputs every constraint pass shares, see {@link VersionSpace} */
export interface VersionSpaceOptions {
	readonly deps:      ReadOnlyFlowrAnalyzerDependenciesContext;
	/** how the analyzed code calls each package, from {@link collectUsage} */
	readonly usage:     ReadonlyMap<string, PackageUsage>;
	/** only consider releases up to this instant */
	readonly cutoff?:   Date;
	/** the assumed R version bounding base packages, when genuinely known */
	readonly rVersion?: string;
	/** constraint sources to skip entirely: neither filtered on nor reported */
	readonly disabled?: ReadonlySet<ConstraintSource>;
}

/** a target's sigdb package key, merged source and memoized signature resolver */
interface PackageResolution {
	readonly key:         string;
	readonly src:         PackageSignatureSource | undefined;
	readonly getFn:       FnResolver;
	/** the package's release timeline, ascending */
	readonly timeline:    readonly TimelineEntry[];
	/** the usage the signature pass judges by (base primitives dropped for a base package), `undefined` if unused */
	readonly usage:       PackageUsage | undefined;
	/** whether a version's signatures accept how the code calls it, see {@link makeSignatureFilter} */
	readonly signatureOk: (version: VersionString) => boolean;
}

/**
 * Whether a version's signatures accept how the code calls the package. The verdict depends only on the code and the
 * database, never on the constraints, so it is decided once per version and reused across the fixpoint's passes.
 */
function makeSignatureFilter(src: PackageSignatureSource | undefined, pkg: string, getFn: FnResolver, timeline: readonly TimelineEntry[], usage: PackageUsage | undefined): (version: VersionString) => boolean {
	if(!src || !usage) {
		return () => true;
	}
	// tracked names appear in some carried version; untracked names must not reject all versions
	const tracked = new Set([...usage.keys()].filter(fn => timeline.some(e => getFn(fn, e.ver) !== undefined)));
	const verdict = new Map<VersionString, boolean>();
	return version => {
		let ok = verdict.get(version);
		if(ok === undefined) {
			ok = !src.hasVersion(pkg, version) || isCompatible(getFn, version, usage, tracked);
			verdict.set(version, ok);
		}
		return ok;
	};
}

/**
 * The version space of one analysis: the surviving versions of each dependency and the transitive constraints
 * refined to a fixpoint. Holding the shared inputs here keeps the passes to a handful of arguments and lets each
 * package's sigdb key, source and decoded signatures be resolved once. The passes revisit the same versions
 * repeatedly, so that memoization is what makes the fixpoint affordable.
 */
export class VersionSpace {
	public readonly deps:     ReadOnlyFlowrAnalyzerDependenciesContext;
	public readonly sources:  readonly PackageSignatureSource[];
	public readonly usage:    ReadonlyMap<string, PackageUsage>;
	public readonly cutoff:   Date | undefined;
	public readonly rVersion: string | undefined;
	public readonly disabled: ReadonlySet<ConstraintSource>;
	private readonly resolved = new Map<string, PackageResolution>();

	constructor({ deps, usage, cutoff, rVersion, disabled = NoDisabledSources }: VersionSpaceOptions) {
		this.deps = deps;
		this.sources = deps.signatureSources();
		this.usage = usage;
		this.cutoff = cutoff;
		this.rVersion = rVersion;
		this.disabled = disabled;
	}

	/** the sigdb package, source and signature resolver of a target, resolved once */
	public resolve(name: string): PackageResolution {
		let entry = this.resolved.get(name);
		if(entry === undefined) {
			const key = timelinePackageKey(name, this.sources);
			const src = sourceForPackage(this.sources, key);
			const getFn = makeFnResolver(src, key);
			const timeline = src ? versionTimeline(src, key) : [];
			const all = this.usage.get(name);
			// base primitives are captured inconsistently, so their absence from a base package is a data gap, not a removal
			const usage = all && src?.isBaseR(key) ? new Map([...all].filter(([fn]) => !RBasePrimitives.has(fn))) : all;
			entry = { key, src, getFn, timeline, usage, signatureOk: makeSignatureFilter(src, key, getFn, timeline, usage) };
			this.resolved.set(name, entry);
		}
		return entry;
	}

	/** the versions of `name` surviving every constraint, see {@link survivingEntries} */
	public survivors(name: string, transitive: readonly TransitiveConstraint[], observe?: ConstraintObserver): SurvivingEntries {
		return survivingEntries(this, name, transitive, observe);
	}

	/**
	 * The transitive constraints, refined to a fixpoint: each pass re-reads every declaring package's requirements
	 * from the versions of it that survived the previous pass, so two packages can tighten each other. Feeding back
	 * the whole surviving set (not one representative version) is what keeps a requirement that only *some* of those
	 * versions declare from filtering (see {@link TransitiveConstraint}).
	 *
	 * The first pass runs with *no* transitive constraint at all, so every later pass can only shrink the surviving
	 * sets and thus only tighten the constraints: the refinement is monotone and cannot oscillate, and stopping early
	 * at `maxIterations` leaves it on the permissive side rather than at an arbitrary point. A declaring package that
	 * is not among the `targets` is not being guessed, so its {@link Package.resolvedVersion} stands in.
	 */
	public refineTransitive(targets: readonly string[], maxIterations = DefaultFixpointIterations): Map<string, TransitiveConstraint[]> {
		if(this.disabled.has('transitive')) {
			return collectTransitiveConstraints(this.deps, this.sources);
		}
		let transitive = new Map<string, TransitiveConstraint[]>();
		let previous = '';
		iterateToFixpoint(maxIterations, () => {
			const pass = new Map<string, readonly VersionString[]>();
			for(const name of targets) {
				pass.set(name, this.survivors(name, transitive.get(name) ?? []).survivors.map(e => e.ver));
			}
			// the sets only ever shrink, so their sizes and endpoints identify the state
			const signature = Array.from(pass, ([k, v]) => `${k}=${v.length}:${v[0] ?? ''}-${v[v.length - 1] ?? ''}`).sort().join(',');
			if(signature === previous) {
				return false;
			}
			previous = signature;
			transitive = collectTransitiveConstraints(this.deps, this.sources, name => pass.get(name));
			return true;
		});
		return transitive;
	}
}

/** the outcome of {@link enforceArcConsistency}: the pruned version sets, and which partner blocked each package */
export interface ArcConsistency {
	readonly survivors: Map<string, TimelineEntry[]>;
	/** per package, the partner that rejected a version and the requirement it could not meet */
	readonly blockers:  Map<string, Map<string, string>>;
}

/** drop, to a fixpoint, the versions of each package that no co-guessed dependency can satisfy */
export function enforceArcConsistency(space: VersionSpace, initial: ReadonlyMap<string, TimelineEntry[]>, maxIterations = DefaultFixpointIterations): ArcConsistency {
	const survivors = new Map(initial);
	const blockers = new Map<string, Map<string, string>>();
	iterateToFixpoint(maxIterations, () => {
		const versionsByName = new Map([...survivors].map(([name, entries]) => [name, entries.map(e => e.ver)]));
		let changed = false;
		for(const [name, entries] of survivors) {
			const { src, key } = space.resolve(name);
			if(src === undefined) {
				continue;
			}
			const kept = entries.filter(v => versionMeetsPartners(src, key, v.ver, versionsByName, name, (partner, constraint) => {
				const forPkg = blockers.get(name) ?? new Map<string, string>();
				forPkg.set(partner, constraint);
				blockers.set(name, forPkg);
			}));
			if(kept.length !== entries.length) {
				changed = true;
				survivors.set(name, kept);
			}
		}
		return changed;
	});
	return { survivors, blockers };
}

/** a package (or a linked group sharing one version) and its surviving versions, one factor of the combination count */
export interface CountFactor {
	readonly name:      string;
	readonly survivors: readonly string[];
}

/** two packages whose version choices are not independent, and whether that holds for all of their versions */
export interface VersionCoupling {
	readonly a:       string;
	readonly b:       string;
	/** `false` when only *some* versions of the two require each other, so the coupling does not always apply */
	readonly always:  boolean;
	/** whether the coupling was counted; a coupling closing a cycle in the graph is dropped from the count */
	readonly counted: boolean;
}

/** the result of {@link countRunnableCombinations} */
export interface CountedCombinations {
	/** the number of runnable version tuples; an upper bound when {@link couplings} contains uncounted entries */
	readonly total:     number;
	/** every coupling found between the counted factors */
	readonly couplings: readonly VersionCoupling[];
}

/** one pair of factors whose version choices are not independent */
interface FactorCoupling {
	readonly a:      number;
	readonly b:      number;
	/** whether every version that requires the other actually does, so the coupling always applies */
	readonly always: boolean;
}

/** the parseable requirements each surviving version of `f` places on the other packages, resolved once */
function factorRequirements(space: VersionSpace, f: CountFactor): Map<string, Range>[] {
	const { src, key } = space.resolve(f.name);
	return f.survivors.map(v => {
		const out = new Map<string, Range>();
		for(const dep of src?.dependencies(key, v) ?? []) {
			const range = dep.constraint ? RRange.parse(dep.constraint) : undefined;
			if(range && !out.has(dep.name)) {
				out.set(dep.name, range);
			}
		}
		return out;
	});
}

/** the coupling between two factors, or `undefined` when neither ever constrains the other */
function coupleFactors(a: number, b: number, factors: readonly CountFactor[], requirements: readonly Map<string, Range>[][]): FactorCoupling | undefined {
	const onB = requirements[a].map(r => r.has(factors[b].name));
	const onA = requirements[b].map(r => r.has(factors[a].name));
	if(!onB.some(Boolean) && !onA.some(Boolean)) {
		return undefined;
	}
	// a direction nobody requires is simply absent, not partial: only a direction some but not all versions declare is
	const partial = (side: readonly boolean[]) => side.some(Boolean) && !side.every(Boolean);
	return { a, b, always: !partial(onB) && !partial(onA) };
}

/** `ok[i][j]`: version `i` of factor `a` runs with version `j` of factor `b` */
function compatibilityMatrix(c: FactorCoupling, factors: readonly CountFactor[], requirements: readonly Map<string, Range>[][]): boolean[][] {
	const [fa, fb] = [factors[c.a], factors[c.b]];
	const onB = requirements[c.a].map(r => r.get(fb.name));
	const onA = requirements[c.b].map(r => r.get(fa.name));
	return fa.survivors.map((va, i) => fb.survivors.map((vb, j) =>
		(onB[i] === undefined || RRange.satisfies(vb, onB[i])) && (onA[j] === undefined || RRange.satisfies(va, onA[j]))));
}

/**
 * The runnable-combination count: how many version tuples satisfy the requirements the factors place on each other.
 * A requirement need not hold for every version of the declaring package (`A 0.2.5` may pin `B` to `0.2.1` while
 * `A 0.3.0` pins it to `0.3.2`), so the two are counted as *coupled* rather than as independent factors: a version
 * of `A` only ever multiplies in the versions of `B` it actually admits.
 *
 * Counting all couplings exactly is #CSP-hard, so they are counted over a spanning forest of the coupling graph,
 * preferring the couplings that always apply. That is exact whenever the graph has no cycle, which covers the common
 * shared-hub shape. A coupling that would close a cycle is dropped and reported as uncounted, leaving the result an
 * upper bound. Only the forest's couplings need their compatibility matrix, so the work stays linear in the factors.
 */
export function countRunnableCombinations(space: VersionSpace, factors: readonly CountFactor[]): CountedCombinations {
	const requirements = factors.map(f => factorRequirements(space, f));
	const found: FactorCoupling[] = [];
	for(let a = 0; a < factors.length; a++) {
		for(let b = a + 1; b < factors.length; b++) {
			const coupling = coupleFactors(a, b, factors, requirements);
			if(coupling) {
				found.push(coupling);
			}
		}
	}
	const parent = factors.map((_, i) => i);
	const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
	const tree: (FactorCoupling & { ok: boolean[][] })[] = [];
	const couplings = found.sort((x, y) => Number(y.always) - Number(x.always)).map(c => {
		const [ra, rb] = [find(c.a), find(c.b)];
		const counted = ra !== rb;
		if(counted) {
			parent[ra] = rb;
			tree.push({ ...c, ok: compatibilityMatrix(c, factors, requirements) });
		}
		return { a: factors[c.a].name, b: factors[c.b].name, always: c.always, counted };
	});
	return { total: countOverForest(factors, tree), couplings };
}

/** the number of assignments satisfying every coupling of a forest, by rooting each tree and folding bottom-up */
function countOverForest(factors: readonly CountFactor[], tree: readonly (FactorCoupling & { ok: boolean[][] })[]): number {
	const neighbours = factors.map((): { to: number, ok: boolean[][], flipped: boolean }[] => []);
	for(const c of tree) {
		neighbours[c.a].push({ to: c.b, ok: c.ok, flipped: false });
		neighbours[c.b].push({ to: c.a, ok: c.ok, flipped: true });
	}
	// weight[i] of a node: how many assignments of its subtree exist with that node fixed to version i
	const visited = factors.map(() => false);
	const subtree = (node: number, from: number): number[] => {
		visited[node] = true;
		const weight = factors[node].survivors.map(() => 1);
		for(const edge of neighbours[node]) {
			if(edge.to === from || visited[edge.to]) {
				continue;
			}
			const child = subtree(edge.to, node);
			for(let i = 0; i < weight.length; i++) {
				let sum = 0;
				for(let j = 0; j < child.length; j++) {
					sum += (edge.flipped ? edge.ok[j][i] : edge.ok[i][j]) ? child[j] : 0;
				}
				weight[i] *= sum;
			}
		}
		return weight;
	};
	let total = 1;
	for(let i = 0; i < factors.length; i++) {
		if(!visited[i]) {
			total *= subtree(i, -1).reduce((a, b) => a + b, 0);
		}
	}
	return total;
}

/** whether every requirement `pkg@ver` places on a co-guessed dependency is met by one of that partner's surviving versions */
function versionMeetsPartners(src: PackageSignatureSource, pkg: string, ver: string, partnerSurvivors: ReadonlyMap<string, readonly string[]>, selfName: string, onReject?: (partner: string, constraint: string) => void): boolean {
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

/** what {@link applyConstraints} filters a package's timeline by, beyond the date and R bounds it takes from the space */
interface ConstraintInputs {
	readonly declaredRange:       Range | undefined;
	readonly declaredConstraints: readonly string[];
	readonly transitive:          readonly TransitiveConstraint[];
	/** whether the package is an R-core / base package, so its version *is* an R version */
	readonly base:                boolean;
}

/**
 * Filter a version timeline by the declared range, transitive constraints, base-R version bound, and date cutoff,
 * emitting each constraint to `observe` (when given) as it is applied, so the filtering and its explanation cannot
 * drift apart. A source disabled on `space` is skipped entirely: neither filtered on nor reported as evidence.
 */
function applyConstraints(space: VersionSpace, name: string, timeline: readonly TimelineEntry[], inputs: ConstraintInputs, observe?: ConstraintObserver): TimelineEntry[] {
	const { disabled, rVersion, cutoff } = space;
	const { declaredRange, declaredConstraints, transitive, base } = inputs;
	let t = timeline.slice();
	if(!disabled.has('declared')) {
		for(const c of declaredConstraints) {
			observe?.({ source: 'declared', origin: 'project metadata', detail: `declared as ${c}`, bound: c });
		}
		t = declaredRange ? t.filter(e => RRange.satisfies(e.ver, declaredRange)) : t;
	}
	if(!disabled.has('transitive')) {
		for(const c of transitive) {
			const bound = RRange.formatAlternatives(c.ranges);
			// a constraint only some versions of the origin declare cannot filter: another of its versions avoids it
			const detail = c.universal ? `${c.from} requires ${name} ${bound}` : `some versions of ${c.from} require ${name} ${bound}`;
			observe?.({ source: 'transitive', origin: c.from, detail, bound, ...(c.universal ? {} : { partial: true }) });
			if(c.universal) {
				t = t.filter(e => RRange.satisfiesAny(e.ver, c.ranges));
			}
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
		// undated one is dropped, except base R older than the release table (kept, as it predates any real cutoff)
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
 * Prefer {@link VersionSpace.survivors}, which is the same call with the shared inputs already bound.
 */
export function survivingEntries(space: VersionSpace, name: string, transitive: readonly TransitiveConstraint[], observe?: ConstraintObserver): SurvivingEntries {
	const { deps, disabled } = space;
	// packageKey: sigdb package (R reuses base, others use themselves)
	const { key: packageKey, src, getFn, timeline, usage, signatureOk } = space.resolve(name);
	const declaredRange = disabled.has('declared') ? undefined : deps.inferredRange(name);
	const declaredConstraints = disabled.has('declared') ? [] : (deps.getDependency(name)?.versionConstraints.map(c => c.raw) ?? []);
	const effectiveTransitive = disabled.has('transitive') ? [] : transitive;
	// contradiction is a constraint property, not an empty database
	const unsatisfiable = constraintsContradict(declaredConstraints, declaredRange, effectiveTransitive);
	if(!src) {
		return { survivors: [], preSignature: [], getFn, declaredRange, declaredConstraints, base: false, unsatisfiable, total: 0, declared: 0, known: false };
	}
	const base = src.isBaseR(packageKey);
	const total = timeline.length;
	const known = total > 0;
	const declared = declaredRange ? timeline.filter(e => RRange.satisfies(e.ver, declaredRange)).length : total;
	// emit database coverage envelope as outer bounds
	if(observe && timeline.length > 0 && !disabled.has('available')) {
		observe({ source: 'available', origin: 'signature database', detail: `data available from ${timeline[0].ver}`, bound: `>=${timeline[0].ver}` });
		observe({ source: 'available', origin: 'signature database', detail: `data available up to ${timeline[timeline.length - 1].ver}`, bound: `<=${timeline[timeline.length - 1].ver}` });
	}
	const preSignature = applyConstraints(space, name, timeline, { declaredRange, declaredConstraints, transitive: effectiveTransitive, base }, observe);
	if(!usage || disabled.has('signature')) {
		return { survivors: preSignature, preSignature, getFn, declaredRange, declaredConstraints, base, unsatisfiable, total, declared, known };
	}
	if(observe) {
		addSignatureEvidence(observe, src, getFn, packageKey, usage, preSignature);
	}
	const survivors = preSignature.filter(e => signatureOk(e.ver));
	return { survivors, preSignature, getFn, declaredRange, declaredConstraints, base, unsatisfiable, total, declared, known };
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
	// only unambiguous requirements can contradict: a constraint with alternatives (or one only some versions declare) always has a way out
	const ranges = [declaredRange, ...transitive.filter(t => t.universal && t.ranges.length === 1).map(t => t.ranges[0])].filter((r): r is Range => r !== undefined);
	if(ranges.length === 0) {
		return false;
	}
	const combined = RRange.intersect(ranges);
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
	return [...new Set([...deps.getDependencies().map(d => d.name), ...usage.keys()])].filter(name => name !== ProjectPackage);
}

/** the requirements one concrete version declares, as {@link isCoInstallable} reads them */
export type DependencyResolver = (pkg: string, version: VersionString) => readonly ResolvedDependency[] | undefined;

/**
 * Whether the chosen versions can be loaded together. The per-package candidates are narrowed by requirements
 * merged over *all* versions of the requiring package, so a combination can still pair a version with one that
 * the version it was actually chosen alongside rules out (`library()` then reports the conflict). Packages
 * outside the assignment and requirements without a version qualifier constrain nothing.
 */
export function isCoInstallable(versions: ReadonlyMap<string, VersionString>, declares: DependencyResolver): boolean {
	for(const [pkg, version] of versions) {
		for(const dep of declares(pkg, version) ?? []) {
			const chosen = versions.get(dep.name);
			if(chosen === undefined || dep.constraint === undefined) {
				continue;
			}
			const range = RRange.parse(dep.constraint);
			if(range !== undefined && !RRange.satisfies(chosen, range)) {
				return false;
			}
		}
	}
	return true;
}

/**
 * Lazily yield concrete version assignments (one version per package) in odometer order over the per-package lists.
 * With `declares`, a combination whose versions cannot be loaded together is skipped rather than proposed; `limit`
 * bounds the combinations *considered* either way, so fewer than `limit` assignments may come out.
 */
export function* assignmentsOf(perPackage: readonly OrderedCandidates[], limit: number, declares?: DependencyResolver): Generator<VersionAssignment> {
	if(perPackage.length === 0 || perPackage.some(p => p.versions.length === 0)) {
		return;
	}
	const idx = perPackage.map(() => 0);
	for(let count = 0; count < limit; count++) {
		const versions = new Map<string, string>();
		for(let i = 0; i < perPackage.length; i++) {
			versions.set(perPackage[i].pkg, perPackage[i].versions[idx[i]]);
		}
		if(declares === undefined || isCoInstallable(versions, declares)) {
			yield { versions };
		}
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
async function orderedCandidatesFor(analyzer: ReadonlyFlowrAnalysisProvider, options: VersionExplodeOptions): Promise<{ candidates: OrderedCandidates[], declares: DependencyResolver }> {
	const ctx = analyzer.inspectContext();
	const deps = ctx.deps;
	const sources = deps.signatureSources();
	if(sources.length === 0) {
		return { candidates: [], declares: () => undefined };
	}
	const cutoff = options.date ? dateCutoff(options.date) : undefined;
	// bound base packages by R only when genuinely known (a config pin, metadata, or detection); `auto` with nothing detected imposes no R ceiling
	const rVersion = ctx.rVersionKnown ? (ctx.meta.getRVersion() ?? ctx.resolvedRVersion) : undefined;
	const usage = collectUsage((await analyzer.dataflow()).graph, deps);
	const targets = (options.packages && options.packages.length > 0 ? [...options.packages] : defaultTargets(deps, usage)).sort();
	const space = new VersionSpace({ deps, usage, cutoff, rVersion });
	const transitive = space.refineTransitive(targets);
	const order = options.order ?? 'newest';
	const out: OrderedCandidates[] = [];
	for(const name of targets) {
		const surviving = space.survivors(name, transitive.get(name) ?? []);
		const oc = orderedCandidatesOf(space.resolve(name).src, name, surviving, options.prefer?.[name], order);
		if(oc) {
			out.push(oc);
		}
	}
	return { candidates: out, declares: declaredDependenciesOf(space) };
}

/** the {@link DependencyResolver} backed by the signature database a version space resolves each package in */
export function declaredDependenciesOf(space: VersionSpace): DependencyResolver {
	return (pkg, version) => space.resolve(pkg).src?.dependencies(pkg, version);
}

/**
 * Explode the guessed constraint space into concrete, signature-database-available version assignments: a lazy
 * iterator over one chosen version per resolvable dependency. Each package's versions are ordered by preference
 * (an explicitly {@link VersionExplodeOptions.prefer|preferred} version, then non-archived releases, then newest or
 * oldest first), so the first assignments are the most preferred. The iterator is bounded by
 * {@link VersionExplodeOptions.limit} so an enormous product cannot run away.
 */
export async function* explodeDependencyVersions(analyzer: ReadonlyFlowrAnalysisProvider, options: VersionExplodeOptions = {}): AsyncGenerator<VersionAssignment> {
	const { candidates, declares } = await orderedCandidatesFor(analyzer, options);
	yield* assignmentsOf(candidates, options.limit ?? DefaultExplodeLimit, declares);
}
