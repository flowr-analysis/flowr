import { satisfies as semverSatisfies, validRange } from 'semver';
import type { BasicQueryData } from '../../base-query-format';
import type {
	SignatureQuery, SignatureQueryResult, SignaturePackageView, SignatureFunctionView, SignatureDatabaseView,
	SignatureMatchView, SignaturePackageMatch
} from './signature-query-format';
import { availableVersionEntries, getSharedSigSourceSync, type AvailableVersion, type PackageSignatureSource } from '../../../project/sigdb/reader';
import { isDateBound, releaseDateBound } from '../../../project/sigdb/sigdb-version';
import { DepTypeNames, type LibraryExports } from '../../../project/sigdb/schema';
import { defaultSigDbPaths } from '../../../project/sigdb/manifest';
import type { DecodedFunction } from '../../../project/sigdb/decode';
import { RVersion } from '../../../util/r-version';
import type { CommandCompletions } from '../../../cli/repl/core';

/** the CRAN package landing page (only meaningful for CRAN packages, not base R) */
export function cranPageUrl(pkg: string): string {
	return `https://cran.r-project.org/package=${encodeURIComponent(pkg)}`;
}

/** whether a pattern uses glob wildcards (`*`, `?`) */
function hasGlob(pattern: string | undefined): boolean {
	return pattern !== undefined && /[*?]/.test(pattern);
}

/** compile a glob (`*` matches any run, `?` matches one char) into an anchored, case-sensitive RegExp */
function globToRegExp(glob: string): RegExp {
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
	return new RegExp(`^${escaped}$`);
}

/** a name matcher: exact equality, or a glob test when the pattern uses wildcards */
function nameMatcher(pattern: string): (name: string) => boolean {
	if(hasGlob(pattern)) {
		const re = globToRegExp(pattern);
		return name => re.test(name);
	}
	return name => name === pattern;
}

/** whether a version spec can match more than one release (a glob or a semver range, not a single exact version) */
function isMultiVersion(spec: string): boolean {
	return /[*?xX]/.test(spec) || /[<>~^=]/.test(spec) || spec.includes('||') || spec.includes(' - ');
}

/** a version matcher for a spec: glob (`3.*`), semver range (`>=3.0.0`, `3.x`), or an exact version */
function versionMatcher(spec: string): (v: string) => boolean {
	if(hasGlob(spec)) {
		const re = globToRegExp(spec);
		return v => re.test(v);
	}
	const range = validRange(spec, { loose: true });
	if(range !== null) {
		return v => {
			const parsed = RVersion.parse(v);
			return parsed !== undefined ? semverSatisfies(parsed, range, { loose: true, includePrerelease: true }) : v === spec;
		};
	}
	return v => v === spec;
}

/** whether the query narrows results by parameter shape (parameter names and/or a required-parameter count) */
function hasParameterFilter(q: SignatureQuery): boolean {
	return (q.parameters?.length ?? 0) > 0 || q.requiredParameters !== undefined;
}

/** a predicate over a decoded function for the query's parameter filters, or `undefined` when none are set */
function parameterFilter(q: SignatureQuery): ((fn: DecodedFunction) => boolean) | undefined {
	if(!hasParameterFilter(q)) {
		return undefined;
	}
	const nameMatchers = q.parameters?.map(nameMatcher);
	const required = q.requiredParameters;
	return fn => {
		if(nameMatchers && !nameMatchers.every(m => fn.signature.some(p => m(p.name)))) {
			return false;
		}
		// required = no default; `...` is never a required parameter to provide
		return required === undefined || fn.signature.filter(p => p.name !== '...' && !p.optional).length === required;
	};
}

/** the version strings of a package the loaded source can answer (dated releases, base-R core releases, and the latest) */
function availableVersions(src: PackageSignatureSource, pkg: string): string[] {
	return availableVersionEntries(src, pkg).map(e => e.version);
}

/** a predicate selecting a package release by the `@version` spec: a date bound (`<=2026`, `>=2021.05`) or a version (exact/glob/range) */
function releaseMatcher(spec: string): (entry: AvailableVersion) => boolean {
	const byDate = releaseDateBound(spec);
	if(byDate) {
		return e => byDate(e.date);
	}
	const byVersion = versionMatcher(spec);
	return e => byVersion(e.version);
}

