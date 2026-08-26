import { type ArgProps, type BuiltInFnInfo, CallProp, CallProps, fnInfoFromSignature, type FnSig, PropagatedProps, type PropSelector, type SemanticCallTags, type StatedProps } from './built-in-props';
import type { BuiltIns } from './built-in';
import type { BuiltInDefinition, BuiltInDefinitions } from './built-in-config';
import { DefaultBuiltinConfig } from './default-builtin-config';
import type { REnvironmentInformation } from './environment';
import { REnvironment } from './environment';
import type { BrandedIdentifier, IdentifierDefinition } from './identifier';
import { Identifier, PkgName, ReferenceType } from './identifier';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { PackageSignatureSource } from '../../project/sigdb/reader';
import type { DecodedFunction } from '../../project/sigdb/decode';
import type { SignatureDb } from '../../project/sigdb/signature-db';
import { signatureDbOf } from '../../project/sigdb/signature-db';
import { Resolve } from './resolve-helper';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import type { DataflowInformation } from '../info';
import { FunctionCallVertex } from '../graph/vertex';
import { Dataflow } from '../graph/df-helper';
import { AttachedBasePackageSet, baseRExportOwner } from '../../util/r-base-packages';

/**
 * Where to look up what flowR knows about a function, in that order:
 * the name as it resolves here, the built-in definitions, and the signature database for the rest.
 */
export interface FnPropsSource {
	/** resolve the name here first, so a definition in the analyzed code shadows the built-in as it does in R */
	readonly environment?: REnvironmentInformation
	/** consulted when there is no environment at hand */
	readonly builtIns?:    BuiltIns
	/** fills in what the built-in definitions do not state, for namespaced names */
	readonly signatures?:  PackageSignatureSource
	/** the package version to ask the signature database for (its latest by default) */
	readonly version?:     string
}

/**
 * What flowR states about the package export `definition` binds, `undefined` if it binds none or if flowR
 * states nothing about it. `library(pkg)` binds every export itself, and that binding hides the built-in layer.
 */
function statedBuiltIn(definition: IdentifierDefinition, environment: REnvironmentInformation): readonly IdentifierDefinition[] | undefined {
	const pkgFn = definition.type === ReferenceType.Function ? NodeId.toPkgFn(definition.nodeId) : undefined;
	if(pkgFn === undefined) {
		return undefined;
	}
	const [pkg, fn] = pkgFn;
	const known = REnvironment.findBuiltIn(environment.current).memory.get(fn)
		?.filter(d => d.type === ReferenceType.BuiltInFunction && Identifier.getNamespace(d.name ?? '') === pkg);
	return known?.length ? known : undefined;
}

/** `definitions` with every package export replaced by what flowR states about it, the array itself if none is one. */
function withStatedBuiltIns(definitions: readonly IdentifierDefinition[], environment: REnvironmentInformation): readonly IdentifierDefinition[] {
	let replaced: IdentifierDefinition[] | undefined;
	for(const [at, definition] of definitions.entries()) {
		const stated = statedBuiltIn(definition, environment);
		if(stated === undefined) {
			replaced?.push(definition);
		} else {
			replaced ??= definitions.slice(0, at);
			replaced.push(...stated);
		}
	}
	return replaced ?? definitions;
}

function ofDefinitions(definitions: readonly IdentifierDefinition[] | undefined): BuiltInFnInfo | undefined {
	let sig: FnSig | undefined;
	let stated: StatedProps = {};
	let frame: ArgProps | undefined;
	for(const d of definitions ?? []) {
		if(d.type !== ReferenceType.BuiltInFunction) {
			continue;
		}
		const info = d.config as BuiltInFnInfo | undefined;
		sig ??= info?.sig;
		stated = CallProps.join(stated, info);
		frame = info?.frame === undefined ? frame : (frame ?? 0) | info.frame;
	}
	return sig === undefined && frame === undefined && !CallProps.hasAny(stated) ? undefined : { sig, ...stated, frame };
}

