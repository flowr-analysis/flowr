import zlib from 'zlib';
import type { BrandedNamespace } from '../../../dataflow/environments/identifier';

/**
 * Where an on-demand signature source looks for the source of a package no database knows: CRAN, Bioconductor,
 * and GitHub repositories, each as an {@link OnDemandSource}. A plugin may hand in sources of its own (an
 * r-universe, a company mirror) next to these.
 */

/** A package to recover, with what the analyzed project says about where it comes from. */
export interface PackageRequest {
	readonly name:     string;
	/** the version the project pins, if any */
	readonly version?: string;
	/** the GitHub repository the project installs it from, `owner/repo[/subdir][@ref]` */
	readonly github?:  string;
}

/** One archive that may hold the package source. */
export interface PackageArchive {
	/** a `.tar.gz` (or plain `.tar`) of the package source */
	readonly url:       string;
	/** what the recovered package says it came from, like `cran` or `github:masurp/ggmirt` */
	readonly origin:    string;
	/** the directory of the package within the archive, for a repository holding more than the package */
	readonly subdir?:   string;
	/**
	 * only worth a try once no source has the package for sure: a mirror of every package that ever was on CRAN
	 * also holds the ancient copy of one that moved to Bioconductor (`limma`)
	 */
	readonly fallback?: true;
}

/** Downloads `url`, `undefined` if the server does not have it. Throws on every other failure. */
export type FetchBytes = (url: string, maxBytes: number) => Promise<Buffer | undefined>;

/** A place to look for package sources. */
export interface OnDemandSource {
	/** the name the configuration lists it under (`solver.sigdb.onDemand.sources`) */
	readonly name: string;
	/** the archives that may hold the package, most likely first, none if this source cannot have it */
	archives(request: PackageRequest, fetch: FetchBytes): Promise<readonly PackageArchive[]>;
}

/** what a source may be configured with, see `solver.sigdb.onDemand` */
export interface OnDemandSourceOptions {
	/** the CRAN `src/contrib/` to fetch tarballs from */
	readonly cranMirror?:          string;
	/** the Bioconductor host */
	readonly bioconductorMirror?:  string;
	/** the Bioconductor release (`release`, `devel`, or a number like `3.20`) */
	readonly bioconductorRelease?: string;
	/** whether to use the read-only GitHub mirrors of CRAN (`cran/<pkg>`) and Bioconductor (`bioc/<pkg>`), which keep every version as a tag */
	readonly githubMirrors?:       boolean;
}

const GitHubArchive = (owner: string, repo: string, ref: string) =>
	`https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tar.gz/${ref.split('/').map(encodeURIComponent).join('/')}`;