/** read-only CRAN GitHub mirror base; `github.com/cran/<pkg>` mirrors every CRAN package and tags each release */
const CranGithubMirror = 'https://github.com/cran';

/** the mirror repository of a CRAN package */
function cranMirrorRepoUrl(pkg: string): string {
	return `${CranGithubMirror}/${encodeURIComponent(pkg)}`;
}

/** deep-link a definition into the CRAN mirror at the package's version tag (falling back to `HEAD`) */
export function cranMirrorSourceUrl(pkg: string, version: string | undefined, file: string, line?: number): string {
	const ref = version ? encodeURIComponent(version) : 'HEAD';
	const anchor = line !== undefined && line >= 0 ? `#L${line}` : '';
	return `${cranMirrorRepoUrl(pkg)}/blob/${ref}/${file}${anchor}`;
}

/** the trailing fields shared by every function view: definition location and the (accurate) CRAN-mirror source link */
function locationFields(pkg: string, fn: DecodedFunction, version: string | undefined, base: boolean, cran: boolean) {
	return {
		...(fn.file ? { file: fn.file } : {}),
		...(fn.line >= 0 ? { line: fn.line } : {}),
		...(cran && !base && fn.file ? { sourceUrl: cranMirrorSourceUrl(pkg, version, fn.file, fn.line) } : {})
	};
}

/** the decoded view of one function, adding the CRAN-mirror source link */
function decodedToView(pkg: string, fn: DecodedFunction, version: string | undefined, opts: { cran: boolean, base: boolean }): SignatureFunctionView {
	return {
		name:       fn.name,
		package:    pkg,
		...(version !== undefined ? { version } : {}),
		exported:   fn.exported,
		properties: fn.props,
		parameters: fn.signature.map(p => ({
			name:     p.name,
			required: !p.optional,
			forced:   p.forced,
			...(p.default !== undefined ? { default: p.default } : {})
		})),
		callees: fn.callees,
		...locationFields(pkg, fn, version, opts.base, opts.cran)
	};
}

/**
 * The detailed view of a single function within a package: its signature (parameters, forced/optional,
 * defaults), properties, definition location, call graph, and -- for a CRAN package -- a deep link into the
 * read-only CRAN GitHub mirror. `version` defaults to the source's latest; `undefined` when the source does
 * not carry that function.
 */
export function signatureFunctionInfo(src: PackageSignatureSource, pkg: string, fnName: string, version?: string): SignatureFunctionView | undefined {
	const fns = src.functions(pkg, version) ?? src.functions(pkg);
	const fn = fns?.find(f => f.name === fnName);
	if(fn === undefined) {
		return undefined;
	}
	const exports = src.lookup(pkg, version) ?? src.lookup(pkg);
	const view = decodedToView(pkg, fn, exports?.version, { cran: exports?.cran ?? false, base: src.isBaseR(pkg) });
	// S3 dispatch targets are the `<generic>.<class>` functions in the same package (name-based, matching flowR's
	// own S3 handling). We use this rather than the stored `UseMethod` callee, which the bundled call graphs
	// aggregate transitively and so cannot distinguish a real generic from one that merely reaches a dispatch.
	const methods = (fns ?? [])
		.filter(f => f.name !== fn.name && f.name.startsWith(fn.name + '.'))
		.map(f => f.name)
		.sort();
	if(methods.length > 0) {
		return { ...view, s3generic: true, s3methods: methods };
	}
	return view;
}