/**
 * What flowR knows about the function `name`: what the built-in definitions state, filled up with what the
 * signature database knows (see {@link fnInfoFromSignature}). A declared signature wins, the properties of
 * both are joined. `undefined` if neither has anything to say, and also if the name resolves to a definition
 * in the analyzed code, which shadows any built-in.
 */
export function queryFnProps(name: Identifier, { environment, builtIns, signatures, version }: FnPropsSource): BuiltInFnInfo | undefined {
	let info: BuiltInFnInfo | undefined;
	if(environment !== undefined) {
		const resolved = Resolve.byNameAndType(name, environment, ReferenceType.Function);
		const stated = resolved === undefined ? undefined : withStatedBuiltIns(resolved, environment);
		if(stated?.some(d => d.type !== ReferenceType.BuiltInFunction)) {
			return undefined;
		}
		info = ofDefinitions(stated);
	} else if(builtIns !== undefined) {
		info = ofDefinitions(builtIns.builtInMemory.get(Identifier.getName(name)));
	}
	const pkg = Identifier.getNamespace(name);
	if(signatures === undefined || pkg === undefined) {
		return info;
	}
	const known = inferFnProps(signatures, pkg, Identifier.getName(name), version);
	if(known === undefined) {
		return info;
	}
	return { sig: info?.sig ?? known.sig, ...CallProps.join(info, known), frame: info?.frame };
}

/**
 * How to ask what flowR states about a built-in, answering every name once. The analyzer context decides, so a
 * configured or overwritten built-in is what answers; without one the defaults do.
 */
export function builtInLookup(ctx?: ReadOnlyFlowrAnalyzerContext): (name: Identifier) => BuiltInFnInfo | undefined {
	const environment = ctx?.env.makeCleanEnv();
	/* keyed by namespace and name, as `stats::filter` and `dplyr::filter` are not the same function */
	const known = new Map<string | undefined, Map<string, BuiltInFnInfo | undefined>>();
	return name => {
		const namespace = Identifier.getNamespace(name);
		const key = Identifier.getName(name);
		let bucket = known.get(namespace);
		if(bucket === undefined) {
			bucket = new Map<string, BuiltInFnInfo | undefined>();
			known.set(namespace, bucket);
		}
		if(!bucket.has(key)) {
			bucket.set(key, environment === undefined ? BuiltInIndex.default().get(name) : queryFnProps(name, { environment }));
		}
		return bucket.get(key);
	};
}

/** What flowR states about the call `id` makes, together with the name the call resolved to. */
export function callFnProps(id: NodeId, { graph, environment }: Pick<DataflowInformation, 'graph' | 'environment'>): (BuiltInFnInfo & { name: Identifier }) | undefined {
	const vertex = graph.getVertex(id);
	if(!FunctionCallVertex.is(vertex)) {
		return undefined;
	}
	/* what the call resolved to decides, as a definition in the analyzed code shadows the built-in; a call
	 * flowR settled on the built-ins keeps no environment, and a later redefinition must not speak for it */
	const known = vertex.environment ?? environment;
	const name = Dataflow.qualify(id, graph, false) ?? vertex.name;
	return {
		name,
		...queryFnProps(name, {
			environment: vertex.onlyBuiltin ? { level: 0, current: REnvironment.findBuiltIn(known.current) } : known
		})
	};
}

/**
 * What the signature database implies for a package function: what its own entry states
 * (see {@link fnInfoFromSignature}) plus the {@link PropagatedProps} of everything it calls, transitively.
 * A package function that ends up in `system()` runs a system command as well.
 */
export function inferFnProps(src: PackageSignatureSource, pkg: string, name: string, version?: string): BuiltInFnInfo | undefined {
	const fn = src.functionByName(pkg, name, version);
	return fn === undefined ? undefined : propsOfSignature(src, fn, pkg, version);
}

/** {@link inferFnProps} for an already decoded entry, so a lookup that found one does not repeat it. */
function propsOfSignature(src: PackageSignatureSource, fn: DecodedFunction, pkg: string, version?: string): BuiltInFnInfo {
	const own = fnInfoFromSignature(fn);
	const known = BuiltInIndex.default();
	let props = own;
	for(const callee of src.transitiveCallees(pkg, fn.name, version) ?? fn.callees) {
		props = CallProps.join(props, CallProps.filter(known.get(callee), PropagatedProps));
	}
	return { sig: own.sig, ...props };
}