/** A GitHub remote as `remotes`/`pak` write it: `owner/repo`, optionally `/subdir`, `@ref`, `#pr`, or a `github::` prefix. */
export function parseGitHubRemote(remote: string): { owner: string, repo: string, subdir?: string, ref?: string } | undefined {
	const match = /^(?:github::)?([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)((?:\/[A-Za-z0-9._-]+)*)(?:@([A-Za-z0-9._/-]+)|#(\d+))?$/.exec(remote.trim());
	/* no step may leave the repository (`..`) or name a hidden file */
	if(match === null || [match[2], ...(match[3] ?? '').split('/'), ...(match[4] ?? '').split('/')].some(p => p === '..' || p === '.' || p.startsWith('.') && p.length > 0)) {
		return undefined;
	}
	const [, owner, repo, subdir, ref, pr] = match;
	return {
		owner,
		repo:   repo.replace(/\.git$/, ''),
		subdir: subdir ? subdir.slice(1) : undefined,
		ref:    pr ? `refs/pull/${pr}/head` : ref
	};
}

/** A package name R accepts, which is all that may go into a URL built from one. */
export function isPackageName(name: BrandedNamespace): boolean {
	return /^[A-Za-z][A-Za-z0-9.]*[A-Za-z0-9]$/.test(name);
}

/** a version as it may go into a URL */
function isVersion(version: string | undefined): version is string {
	return version !== undefined && /^[0-9][0-9.-]*$/.test(version);
}

/** The repository a project names for the package, or nothing. */
export const GitHubSource: OnDemandSource = {
	name: 'github',
	archives(request) {
		const remote = request.github === undefined ? undefined : parseGitHubRemote(request.github);
		if(remote === undefined) {
			return Promise.resolve([]);
		}
		return Promise.resolve([{ url: GitHubArchive(remote.owner, remote.repo, remote.ref ?? 'HEAD'), origin: `github:${remote.owner}/${remote.repo}`, subdir: remote.subdir }]);
	}
};

/** the `PACKAGES` index at `url` (fetched once), empty if it cannot be had */
function packagesIndex(url: string, fetch: FetchBytes, cache: Map<string, Promise<Map<string, string>>>): Promise<Map<string, string>> {
	let index = cache.get(url);
	if(index === undefined) {
		index = fetch(url, 64 * 1024 * 1024)
			.then(b => b === undefined ? new Map<string, string>() : parsePackagesIndex((b[0] === 0x1f && b[1] === 0x8b ? zlib.gunzipSync(b) : b).toString('utf8')))
			.catch(() => new Map<string, string>());
		cache.set(url, index);
	}
	return index;
}

/**
 * CRAN: a pinned version from the GitHub mirror or CRAN itself (current or archived), else the current version
 * the CRAN index lists. A package CRAN no longer lists is a {@link PackageArchive#fallback} from the mirror.
 */
export function cranSource(options: OnDemandSourceOptions = {}): OnDemandSource {
	const mirror = (options.cranMirror ?? 'https://cloud.r-project.org/src/contrib/').replace(/\/?$/, '/');
	const github = options.githubMirrors !== false;
	const indices = new Map<string, Promise<Map<string, string>>>();
	const ofVersion = (name: string, version: string): PackageArchive[] => {
		const file = `${name}_${version}.tar.gz`;
		return [
			...github ? [{ url: GitHubArchive('cran', name, `refs/tags/${version}`), origin: 'cran' }] : [],
			{ url: `${mirror}${file}`, origin: 'cran' },
			{ url: `${mirror}Archive/${name}/${file}`, origin: 'cran' }
		];
	};
	return {
		name: 'cran',
		async archives({ name, version }, fetch) {
			if(isVersion(version)) {
				return ofVersion(name, version);
			}
			const current = (await packagesIndex(`${mirror}PACKAGES.gz`, fetch, indices)).get(name);
			if(current !== undefined && isVersion(current)) {
				return ofVersion(name, current);
			}
			return github ? [{ url: GitHubArchive('cran', name, 'HEAD'), origin: 'cran', fallback: true }] : [];
		}
	};
}

/** the Bioconductor repositories a package may live in */
const BioconductorRepositories = ['bioc', 'data/annotation', 'data/experiment', 'workflows', 'books'];

/** the `Package`/`Version` pairs of a `PACKAGES` index */
export function parsePackagesIndex(index: string): Map<string, string> {
	const versions = new Map<string, string>();
	for(const entry of index.split(/\r?\n\s*\r?\n/)) {
		const pkg = /^Package:\s*(\S+)/m.exec(entry)?.[1];
		const version = /^Version:\s*(\S+)/m.exec(entry)?.[1];
		if(pkg !== undefined && version !== undefined) {
			versions.set(pkg, version);
		}
	}
	return versions;
}

/**
 * Bioconductor: the release tarball the repository index lists, else the GitHub mirror. A Bioconductor release
 * only keeps its current version of a package, so an older pinned one falls back to the mirror's newest.
 */
export function bioconductorSource(options: OnDemandSourceOptions = {}): OnDemandSource {
	const host = (options.bioconductorMirror ?? 'https://bioconductor.org').replace(/\/$/, '');
	const release = options.bioconductorRelease ?? 'release';
	const indices = new Map<string, Promise<Map<string, string>>>();
	return {
		name: 'bioconductor',
		async archives({ name }, fetch) {
			for(const repo of BioconductorRepositories) {
				const version = (await packagesIndex(`${host}/packages/${release}/${repo}/src/contrib/PACKAGES`, fetch, indices)).get(name);
				if(version !== undefined && isVersion(version)) {
					return [
						{ url: `${host}/packages/${release}/${repo}/src/contrib/${name}_${version}.tar.gz`, origin: 'bioconductor' },
						...options.githubMirrors !== false ? [{ url: GitHubArchive('bioc', name, 'HEAD'), origin: 'bioconductor' }] : []
					];
				}
			}
			return options.githubMirrors !== false ? [{ url: GitHubArchive('bioc', name, 'HEAD'), origin: 'bioconductor', fallback: true }] : [];
		}
	};
}

/** The sources flowR knows by name, configured with `options`. */
export function builtInOnDemandSources(options: OnDemandSourceOptions = {}): ReadonlyMap<string, OnDemandSource> {
	return new Map([GitHubSource, cranSource(options), bioconductorSource(options)].map(s => [s.name, s]));
}
