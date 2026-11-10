import type { BrandedIdentifier, BrandedNamespace } from '../../dataflow/environments/identifier';
/**
 * Decoding a {@link PkgBlob} into the reader-facing views: the on-disk tuple form, the decoded function/
 * dependency records, and the {@link LibraryExports} export view. Pure -- no I/O, no mutation of inputs.
 * Split out of `../sigdb` so the reader/writer there does not carry the per-record decoding.
 */
import type { SigDict } from './dict';
import {
	ClassProp, DefaultCranBase, FnProp, FnPropNames, SigClassSystemNames,
	type DepType, type LibraryExports, type PkgBlob, type PkgBlobTuple, type SigClassInfo, type SigDbPkgMeta,
	type SigDefinitionLocation, type SigSlotInfo
} from './schema';
import type { ArgProps } from '../../dataflow/environments/built-in-props';
import { resolveVersion } from './sigdb-version';
import { compactRecord } from '../../util/objects';
import type { StatedGuards } from '../../dataflow/fn/guards/built-in-guards';
import type { withGuards } from './guarded-source';
import { RPrimitives } from '../../data/r-primitives.generated';

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
export function cranBlobUrl(cranBase: string, pkg: BrandedNamespace, version: string, opts: CranBlobInfo): string | undefined {
	if(!opts.cran) {
		return undefined;
	}
	const base = cranBase.endsWith('/') ? cranBase : cranBase + '/';
	return version === opts.latest && !opts.archived
		? `${base}${pkg}_${version}.tar.gz`
		: `${base}Archive/${pkg}/${pkg}_${version}.tar.gz`;
}

/** whether the record holds anything, without building the array `Object.keys(...).length` would */
function hasEntries(record: Readonly<Record<string, unknown>> | undefined): boolean {
	for(const _ in record) {
		return true;
	}
	return false;
}

/**
 * A {@link PkgBlob} in its compact on-disk tuple form, dropping the trailing fields it has nothing to say about
 * (the length says what is there, so no flag needs writing/reading), so a reader that stops earlier keeps working.
 */
export const blobTuple = (b: Readonly<PkgBlob>): PkgBlobTuple => {
	const head = [b.sigs, b.cgs, b.fns, b.versions, b.noncran ?? [], b.deps, b.depsByVersion] as const;
	if(b.contracts?.length) {
		return [...head, b.dates, b.sources ?? {}, b.classes ?? [], b.classesByVersion ?? {}, b.contracts, b.contractOf ?? {}];
	}
	if(b.classes?.length) {
		return [...head, b.dates, b.sources ?? {}, b.classes, b.classesByVersion ?? {}];
	}
	if(hasEntries(b.sources)) {
		return [...head, b.dates, b.sources];
	}
	return hasEntries(b.dates) ? [...head, b.dates] : [...head];
};
/** the inverse of {@link blobTuple}: rebuild a {@link PkgBlob} from its on-disk tuple */
export function tupleToBlob(t: PkgBlobTuple): PkgBlob {
	return { sigs: t[0], cgs: t[1], fns: t[2], versions: t[3], noncran: t[4]?.length ? t[4] : undefined, deps: t[5] ?? [], depsByVersion: t[6] ?? {}, dates: t[7] ?? {}, sources: t[8], classes: t[9]?.length ? t[9] : undefined, classesByVersion: t[10], contracts: t[11]?.length ? t[11] : undefined, contractOf: t[12] };
}

/** one decoded parameter of a function signature */
export interface SigParameter {
	readonly name:     BrandedIdentifier;
	/** bitfield of {@link ArgProp}, as flowR's built-ins state it; a bit the extractor cannot see stays unset */
	readonly props:    ArgProps;
	readonly default?: string;
}

/** the decoded view of one function at one package version */
export interface DecodedFunction {
	readonly name:        BrandedIdentifier;
	readonly file?:       string;
	readonly line:        number;
	readonly exported:    boolean;
	readonly props:       readonly string[];
	readonly signature:   readonly SigParameter[];
	readonly callees:     readonly BrandedIdentifier[];
	/** the Rd help topic (man-page name) documenting this function, when it differs from {@link name} */
	readonly topic?:      string;
	/** the package this name is re-exported from, see {@link SigFunctionInfo.reexportOf} */
	readonly reexportOf?: string;
	/** what a call has to fulfill to return normally: as the database stores it (see {@link SigFunctionInfo.guards}), or as far as another source knows, see {@link withGuards} */
	readonly guards?:     StatedGuards;
}

/**
 * The transitive callees of `name`. Each local callee that is itself a function of `functions` (one package
 * version's set) is expanded, names outside the set stay as leaves. Deduplicated and ascending.
 */
export function transitiveCallees(functions: readonly DecodedFunction[], name: BrandedIdentifier): BrandedIdentifier[] {
	const local = new Map(functions.map(f => [f.name, f.callees]));
	const reached = new Set<BrandedIdentifier>();
	const queue = [...(local.get(name) ?? [])];
	for(let callee; (callee = queue.pop()) !== undefined;) {
		if(reached.has(callee)) {
			continue;
		}
		reached.add(callee);
		const inner = local.get(callee);
		if(inner !== undefined) {
			queue.push(...inner);
		}
	}
	return [...reached].sort();
}

/** the contract the blob stores for one of its function records, if any */
function contractOf(this: void, blob: Readonly<PkgBlob>, fnIdx: number): StatedGuards | undefined {
	const idx = blob.contractOf?.[fnIdx];
	return idx === undefined ? undefined : blob.contracts?.[idx];
}

