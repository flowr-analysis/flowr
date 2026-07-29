import type { BuiltInFnInfo, CallProps } from './built-in-props';
import { fnInfoFromSignature, PropagatedProps } from './built-in-props';
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

let propsByName: Map<string, CallProps> | undefined;

/** what a call of `name` does, from the built-in definitions, by name alone */
function knownPropsOf(name: string): CallProps {
	propsByName ??= new Map(DefaultBuiltinConfig.flatMap(d => {
		const props = d.type !== 'constant' ? (d.config as BuiltInFnInfo | undefined)?.props : undefined;
		return props === undefined ? [] : builtInNames(d).map(n => [Identifier.getName(n), props] as const);
	}));
	return propsByName.get(name) ?? 0;
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
	let props = own.props ?? 0;
	for(const callee of src.transitiveCallees(pkg, name, version) ?? fn.callees) {
		props |= knownPropsOf(callee) & PropagatedProps;
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

const cache = new Map<CallProps, Identifier[]>();

function select(props: CallProps, definitions: BuiltInDefinitions, want: boolean): Identifier[] {
	const key = want ? props : ~props;
	const cached = definitions === DefaultBuiltinConfig ? cache.get(key) : undefined;
	if(cached !== undefined) {
		return cached;
	}
	const found = definitions.filter(d => {
		const has = d.type !== 'constant' ? (d.config as BuiltInFnInfo | undefined)?.props : undefined;
		return has !== undefined && (((has & props) !== 0) === want);
	}).flatMap(builtInNames);
	if(definitions === DefaultBuiltinConfig) {
		cache.set(key, found);
	}
	return found;
}

/**
 * Every built-in whose props carry any of `props`, as the identifiers they are registered under.
 * The answer for the {@link DefaultBuiltinConfig} is computed on first use and cached.
 */
export function builtInsWith(props: CallProps, definitions: BuiltInDefinitions = DefaultBuiltinConfig): Identifier[] {
	return select(props, definitions, true);
}

/**
 * The counterpart of {@link builtInsWith}: every built-in that states its props but carries none of `props`.
 * With {@link InputProps} this yields the calls that derive their result from their arguments.
 */
export function builtInsWithout(props: CallProps, definitions: BuiltInDefinitions = DefaultBuiltinConfig): Identifier[] {
	return select(props, definitions, false);
}