/** the full view of a package: version, kind, export breakdown, dependencies, and every function's view */
export function signaturePackageInfo(src: PackageSignatureSource, pkg: string, resolved?: string): SignaturePackageView | undefined {
	const exports = src.lookup(pkg, resolved) ?? src.lookup(pkg);
	if(exports === undefined) {
		return undefined;
	}
	const base = src.isBaseR(pkg);
	const fns = src.functions(pkg, resolved) ?? src.functions(pkg) ?? [];
	const fnNames = new Set(fns.map(f => f.name));
	const constants = exports.exported.filter(n => !fnNames.has(n));
	const deps = (src.dependencies(pkg, resolved) ?? src.dependencies(pkg) ?? [])
		.map(d => ({ type: DepTypeNames[d.type], name: d.name, ...(d.constraint ? { constraint: d.constraint } : {}) }));
	const release = src.releaseDate(pkg, resolved);
	return {
		name:          pkg,
		version:       exports.version,
		...(resolved && resolved !== exports.version ? { resolved } : {}),
		base,
		cran:          exports.cran,
		...(exports.cranUrl ? { cranUrl: exports.cranUrl } : {}),
		...(exports.cran && !base ? { cranPage: cranPageUrl(pkg), repoUrl: cranMirrorRepoUrl(pkg) } : {}),
		...(release && !Number.isNaN(release.getTime()) ? { releaseDate: release.toISOString().slice(0, 10) } : {}),
		exportsTotal:  exports.exported.length,
		functionCount: exports.exported.length - constants.length,
		constants,
		internalCount: exports.internal.length,
		deprecated:    exports.deprecated,
		...(base && src.coreVersions(pkg) ? { coreVersions: src.coreVersions(pkg)?.map(v => v.str) } : {}),
		dependencies:  deps,
		functions:     fns.map(f => decodedToView(pkg, f, exports.version, { cran: exports.cran, base }))
	};
}

/** a few near matches for a mistyped package/symbol (case-insensitive substring), for a friendly hint */
function suggest(candidates: Iterable<string>, query: string, limit = 6): string[] {
	const needle = query.toLowerCase();
	const out: string[] = [];
	for(const c of candidates) {
		if(c.toLowerCase().includes(needle)) {
			out.push(c);
			if(out.length >= limit) {
				break;
			}
		}
	}
	return out;
}

/** cap on wildcard-search hits, so a `* *` search cannot exhaust memory */
const MaxMatches = 500;

/** how many parameter names a match preview shows before eliding the rest with `…` */
const ParamPreviewCap = 4;

/**
 * A short preview of a function's parameters for a match, when the query filters by parameter, kept in signature
 * order (highlighting never reorders it): the matched parameters are always shown, padded with leading parameters
 * for context up to {@link ParamPreviewCap} and elided with `…` when any are dropped. Also returns the matched names
 * so the renderer can highlight them. `undefined` when no parameter filter is set.
 */
function matchedParamPreview(fn: DecodedFunction, q: SignatureQuery): { preview: string[], matched: string[] } | undefined {
	if(!hasParameterFilter(q)) {
		return undefined;
	}
	const names = fn.signature.map(p => p.name);
	const matched = q.parameters?.length
		? names.filter(n => q.parameters?.some(pat => nameMatcher(pat)(n)))
		: [];
	const show = new Set(matched.length > 0 ? matched : fn.signature.filter(p => p.name !== '...' && !p.optional).map(p => p.name));
	for(const n of names) {
		if(show.size >= ParamPreviewCap) {
			break;
		}
		show.add(n);
	}
	const preview = names.filter(n => show.has(n));
	if(preview.length < names.length) {
		preview.push('…');
	}
	return { preview, matched };
}

/** a compact view for a wildcard search hit (signature/call-graph omitted; the JSON dump carries those per name) */
function compactMatch(pkg: string, fn: DecodedFunction, version: string | undefined, base: boolean, cran: boolean, params?: { preview: string[], matched: string[] }): SignatureMatchView {
	return {
		package:  pkg,
		name:     fn.name,
		exported: fn.exported,
		...(version !== undefined ? { version } : {}),
		...(fn.file ? { file: fn.file } : {}),
		...(fn.line >= 0 ? { line: fn.line } : {}),
		...(cran && !base && fn.file ? { sourceUrl: cranMirrorSourceUrl(pkg, version, fn.file, fn.line) } : {}),
		...(params && params.preview.length > 0 ? { parameters: params.preview } : {}),
		...(params && params.matched.length > 0 ? { matchedParameters: params.matched } : {})
	};
}

/** the versions of a package across every loaded source that holds it (current + history + any mounted extra) */
function allAvailableVersions(sources: readonly PackageSignatureSource[], pkg: string): string[] {
	const set = new Set<string>();
	for(const s of sources) {
		if(s.has(pkg)) {
			for(const v of availableVersions(s, pkg)) {
				set.add(v);
			}
		}
	}
	return [...set].sort((a, b) => RVersion.compare(a, b));
}

/**
 * The owning source that actually carries `version` -- `current` is checked before `history`, so a
 * latest-version query never decompresses the (large) history shard. Returns the first owner when no version
 * was asked, or `undefined` when an explicit version is carried by none of them.
 */