/** decode one of a blob's function records against the global string dictionary */
export function decodeFunction(strings: SigDict, blob: Readonly<PkgBlob>, fnIdx: number): DecodedFunction {
	const [nameIdx, sigIdx, cgIdx, bits, fileIdx, line, topicIdx, reexportIdx] = blob.fns[fnIdx];
	const name = strings.at(nameIdx);
	const signature = (sigIdx >= 0 ? blob.sigs[sigIdx] : []).map(p => {
		const [n, props, def] = Array.isArray(p) ? [p[0], p[1], p.length === 3 ? p[2] : -1] : [p, 0, -1];
		return compactRecord({ name: strings.at(n), props, default: def >= 0 ? strings.at(def) : undefined });
	});
	let callees: string[] = [];
	if(cgIdx >= 0) {
		let prev = 0;
		callees = blob.cgs[cgIdx].map(d => strings.at(prev += d));
	}
	return compactRecord({
		name,
		topic:      topicIdx !== undefined && topicIdx >= 0 ? strings.at(topicIdx) : undefined,
		reexportOf: reexportIdx !== undefined ? strings.at(reexportIdx) : undefined,
		guards:     contractOf(blob, fnIdx),
		file:       fileIdx >= 0 ? strings.at(fileIdx) : undefined,
		line,
		exported:   isExportedEntry(bits, name),
		props:      Object.entries(FnPropNames).filter(([m]) => bits & Number(m)).map(([, n]) => n),
		signature,
		callees
	});
}

/** a decoded package dependency of one version (`type` is the compact {@link DepType} enum; map to a label via {@link DepTypeNames}) */
export interface ResolvedDependency {
	readonly name:        BrandedNamespace;
	readonly type:        DepType;
	/** version qualifier as declared in DESCRIPTION, e.g. `>= 3.0.0` (absent = any version) */
	readonly constraint?: string;
}

/** decode the declared dependencies of one blob version (empty when it declares none / the bundle omits them) */
export function decodeDependencies(strings: SigDict, blob: Readonly<PkgBlob>, ver: string): ResolvedDependency[] {
	const idx = blob.depsByVersion[ver];
	if(idx === undefined) {
		return [];
	}
	return blob.deps[idx].map(d => compactRecord({ name: strings.at(d[0]), type: d[1], constraint: d.length === 3 ? strings.at(d[2]) : undefined }));
}

/** the classes a package version declares, decoded from the blob's class pool */
export function decodeClasses(strings: SigDict, blob: Readonly<PkgBlob>, ver: string): SigClassInfo[] {
	const list = blob.classesByVersion?.[ver];
	const pool = blob.classes;
	if(list === undefined || pool === undefined) {
		return [];
	}
	const out: SigClassInfo[] = [];
	let prev = 0;
	for(const delta of list) {
		const rec = pool[prev += delta];
		if(rec === undefined) {
			continue;
		}
		const [nameIdx, system, props, supers, slots, pkgIdx] = rec;
		out.push(compactRecord({
			name:   strings.at(nameIdx),
			system: SigClassSystemNames[system] ?? SigClassSystemNames[0],
			supers: supers.map(i => strings.at(i)),
			slots:  slots.map((sl): SigSlotInfo => typeof sl === 'number'
				? { name: strings.at(sl) }
				: { name: strings.at(sl[0]), type: strings.at(sl[1]) }),
			virtual: props & ClassProp.Virtual ? true : undefined,
			union:   props & ClassProp.Union ? true : undefined,
			package: pkgIdx !== undefined ? strings.at(pkgIdx) : undefined
		}));
	}
	return out;
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

/**
 * Whether a stored entry is an export. A method on a primitive generic (`setMethod("+", ...)`) binds nothing in the
 * namespace, so R exports it under no directive, and `pkg::"+"` does not exist; a database built before that was
 * known may still flag it exported, and attaching it would shadow the base primitive for every call.
 */
function isExportedEntry(bits: number, name: string): boolean {
	return (bits & FnProp.Exported) !== 0 && !((bits & FnProp.S4Method) !== 0 && RPrimitives.has(name));
}

/** derive the {@link LibraryExports} export view of one package version from its blob + metadata */
export function deriveLibraryExports(
	strings: SigDict, blob: Readonly<PkgBlob>, meta: SigDbPkgMeta, pkg: BrandedNamespace, version?: string, cranBase = DefaultCranBase
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
	const s3Classes: string[] = [];
	const s4Classes: string[] = [];
	const locations = new Map<string, SigDefinitionLocation>();
	const reexports = new Map<string, string>();
	for(const i of idxs) {
		const [nameIdx, , , bits, fileIdx, line, , reexportIdx] = blob.fns[i];
		const name = strings.at(nameIdx);
		(isExportedEntry(bits, name) ? exported : internal).push(name);
		if(bits & FnProp.Deprecated) {
			deprecated.push(name);
		}
		if(bits & FnProp.S3Owner) {
			s3Classes.push(name);
		}
		if(bits & FnProp.S4Owner) {
			s4Classes.push(name);
		}
		if(fileIdx >= 0) {
			locations.set(name, { file: strings.at(fileIdx), line });
		}
		if(reexportIdx !== undefined) {
			reexports.set(name, strings.at(reexportIdx));
		}
	}
	const cran = !blob.noncran?.includes(ver);
	return {
		version: ver, exported, internal, deprecated, s3Classes, s4Classes, cran,
		cranUrl: cranBlobUrl(cranBase, pkg, ver, { latest, archived: archived === 1, cran }),
		...(locations.size > 0 ? { locations } : {}),
		...(reexports.size > 0 ? { reexports } : {})
	};
}
