import type { ArgProps, BuiltInFnInfo, CallProps, FnSig } from './built-in-props';
import { CallProp, fnInfoFromSignature, PropagatedProps } from './built-in-props';
import type { BuiltIns } from './built-in';
import type { BuiltInDefinition, BuiltInDefinitions } from './built-in-config';
import { DefaultBuiltinConfig } from './default-builtin-config';
import type { REnvironmentInformation } from './environment';
import type { IdentifierDefinition } from './identifier';
import { Identifier, ReferenceType } from './identifier';
import { resolveByName } from './resolve-by-name';
import type { PackageSignatureSource } from '../../project/sigdb/reader';

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

function ofDefinitions(definitions: readonly IdentifierDefinition[] | undefined): BuiltInFnInfo | undefined {
	let sig, props;
	for(const d of definitions ?? []) {
		if(d.type !== ReferenceType.BuiltInFunction) {
			continue;
		}
		const info = d.config as BuiltInFnInfo | undefined;
		sig ??= info?.sig;
		props = info?.props === undefined ? props : (props ?? 0) | info.props;
	}
	return sig === undefined && props === undefined ? undefined : { sig, props };
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
		const resolved = resolveByName(name, environment, ReferenceType.Function);
		if(resolved?.some(d => d.type !== ReferenceType.BuiltInFunction)) {
			return undefined;
		}
		info = ofDefinitions(resolved);
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
	return { sig: info?.sig ?? known.sig, props: (info?.props ?? 0) | (known.props ?? 0) };
}

/**
 * What the signature database implies for a package function: what its own entry states
 * (see {@link fnInfoFromSignature}) plus the {@link PropagatedProps} of everything it calls, transitively.
 * A package function that ends up in `system()` runs a system command as well.
 */
export function inferFnProps(src: PackageSignatureSource, pkg: string, name: string, version?: string): BuiltInFnInfo | undefined {
	const fn = src.functionByName(pkg, name, version);
	if(fn === undefined) {
		return undefined;
	}
	const own = fnInfoFromSignature(fn);
	const known = BuiltInIndex.default();
	let props = own.props ?? 0;
	for(const callee of src.transitiveCallees(pkg, name, version) ?? fn.callees) {
		props |= (known.propsOf(callee) ?? 0) & PropagatedProps;
	}
	return { sig: own.sig, props };
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
export interface BuiltInEntry {
	/** the identifier the built-in is registered under, with a replacement's suffix spelled out */
	readonly name:   Identifier
	/** the {@link CallProp} bits the definition states, `undefined` when it states none */
	readonly props?: CallProps
	/** the declared parameters and what each of their arguments is used for */
	readonly sig?:   FnSig
	/** whether the value solver can fold a call of this built-in to a constant */
	readonly folds:  boolean
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

function entryOfDefinition(definition: BuiltInDefinition): readonly BuiltInEntry[] {
	if(definition.type === 'constant') {
		return [];
	}
	const info = definition.config as BuiltInFnInfo | undefined;
	const folds = definition.type === 'function' && definition.evalHandler !== undefined;
	return builtInNames(definition).map(name => ({ name, props: info?.props, sig: info?.sig, folds }));
}

function entriesOfMemory(builtIns: BuiltIns): readonly BuiltInEntry[] {
	const out: BuiltInEntry[] = [];
	for(const [registered, definitions] of builtIns.builtInMemory) {
		for(const d of definitions) {
			if(d.type !== ReferenceType.BuiltInFunction) {
				continue;
			}
			const info = d.config as BuiltInFnInfo | undefined;
			/* the memory is keyed by the bare name, the definition keeps the namespace it was declared with */
			out.push({ name: d.name ?? registered, props: info?.props, sig: info?.sig, folds: d.evalHandler !== undefined });
		}
	}
	return out;
}

let defaultIndex: BuiltInIndex | undefined;

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
	private readonly byName = new Map<string, BuiltInEntry>();
	private readonly cache = new Map<string, readonly Identifier[]>();

	private constructor(public readonly entries: readonly BuiltInEntry[]) {
		for(const e of entries) {
			this.byName.set(Identifier.getName(e.name), e);
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

	/** Every built-in whose props carry at least one bit of `props`, like {@link CallProp.File} for the file calls. */
	public with(props: CallProps): readonly Identifier[] {
		return this.cached(`with:${props}`, e => ((e.props ?? 0) & props) !== 0);
	}

	/**
	 * Every built-in whose props carry *every* bit of `props`, for the questions a single bit cannot answer,
	 * like {@link FileInputProps} for the calls that read a file rather than only write one.
	 */
	public withAll(props: CallProps): readonly Identifier[] {
		return this.cached(`all:${props}`, e => e.props !== undefined && (e.props & props) === props);
	}

	/**
	 * Every built-in that states its props but carries no bit of `props`. With {@link InputProps} this yields
	 * the calls that derive their result from their arguments alone.
	 */
	public without(props: CallProps): readonly Identifier[] {
		return this.cached(`without:${props}`, e => e.props !== undefined && (e.props & props) === 0);
	}

	/** Every built-in flowR states computes a result and nothing else ({@link CallProp.Pure}). */
	public get pure(): readonly Identifier[] {
		return this.with(CallProp.Pure);
	}

	/** Every built-in the value solver can fold to a constant (the ones with a `evalHandler`). */
	public get folding(): readonly Identifier[] {
		return this.cached('folding', e => e.folds);
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

	/** What the index states about `name`, ignoring any namespace (built-ins are registered by their bare name). */
	public get(name: Identifier): BuiltInEntry | undefined {
		return this.byName.get(Identifier.getName(name));
	}

	/** The {@link CallProp} bits of `name`, `undefined` when no built-in of that name states any. */
	public propsOf(name: Identifier): CallProps | undefined {
		return this.get(name)?.props;
	}
}