function sourceForVersion(owning: readonly PackageSignatureSource[], pkg: string, version: string | undefined): PackageSignatureSource | undefined {
	if(version === undefined) {
		return owning[0];
	}
	return owning.find(s => availableVersions(s, pkg).includes(version));
}

/** the message shown when a known package has no release matching the requested version, listing what is available */
function versionNotFoundMessage(pkg: string, lead: string, avail: readonly string[], base: boolean): string {
	// only nudge towards a full-history bundle when one is *not* already mounted (a single known version)
	const hint = !base && avail.length <= 1
		? ' Only the latest CRAN version is loaded; download the full history with `:signature download` (or mount one with `:signature add <path>`).'
		: '';
	return `${lead}${avail.length ? ` Available: ${avail.join(', ')}.` : ''}${hint}`;
}

/** run a wildcard search across the loaded sources: matching packages (no function), or matching functions */
function searchSources(sources: readonly PackageSignatureSource[], allNames: ReadonlySet<string>, q: SignatureQuery): Partial<SignatureQueryResult> {
	const cap = MaxMatches;
	const pkgMatch = nameMatcher(q.package as string);
	const matchedPkgs = [...allNames].filter(pkgMatch).sort();
	const relMatch = q.version ? releaseMatcher(q.version) : undefined;
	// every source holding a package (its latest lives in `current`, its older releases in `history`)
	const owningOf = (pkg: string) => sources.filter(s => s.has(pkg));
	// the versions of `pkg` matching the spec, unioned across all owning sources (so a `3.*`/date filter reaches history)
	const matchingVersions = (owners: readonly PackageSignatureSource[], pkg: string, m: (e: AvailableVersion) => boolean) =>
		[...new Set(owners.flatMap(s => availableVersionEntries(s, pkg).filter(m).map(e => e.version)))];

	const paramPred = parameterFilter(q);
	// a parameter filter (with no function name) still means "search functions", not "list packages"
	if(!q.function && paramPred === undefined) {
		const packages: SignaturePackageMatch[] = [];
		let truncated = false;
		for(const pkg of matchedPkgs) {
			const owners = owningOf(pkg);
			if(owners.length === 0) {
				continue;
			}
			const base = owners[0].isBaseR(pkg);
			// with a version filter, union the matching versions across all sources (so a `3.*`/date reaches history)
			const versions = relMatch
				? matchingVersions(owners, pkg, relMatch).sort((a, b) => RVersion.compare(a, b))
				: undefined;
			if(versions !== undefined && versions.length === 0) {
				continue;
			}
			if(packages.length >= cap) {
				truncated = true;
				break;
			}
			const cran = (owners[0].lookup(pkg)?.cran ?? false) && !base;
			const latest = owners[0].latestVersion(pkg)?.str;
			packages.push({ name: pkg, base, cran, ...(latest ? { latest } : {}), ...(versions ? { versions } : {}), ...(cran ? { cranPage: cranPageUrl(pkg) } : {}) });
		}
		return { packages, truncated };
	}

	const fnMatch = q.function ? nameMatcher(q.function) : () => true;
	// an exact function name lets us seek that one record (decoding only it) instead of decoding every function of
	// every package -- the difference between a fast `* ggplot` and one that decodes the whole database
	const exactName = q.function !== undefined && !hasGlob(q.function);
	const matches: SignatureMatchView[] = [];
	let searched = 0;
	let truncated = false;
	for(const pkg of matchedPkgs) {
		const owners = owningOf(pkg);
		if(owners.length === 0) {
			continue;
		}
		const base = owners[0].isBaseR(pkg);
		// map each version to the single source that owns it (current before history), computed once per package so a
		// version-filtered function search does not rebuild the release list per candidate version
		const ownerOf = new Map<string, PackageSignatureSource>();
		if(relMatch) {
			for(const o of owners) {
				for(const e of availableVersionEntries(o, pkg)) {
					if(!ownerOf.has(e.version) && relMatch(e)) {
						ownerOf.set(e.version, o);
					}
				}
			}
		}
		// versions to scan: with a filter, each matching release (scanned in its single owning source, so a release in
		// more than one source is not double-counted); without one, just the latest
		const versionsToScan: (string | undefined)[] = relMatch ? [...ownerOf.keys()] : [undefined];
		for(const v of versionsToScan) {
			const s = v === undefined ? owners[0] : ownerOf.get(v) ?? owners[0];
			const candidates = exactName
				? (fn => fn ? [fn] : [])(s.functionByName(pkg, q.function, v))
				: (s.functions(pkg, v) ?? s.functions(pkg) ?? []);
			// resolve the (heavier) package export view only once a function actually matches, so non-matching
			// packages in a wildcard search cost just the name lookup, not a full export derivation
			let exports: LibraryExports | undefined;
			let looked = false;
			for(const fn of candidates) {
				if(!fnMatch(fn.name)) {
					continue;
				}
				searched++;
				if(paramPred && !paramPred(fn)) {
					continue;
				}
				if(matches.length >= cap) {
					truncated = true;
					break;
				}
				if(!looked) {
					exports = s.lookup(pkg, v) ?? s.lookup(pkg);
					looked = true;
				}
				matches.push(compactMatch(pkg, fn, exports?.version, base, (exports?.cran ?? false) && !base, matchedParamPreview(fn, q)));
			}
			if(truncated) {
				break;
			}
		}
		if(truncated) {
			break;
		}
	}
	return { matches, matchCount: matches.length, searched, truncated };
}