/**
 * Everything flowR knows about one function, no matter which of its sources knows it; see {@link fnInfo}.
 * It extends {@link BuiltInFnInfo}, so anything taking what a built-in states takes this as well.
 */
export interface FnInfo extends BuiltInFnInfo {
	/** the identifier the answer is for, with the namespace filled in when an unqualified ask resolved to a package */
	readonly name:       Identifier
	/** the package the answer is for, `undefined` when the name resolves to no package at all */
	readonly package?:   string
	/** the package version the answer is for, i.e. the one the analysis assumes; see {@link SignatureDb.versionOf} */
	readonly version?:   string
	/** the formal names in order, empty when neither source declares any */
	readonly parameters: readonly string[]
	/** whether flowR's own built-in definitions state anything about the name */
	readonly builtIn:    boolean
	/** whether flowR's value solver can fold a call of it to a constant */
	readonly foldable:   boolean
	/** the signature database entry: where the function is defined, its callees, its help topic */
	readonly entry?:     DecodedFunction
}

/**
 * The one place to ask what flowR knows about a function by name: one of its own built-ins, a package function
 * the signature database carries, or both. What the built-in states wins wherever the two overlap, exactly as
 * {@link queryFnProps} joins them. `undefined` when neither has anything to say about the name.
 * @param name    - The function to ask about, qualified (`Identifier.make('lead', 'dplyr')`) to pin the package down.
 * @param ctx     - The analyzer context the built-ins, the database and the assumed versions come from.
 * @param version - The package version to answer for, the one the analysis assumes if omitted.
 * @example
 * ```ts
 * const ctx = analyzer.inspectContext();
 * fnInfo(Identifier.make('lead', 'dplyr'), ctx)?.parameters; // ['x', 'n', 'default', 'order_by', '...']
 * fnInfo(Identifier.make('nchar'), ctx)?.foldable;           // true, flowR folds it itself
 * ```
 * @see {@link fnInfoLookup} - to ask the same question for many names
 */
export function fnInfo(name: Identifier, ctx: ReadOnlyFlowrAnalyzerContext, version?: string): FnInfo | undefined {
	const db = signatureDbOf(ctx.deps);
	const available = db.available();
	const [bare, namespace, internal] = Identifier.toArray(name);
	const pkg = namespace ?? packageExporting(bare, ctx);
	/* an unqualified ask keeps its form, the built-in layer has a search path of its own */
	const stated = queryFnProps(name, { environment: ctx.env.makeCleanEnv() });
	const qualified = pkg === undefined ? name : Identifier.make(bare, pkg, internal === true);
	const assumed = pkg === undefined ? undefined : version ?? db.versionOf(pkg);
	/* the identifier says how far to reach, `::` to the exports and `:::` past them */
	const entry = pkg === undefined || !available ? undefined : db.functionOf(qualified, version);
	const known = entry === undefined || pkg === undefined ? undefined : propsOfSignature(db.sources(), entry, pkg, assumed);
	if(stated === undefined && known === undefined) {
		return undefined;
	}
	/* the same identifier the built-in layer was asked with, so both halves of the answer describe one function */
	const definition = ctx.env.builtInFunctionOf(name);
	const sig = nonEmpty(stated?.sig) ?? nonEmpty(known?.sig);
	/* the database keeps every formal, a `sig` only the ones flowR models, so it answers first, but an entry
	 * that records none must not hide the formals the built-in does state */
	const parameters = nonEmpty(entry?.signature)?.map(p => p.name) ?? sig?.map(([param]) => param) ?? [];
	return {
		name:            qualified,
		package:         pkg,
		version:         assumed,
		sig,
		parameters,
		...CallProps.join(stated, known),
		frame:           stated?.frame,
		keepEnvironment: stated?.keepEnvironment,
		builtIn:         definition !== undefined || stated !== undefined,
		foldable:        definition?.evalHandler !== undefined,
		entry
	};
}

