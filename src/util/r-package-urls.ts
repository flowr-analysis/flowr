/**
 * Where a package, its sources and its manual pages live on the web. Kept in one place because both the
 * signature query and the pages generated from the database link to the very same mirrors.
 * @module
 */

import type { BrandedIdentifier, BrandedNamespace } from '../dataflow/environments/identifier';

/** read-only GitHub mirror of R's own SVN; base packages live under `src/library/<pkg>` */
const RSourceMirror = 'https://github.com/wch/r-source';

/** read-only CRAN GitHub mirror base; `github.com/cran/<pkg>` mirrors every CRAN package and tags each release */
const CranGithubMirror = 'https://github.com/cran';

/** the fragment linking to `line`, empty for a link to the file as a whole */
function atLine(line: number | undefined): string {
	return line !== undefined && line >= 0 ? `#L${line}` : '';
}

/** the CRAN package landing page (only meaningful for CRAN packages, not base R) */
export function cranPageUrl(pkg: BrandedNamespace): string {
	return `https://cran.r-project.org/package=${encodeURIComponent(pkg)}`;
}

/** the mirror repository of a CRAN package */
export function cranMirrorRepoUrl(pkg: BrandedNamespace): string {
	return `${CranGithubMirror}/${encodeURIComponent(pkg)}`;
}

/** deep-link a definition into the CRAN mirror at the package's version tag (falling back to `HEAD`) */
export function cranMirrorSourceUrl(pkg: BrandedNamespace, version: string | undefined, file?: string, line?: number): string {
	const ref = version ? encodeURIComponent(version) : 'HEAD';
	return file ? `${cranMirrorRepoUrl(pkg)}/blob/${ref}/${file}${atLine(line)}` : `${cranMirrorRepoUrl(pkg)}/tree/${ref}`;
}

/**
 * The mirror ref holding an R version: the mirror carries no tags, only a `R-<major>-<minor>-branch` per release
 * series (exact to the minor release, latest patch); `trunk` stands in when the version is unknown.
 */
export function rSourceRef(version: string | undefined): string {
	const series = /^(\d+)\.(\d+)/.exec(version ?? '');
	return series ? `R-${series[1]}-${series[2]}-branch` : 'trunk';
}

/** deep-link a base-R definition into the R sources mirror at the release series of `version` */
export function rSourceUrl(pkg: BrandedNamespace, version: string | undefined, file?: string, line?: number): string {
	const root = `${RSourceMirror}/${file ? 'blob' : 'tree'}/${rSourceRef(version)}/src/library/${encodeURIComponent(pkg)}`;
	return file ? `${root}/${file}${atLine(line)}` : `${root}/R`;
}

/** base R's own index of what a package documents, which rdrr.io has no page for */
export function baseManualIndexUrl(pkg: BrandedNamespace): string {
	return `https://stat.ethz.ch/R-manual/R-devel/library/${encodeURIComponent(pkg)}/html/00Index.html`;
}

/** R's own manual page for a topic of a base package */
export function baseManualTopicUrl(pkg: BrandedNamespace, topic: BrandedIdentifier): string {
	return `https://stat.ethz.ch/R-manual/R-devel/library/${encodeURIComponent(pkg)}/html/${encodeURIComponent(topic)}.html`;
}

/** where rdrr.io lists what a CRAN package documents */
export function rdrrPackageUrl(pkg: BrandedNamespace): string {
	return `https://rdrr.io/cran/${encodeURIComponent(pkg)}/`;
}

/** rdrr.io's manual page for a topic of a CRAN package */
export function rdrrTopicUrl(pkg: BrandedNamespace, topic: BrandedIdentifier): string {
	return `https://rdrr.io/cran/${encodeURIComponent(pkg)}/man/${encodeURIComponent(topic)}.html`;
}

/** a repository a package may come from */
export interface RRepository {
	readonly label: string;
	readonly home:  (pkg: BrandedNamespace) => string | undefined;
}