/** the discoverable bundle sources for Tab completion (process-wide cached; opening the manifest reads no shard) */
function completionSources(): PackageSignatureSource[] {
	if(typeof process !== 'undefined' && process.env?.FLOWR_DISABLE_DEFAULT_SIGDB) {
		return [];
	}
	const out: PackageSignatureSource[] = [];
	for(const p of defaultSigDbPaths()) {
		const src = getSharedSigSourceSync(p);
		if(src) {
			out.push(src);
		}
	}
	return out;
}

/** the package part of a spec token, dropping any `@version` and `::function` suffix */
function packageOf(spec: string): string {
	return spec.split('::')[0].split('@')[0];
}

/** cap on offered names, so an empty fragment does not dump the whole 24k-package set at the terminal */
const MaxCompletions = 200;

/**
 * Tab-completer for `:query \@signature` / `:signature query`: package names in the first position, a package's
 * function names in the second (and after `pkg::`). Version specs and flags are left alone. Enumerating functions
 * decompresses the package's shard once (then cached); enumerating packages reads only the manifest.
 */
export function signatureQueryCompleter(line: readonly string[], startingNewArg: boolean): CommandCompletions {
	const sources = completionSources();
	if(sources.length === 0) {
		return { completions: [] };
	}
	const capped = (names: Iterable<string>, prefix: string, decorate: (n: string) => string): string[] => {
		const all: string[] = [];
		for(const n of names) {
			const d = decorate(n);   // filter on the offered text (e.g. `pkg::fn`), not the bare name
			if(d.startsWith(prefix)) {
				all.push(d);
			}
		}
		if(all.length <= MaxCompletions) {
			return all;
		}
		// too many to show: sample evenly across the sorted set so the offered names span the alphabet, not just
		// its head; index 0 stays first so the ghost hint still previews the true best (alphabetically first) match
		const stride = all.length / MaxCompletions;
		return Array.from({ length: MaxCompletions }, (_, i) => all[Math.floor(i * stride)]);
	};
	const packageNames = (): string[] => [...new Set(sources.flatMap(s => s.packageNames()))].sort();
	const functionsOf = (pkg: string): string[] => {
		const src = sources.find(s => s.has(pkg));
		return src ? [...new Set((src.functions(pkg) ?? []).map(f => f.name))].sort() : [];
	};

	// first token: a package spec (`pkg`, `pkg::fn`, `pkg@ver`)
	if(line.length === 0 || (line.length === 1 && !startingNewArg)) {
		const token = line[0] ?? '';
		const dbl = token.indexOf('::');
		if(dbl >= 0) {
			const pkg = packageOf(token), frag = token.slice(0, dbl + 2);
			return { completions: capped(functionsOf(pkg), token, fn => `${frag}${fn} `), argumentPart: token };
		}
		if(token.includes('@')) {
			return { completions: [] };   // typing a version, nothing to offer
		}
		return { completions: capped(packageNames(), token, p => `${p} `), argumentPart: token };
	}
	// second token: the function within the first token's package
	if((line.length === 1 && startingNewArg) || (line.length === 2 && !startingNewArg)) {
		const frag = line.length === 2 ? line[1] : '';
		return { completions: capped(functionsOf(packageOf(line[0])), frag, fn => `${fn} `), argumentPart: frag };
	}
	return { completions: [] };
}