/** The array itself, `undefined` when it holds nothing, so an empty one does not count as an answer. */
function nonEmpty<T extends { readonly length: number }>(of: T | undefined): T | undefined {
	return of !== undefined && of.length > 0 ? of : undefined;
}

/**
 * The package an unqualified `name` is answered for. Only one the project pulls in counts, as a name some
 * unrelated package exports says nothing about the code at hand, and a `library()` of one sits above the base
 * packages. Where several pulled-in packages export it the most-used answers, as attach order is not known here.
 *
 * Base R is settled by {@link baseRExportOwner} when the database's export index does not carry the name, so
 * `sum` still answers as `base::sum` on a bundle holding no record of it and with no database at all.
 */
function packageExporting(name: BrandedIdentifier, ctx: ReadOnlyFlowrAnalyzerContext): string | undefined {
	let best: string | undefined;
	let bestRank = Number.MAX_SAFE_INTEGER;
	let pulled: ReadonlySet<string> | undefined;
	for(const pkg of ctx.deps.packagesExporting(name)) {
		const attached = pkg === PkgName.Base || AttachedBasePackageSet.has(pkg);
		if(!attached) {
			pulled ??= new Set(ctx.deps.getDependencies().map(d => d.name));
			if(!pulled.has(pkg)) {
				continue; // nothing attaches it here, so no call in this project reaches it unqualified
			}
			return pkg; // and nothing outranks a package the code attaches itself
		}
		const rank = pkg === PkgName.Base ? 2 : 1;
		if(rank < bestRank) {
			bestRank = rank;
			best = pkg;
		}
	}
	return best ?? baseRExportOwner(name);
}

/** The identifiers a definition registers, with the suffixes of a replacement spelled out. */
export function builtInNames(definition: BuiltInDefinition): Identifier[] {
	if(definition.type !== 'replacement') {
		return definition.names;
	}
	return definition.names.flatMap(n => definition.suffixes.map(
		s => Identifier.make(`${Identifier.getName(n)}${s}`, Identifier.getNamespace(n))));
}

/** One built-in as the {@link BuiltInIndex} sees it: the name it is registered under and what flowR states about it. */
export interface BuiltInEntry extends StatedProps {
	/** the identifier the built-in is registered under, with a replacement's suffix spelled out */
	readonly name:     Identifier
	/** the {@link CallProp} bits the definition states, `undefined` when it states none */
	readonly props?:   CallProps
	/** the {@link SemanticCallTags} entries the definition states, `undefined` when it states none */
	readonly tags?:    SemanticCallTags
	/** the declared parameters and what each of their arguments is used for */
	readonly sig?:     FnSig
	/** whether the value solver can fold a call of this built-in to a constant */
	readonly foldable: boolean
}

/** One parameter of a built-in, as {@link BuiltInIndex#params} reports it. */
export interface BuiltInParam {
	/** the built-in the parameter belongs to */
	readonly call:  Identifier
	/** the position it is declared at; a `...` parameter covers every position from here on */
	readonly index: number
	readonly name:  string
	readonly props: ArgProps
}

/** A {@link BuiltInEntry} while the index is built, carrying whether its definition replaces an earlier one. */
type IndexedEntry = BuiltInEntry & { readonly overrides?: boolean };

function entryOfDefinition(definition: BuiltInDefinition): readonly IndexedEntry[] {
	if(definition.type === 'constant') {
		return [];
	}
	const info = definition.config as BuiltInFnInfo | undefined;
	const foldable = definition.type === 'function' && definition.evalHandler !== undefined;
	return builtInNames(definition).map(name => ({ name, props: info?.props, tags: info?.tags, sig: info?.sig, foldable, overrides: definition.overrides }));
}