/** the repositories the database records, keyed by the lowercase name it states */
export const RRepositories: Record<string, RRepository> = {
	'cran':         { label: 'CRAN',          home: cranPageUrl },
	'bioc':         { label: 'Bioconductor',  home: pkg => `https://bioconductor.org/packages/${encodeURIComponent(pkg)}` },
	'bioconductor': { label: 'Bioconductor',  home: pkg => `https://bioconductor.org/packages/${encodeURIComponent(pkg)}` },
	'github':       { label: 'GitHub',        home: pkg => `https://github.com/search?q=${encodeURIComponent(pkg)}+language%3AR&type=repositories` },
	'r-universe':   { label: 'R-universe',    home: pkg => `https://r-universe.dev/search?q=${encodeURIComponent(pkg)}` },
	'runiverse':    { label: 'R-universe',    home: pkg => `https://r-universe.dev/search?q=${encodeURIComponent(pkg)}` },
	'omegahat':     { label: 'Omegahat',      home: pkg => `https://www.omegahat.net/${encodeURIComponent(pkg)}/` },
	'rforge':       { label: 'R-Forge',       home: pkg => `https://r-forge.r-project.org/projects/${encodeURIComponent(pkg)}/` }
};

/** where to find a file of a package's sources, see {@link packageSourceUrl} */
export interface SourcePlace {
	readonly version?: string
	/** the repository the version came from, as the database names it (`cran`, `bioc`, `runiverse:r-lib`, or a git url) */
	readonly source?:  string
	/** a package R ships, whose sources are R's own */
	readonly base?:    boolean
	readonly file?:    string
	readonly line?:    number
	readonly endLine?: number
}

/** the fragment linking to the lines, `#L3` or `#L3-L9`, empty without a line */
function atLines(line: number | undefined, endLine: number | undefined): string {
	return line === undefined || line < 0 ? '' : endLine !== undefined && endLine > line ? `#L${line}-L${endLine}` : `#L${line}`;
}

/** the web address of a git repository, `undefined` for anything that is none (`git@github.com:o/r.git` becomes `https://github.com/o/r`) */
export function gitWebUrl(source: string): string | undefined {
	const ssh = /^git@([^:]+):(.+?)(?:\.git)?\/?$/.exec(source);
	if(ssh !== null) {
		return `https://${ssh[1]}/${ssh[2]}`;
	}
	const https = /^(?:git\+)?https?:\/\/((?:github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)\/[^/]+\/[^/#?]+?)(?:\.git)?\/?$/.exec(source);
	return https === null ? undefined : `https://${https[1]}`;
}

/**
 * Where a file of a package's sources is online, at its lines: R's sources for a base package, CRAN's mirror at the
 * version tag, the package's git repository at `HEAD` (repositories tag releases in no common way), an R-universe's repository, or
 * Bioconductor's git browser; the repository's page when the file cannot be pointed at.
 */
export function packageSourceUrl(pkg: BrandedNamespace, { version, source, base, file, line, endLine }: SourcePlace): string | undefined {
	const lines = atLines(line, endLine);
	if(base === true) {
		return file === undefined ? rSourceUrl(pkg, version) : rSourceUrl(pkg, version, file) + lines;
	}
	const kind = (source ?? 'cran').toLowerCase();
	if(kind === 'cran') {
		return file === undefined ? cranMirrorSourceUrl(pkg, version) : cranMirrorSourceUrl(pkg, version, file) + lines;
	}
	const git = source === undefined ? undefined : gitWebUrl(source);
	const universe = /^r-?universe:([\w.-]+)$/.exec(kind)?.[1];
	const repo = git ?? (universe === undefined ? undefined : `https://github.com/${universe}/${encodeURIComponent(pkg)}`);
	if(repo !== undefined) {
		const blob = repo.includes('gitlab.com') ? '/-/blob' : '/blob';
		return file === undefined ? repo : `${repo}${blob}/HEAD/${file}${lines}`;
	}
	if(kind === 'bioc' || kind === 'bioconductor') {
		return file === undefined ? RRepositories['bioc'].home(pkg) : `https://code.bioconductor.org/browse/${encodeURIComponent(pkg)}/blob/devel/${file}${lines}`;
	}
	return RRepositories[kind]?.home(pkg);
}