/**
 * Executes the signature query. With no `package` it summarizes the loaded databases. A glob in `package`/`function`
 * or a multi-version `version` triggers a wildcard search (matching packages or functions). Otherwise a single
 * exact package (optionally at an exact `version`) yields its full view, or the detailed function view.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- executor contract returns a Promise; the work is synchronous
export async function executeSignatureQuery({ analyzer }: BasicQueryData, queries: readonly SignatureQuery[]): Promise<SignatureQueryResult> {
	const start = Date.now();
	const q = queries[queries.length - 1] ?? { type: 'signature' };
	const deps = analyzer.inspectContext().deps;
	const databases: SignatureDatabaseView[] = deps.loadedSignatureDatabases()
		.map(d => ({ scope: d.scope, version: d.version, date: d.date }));
	// the plugin's loaded sources (bundled default + $FLOWR_SIGDB + anything added at runtime), so the query
	// reflects dynamically-mounted sources
	const sources = deps.signatureSources();
	const packages = new Set<string>();
	for(const s of sources) {
		for(const n of s.packageNames()) {
			packages.add(n);
		}
	}
	const meta = (): SignatureQueryResult => ({ '.meta': { timing: Date.now() - start }, databases, packageCount: packages.size, sourceCount: sources.length });

	if(!q.package) {
		return meta();
	}

	// wildcard search: a glob in the package/function name, a version spec matching more than one release (a range or
	// a date bound), or a parameter filter (which narrows a set of functions and so always goes through the search path)
	if(hasGlob(q.package) || (q.function !== undefined && hasGlob(q.function)) || (q.version !== undefined && (isMultiVersion(q.version) || isDateBound(q.version))) || hasParameterFilter(q)) {
		const found = searchSources(sources, packages, q);
		// a version glob against a single concrete, known package that matched no release: point at the available versions
		// (the same guidance the exact-version path gives) instead of a bare "0 matched"
		if((found.matchCount === 0 || found.packages?.length === 0) && !hasGlob(q.package) && q.version !== undefined) {
			const owning = sources.filter(s => s.has(q.package as string));
			if(owning.length > 0) {
				const avail = allAvailableVersions(owning, q.package);
				return { ...meta(), message: versionNotFoundMessage(q.package, `no release of '${q.package}' matches '${q.version}'.`, avail, owning[0].isBaseR(q.package)) };
			}
		}
		return { ...meta(), ...found };
	}

	// every source holding the package: `current` keeps the latest, `history` the older releases, so the resolved
	// version must be looked up in whichever source actually has it (not just the first one found)
	const owning = sources.filter(s => s.has(q.package as string));
	if(owning.length === 0) {
		return { ...meta(), message: `The signature database does not know the package '${q.package}'.`, suggestions: suggest(packages, q.package) };
	}
	// the version to resolve against: an explicit `@version`, else the version flowR inferred for the script's
	// dependency (which may be an older release that only `history` carries)
	const version = q.version ?? deps.getDependency(q.package)?.resolvedVersion;
	const src = sourceForVersion(owning, q.package, version);
	if(q.version !== undefined && src === undefined) {
		const avail = allAvailableVersions(owning, q.package);
		return { ...meta(), message: versionNotFoundMessage(q.package, `'${q.package}@${q.version}' is not in the loaded database.`, avail, owning[0].isBaseR(q.package)) };
	}
	const resolvedSrc = src ?? owning[0];
	if(q.function) {
		const fn = signatureFunctionInfo(resolvedSrc, q.package, q.function, version);
		if(fn) {
			return { ...meta(), function: fn };
		}
		const exports = resolvedSrc.lookup(q.package, version) ?? resolvedSrc.lookup(q.package);
		const universe = new Set<string>([
			...(exports?.exported ?? []),
			...(resolvedSrc.functions(q.package, version) ?? resolvedSrc.functions(q.package) ?? []).map(f => f.name)
		]);
		return {
			...meta(),
			package:     signaturePackageInfo(resolvedSrc, q.package, version),
			message:     `'${q.package}' does not define '${q.function}'.`,
			suggestions: suggest(universe, q.function)
		};
	}
	return { ...meta(), package: signaturePackageInfo(resolvedSrc, q.package, version) };
}