function entriesOfMemory(builtIns: BuiltIns): readonly IndexedEntry[] {
	const out: BuiltInEntry[] = [];
	/* the index says what flowR *knows*, not what is in scope, so the packages R does not attach on startup
	   belong in it as much as the always-on built-ins do -- being gated changes when a name resolves, not
	   whether flowR can answer for it */
	for(const memory of [builtIns.builtInMemory, ...builtIns.packageMemory.values()]) {
		for(const [registered, definitions] of memory) {
			for(const d of definitions) {
				if(d.type !== ReferenceType.BuiltInFunction) {
					continue;
				}
				const info = d.config as BuiltInFnInfo | undefined;
				/* the memory is keyed by the bare name, the definition keeps the namespace it was declared with */
				out.push({ name: d.name ?? registered, props: info?.props, tags: info?.tags, sig: info?.sig, foldable: d.evalHandler !== undefined });
			}
		}
	}
	return out;
}

let defaultIndex: BuiltInIndex | undefined;

/**
 * The one entry for a name several definitions state something about, the later definition winning wherever
 * it states anything -- a definition that only adds a {@link FnSig} must not drop the props of the one before.
 * A definition marked `overrides` replaces the earlier one outright, as that is what it says it does.
 */
function mergedEntry(known: BuiltInEntry, next: IndexedEntry): BuiltInEntry {
	return {
		name:     next.name,
		props:    next.props ?? known.props,
		tags:     next.tags ?? known.tags,
		sig:      next.sig ?? known.sig,
		foldable: next.foldable || known.foldable
	};
}

/** The entry alone, without what only the index build needs to know about it. */
function plainEntry({ name, props, tags, sig, foldable }: IndexedEntry): BuiltInEntry {
	return { name, props, tags, sig, foldable };
}

/** How early R's default search path reaches a name, deciding which package an unqualified ask answers with. */
function searchPathRank(name: Identifier): number {
	const namespace = Identifier.getNamespace(name);
	if(namespace === undefined) {
		return 0;
	}
	return namespace === PkgName.Base ? 1 : AttachedBasePackageSet.has(namespace) ? 2 : 3;
}

/**
 * The one place to ask what flowR's built-ins are: _every pure function_, _every call that reads a file_,
 * _every parameter that names a resource_, _everything the value solver can fold_. Each answer is derived
 * from the {@link BuiltInFnInfo} the definitions carry, so a built-in that states its {@link CallProp} bits and
 * its {@link FnSig} is found here without anything else being registered.
 *
 * Build one over the {@link DefaultBuiltinConfig} with {@link BuiltInIndex.default} (computed once and shared),
 * over your own definitions with {@link BuiltInIndex.of}, or over the built-ins an analysis actually registered
 * with {@link BuiltInIndex.ofEnvironment}, which reflects configured overrides. For a single name (where a
 * definition in the analyzed code shadows the built-in) use {@link queryFnProps} instead.
 */
export class BuiltInIndex {
	/** every built-in the index knows, one entry per namespace and name */
	public readonly entries: readonly BuiltInEntry[];
	/** the entry an unqualified name resolves to, the one R's default search path would find */
	private readonly byName = new Map<string, BuiltInEntry>();
	/** namespace to name to entry, so a qualified name is two lookups and no string built to ask */
	private readonly byNamespace = new Map<string, Map<string, BuiltInEntry>>();
	private readonly cache = new Map<string, readonly Identifier[]>();

	private constructor(definitions: readonly IndexedEntry[]) {
		const unqualified = new Map<string, BuiltInEntry>();
		/* where each name was first seen, so the entries keep the order the definitions come in */
		const order: [Map<string, BuiltInEntry>, string][] = [];
		for(const e of definitions) {
			const name = Identifier.getName(e.name);
			const namespace = Identifier.getNamespace(e.name);
			let bucket = unqualified;
			if(namespace !== undefined) {
				const inNamespace = this.byNamespace.get(namespace);
				if(inNamespace === undefined) {
					bucket = new Map<string, BuiltInEntry>();
					this.byNamespace.set(namespace, bucket);
				} else {
					bucket = inNamespace;
				}
			}
			const known = bucket.get(name);
			bucket.set(name, known === undefined || e.overrides ? plainEntry(e) : mergedEntry(known, e));
			if(known === undefined) {
				order.push([bucket, name]);
			}
		}
		this.entries = order.map(([bucket, name]) => bucket.get(name) as BuiltInEntry);
		for(const e of this.entries) {
			const name = Identifier.getName(e.name);
			const known = this.byName.get(name);
			if(known === undefined || searchPathRank(e.name) < searchPathRank(known.name)) {
				this.byName.set(name, e);
			}
		}
	}

