/**
 * Decoding a {@link PkgBlob} into the reader-facing views: the on-disk tuple form, the decoded function/
 * dependency records, and the {@link LibraryExports} export view. Pure -- no I/O, no mutation of inputs.
 * Split out of `../sigdb` so the reader/writer there does not carry the per-record decoding.
 */
import {
	DefaultCranBase, FnProp, FnPropNames, ParamFlag,
	type DepType, type LibraryExports, type PkgBlob, type PkgBlobTuple, type SigDbPkgMeta, type SigDefinitionLocation
} from './schema';
import { resolveVersion } from './sigdb-version';

/** the CRAN status of a version, used to build (or skip) its source-tarball link */
export interface CranBlobInfo {
	readonly latest:   string;
	readonly archived: boolean;
	readonly cran:     boolean;
}

/**
 * Reconstruct the CRAN source blob link which is the newest non-archived version lives under `src/contrib`,
 * every other under `Archive`.
 */
export function cranBlobUrl(cranBase: string, pkg: string, version: string, opts: CranBlobInfo): string | undefined {
	if(!opts.cran) {
		return undefined;
	}
	const base = cranBase.endsWith('/') ? cranBase : cranBase + '/';
	return version === opts.latest && !opts.archived
		? `${base}${pkg}_${version}.tar.gz`
		: `${base}Archive/${pkg}/${pkg}_${version}.tar.gz`;
}

/** a {@link PkgBlob} in its compact on-disk tuple form (drops the trailing `dates` when empty) */
export const blobTuple = (b: Readonly<PkgBlob>): PkgBlobTuple => Object.keys(b.dates).length > 0
	? [b.sigs, b.cgs, b.fns, b.versions, b.noncran ?? [], b.deps, b.depsByVersion, b.dates]
	: [b.sigs, b.cgs, b.fns, b.versions, b.noncran ?? [], b.deps, b.depsByVersion];
/** the inverse of {@link blobTuple}: rebuild a {@link PkgBlob} from its on-disk tuple */
export function tupleToBlob(t: PkgBlobTuple): PkgBlob {
	return { sigs: t[0], cgs: t[1], fns: t[2], versions: t[3], noncran: t[4]?.length ? t[4] : undefined, deps: t[5] ?? [], depsByVersion: t[6] ?? {}, dates: t[7] ?? {} };
}

/** one decoded parameter of a function signature */
export interface SigParameter {
	readonly name:     string;
	readonly forced:   boolean;
	readonly optional: boolean;
	readonly default?: string;
}

/** the decoded view of one function at one package version */
export interface DecodedFunction {
	readonly name:      string;
	readonly file?:     string;
	readonly line:      number;
	readonly exported:  boolean;
	readonly props:     readonly string[];
	readonly signature: readonly SigParameter[];
	readonly callees:   readonly string[];
}

/**
 * The formal parameter names of a known signature, ready for `RFunctionCall.matchArgumentsToParameters`: the
 * `...` parameter is excluded so partial (`pmatch`) matches against the remaining names stay unambiguous.
 */
export function signatureParameterNames(signature: readonly SigParameter[]): string[] {
	return signature.map(p => p.name).filter(n => n !== '...');
}

/** decode one of a blob's function records against the global string dictionary */
export function decodeFunction(strings: readonly string[], blob: Readonly<PkgBlob>, fnIdx: number): DecodedFunction {
	const [nameIdx, sigIdx, cgIdx, bits, fileIdx, line] = blob.fns[fnIdx];
	const signature = (sigIdx >= 0 ? blob.sigs[sigIdx] : []).map(p => {
		const [n, flags, def] = Array.isArray(p) ? [p[0], p[1], p.length === 3 ? p[2] : -1] : [p, 0, -1];
		return {
			name:     strings[n],
			forced:   Boolean(flags & ParamFlag.Forced),
			optional: !(flags & ParamFlag.Missing),
			...(def >= 0 ? { default: strings[def] } : {})
		};
	});
	let callees: string[] = [];
	if(cgIdx >= 0) {
		let prev = 0;
		callees = blob.cgs[cgIdx].map(d => strings[prev += d]);
	}
	return {
		name:     strings[nameIdx],
		...(fileIdx >= 0 ? { file: strings[fileIdx] } : {}),
		line,
		exported: Boolean(bits & FnProp.Exported),
		props:    Object.entries(FnPropNames).filter(([m]) => bits & Number(m)).map(([, n]) => n),
		signature,
		callees
	};
}

/** a decoded package dependency of one version (`type` is the compact {@link DepType} enum; map to a label via {@link DepTypeNames}) */
export interface ResolvedDependency {
	readonly name:        string;
	readonly type:        DepType;
	/** version qualifier as declared in DESCRIPTION, e.g. `>= 3.0.0` (absent = any version) */
	readonly constraint?: string;
}

/** decode the declared dependencies of one blob version (empty when it declares none / the bundle omits them) */
export function decodeDependencies(strings: readonly string[], blob: Readonly<PkgBlob>, ver: string): ResolvedDependency[] {
	const idx = blob.depsByVersion[ver];
	if(idx === undefined) {
		return [];
	}
	return blob.deps[idx].map(d => ({
		name: strings[d[0]],
		type: d[1],
		...(d.length === 3 ? { constraint: strings[d[2]] } : {})
	}));
}

/** the function indices of a blob version (undoing the delta encoding) */
export function versionFnIndices(blob: Readonly<PkgBlob>, ver: string): number[] | undefined {
	const list = blob.versions[ver];
	if(list === undefined) {
		return undefined;
	}
	const out: number[] = [];
	let prev = 0;
	for(const d of list) {
		out.push(prev += d);
	}
	return out;
}

/** derive the {@link LibraryExports} export view of one package version from its blob + metadata */
export function deriveLibraryExports(
	strings: readonly string[], blob: Readonly<PkgBlob>, meta: SigDbPkgMeta, pkg: string, version?: string, cranBase = DefaultCranBase
): LibraryExports | undefined {
	const [latest, archived] = meta;
	const ver = resolveVersion(blob, latest, version);
	if(ver === undefined) {
		return undefined;
	}
	const idxs = versionFnIndices(blob, ver) ?? [];
	const exported: string[] = [];
	const internal: string[] = [];
	const deprecated: string[] = [];
	const locations = new Map<string, SigDefinitionLocation>();
	for(const i of idxs) {
		const [nameIdx, , , bits, fileIdx, line] = blob.fns[i];
		const name = strings[nameIdx];
		(bits & FnProp.Exported ? exported : internal).push(name);
		if(bits & FnProp.Deprecated) {
			deprecated.push(name);
		}
		if(fileIdx >= 0) {
			locations.set(name, { file: strings[fileIdx], line });
		}
	}
	const cran = !blob.noncran?.includes(ver);
	return {
		version: ver, exported, internal, deprecated, cran,
		cranUrl: cranBlobUrl(cranBase, pkg, ver, { latest, archived: archived === 1, cran }),
		...(locations.size > 0 ? { locations } : {})
	};
}