	/** The index of flowR's own {@link DefaultBuiltinConfig}, computed on first use and shared from then on. */
	public static default(): BuiltInIndex {
		return defaultIndex ??= BuiltInIndex.of(DefaultBuiltinConfig);
	}

	/** The index of a set of built-in definitions, e.g. the ones a flowR config adds. */
	public static of(definitions: BuiltInDefinitions): BuiltInIndex {
		return new BuiltInIndex(definitions.flatMap(entryOfDefinition));
	}

	/** The index of the built-ins an analysis registered, so a configured or overwritten built-in is what shows up. */
	public static ofEnvironment(builtIns: BuiltIns): BuiltInIndex {
		return new BuiltInIndex(entriesOfMemory(builtIns));
	}

	/** answers are keyed by what was asked, as every caller asks the same handful of questions over and over */
	private cached(key: string, filter: (e: BuiltInEntry) => boolean): readonly Identifier[] {
		let found = this.cache.get(key);
		if(found === undefined) {
			this.cache.set(key, found = this.entries.filter(filter).map(e => e.name));
		}
		return found;
	}

	/** Every built-in carrying at least one property of `props`, like {@link SemanticCallTag.File} for the file calls. */
	public with(props: PropSelector): readonly Identifier[] {
		return this.cached(`with:${CallProps.key(props)}`, e => CallProps.hasAny(e, props));
	}

	/**
	 * Every built-in carrying *every* property of `props`, for the questions a single one cannot answer,
	 * like {@link FileInputProps} for the calls that read a file rather than only write one.
	 */
	public withAll(props: PropSelector): readonly Identifier[] {
		return this.cached(`all:${CallProps.key(props)}`, e => CallProps.hasAny(e) && CallProps.hasAll(e, props));
	}

	/**
	 * Every built-in that states its props but carries none of `props`. With {@link InputProps} this yields
	 * the calls that derive their result from their arguments alone.
	 */
	public without(props: PropSelector): readonly Identifier[] {
		return this.cached(`without:${CallProps.key(props)}`, e => CallProps.hasAny(e) && !CallProps.hasAny(e, props));
	}

	/** Every built-in flowR states computes a result and nothing else ({@link CallProp.Pure}). */
	public get pure(): readonly Identifier[] {
		return this.with(CallProp.Pure);
	}

	/** Every built-in the value solver can fold to a constant (the ones with a `evalHandler`). */
	public get foldable(): readonly Identifier[] {
		return this.cached('foldable', e => e.foldable);
	}

	/** Every parameter whose argument carries at least one bit of `props`, like {@link ArgProp.Resource}. */
	public params(props: ArgProps): BuiltInParam[] {
		const found: BuiltInParam[] = [];
		for(const e of this.entries) {
			e.sig?.forEach(([name, p], index) => {
				if((p & props) !== 0) {
					found.push({ call: e.name, index, name, props: p });
				}
			});
		}
		return found;
	}

	/**
	 * What the index states about `name`. A qualified name answers for that package alone, so `stats::filter`
	 * does not report what `dplyr::filter` states; an unqualified one answers with what R's default search
	 * path would find, `base` first and the other {@link AttachedBasePackageSet|attached base packages} next.
	 */
	public get(name: Identifier): BuiltInEntry | undefined {
		const namespace = Identifier.getNamespace(name);
		if(namespace === undefined) {
			return this.byName.get(Identifier.getName(name));
		}
		const found = this.byNamespace.get(namespace)?.get(Identifier.getName(name));
		if(found === undefined) {
			return undefined;
		}
		/* the maps settled name and namespace, what is left is `::` asking for a name only `:::` states */
		return Identifier.accessesInternal(found.name) !== true || Identifier.accessesInternal(name) === true ? found : undefined;
	}

	/** The {@link CallProp} bits of `name`, `undefined` when no built-in of that name states any. */
	public propsOf(name: Identifier): CallProps | undefined {
		return this.get(name)?.props;
	}
}
