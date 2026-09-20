/**
 * Where a package, its sources and its manual pages live on the web. Kept in one place because both the
 * signature query and the pages generated from the database link to the very same mirrors.
 * @module
 */

/** read-only GitHub mirror of R's own SVN; base packages live under `src/library/<pkg>` */
const RSourceMirror = 'https://github.com/wch/r-source';

/** read-only CRAN GitHub mirror base; `github.com/cran/<pkg>` mirrors every CRAN package and tags each release */
const CranGithubMirror = 'https://github.com/cran';

/** the fragment linking to `line`, empty for a link to the file as a whole */
function atLine(line: number | undefined): string {
	return line !== undefined && line >= 0 ? `#L${line}` : '';
}

/** the CRAN package landing page (only meaningful for CRAN packages, not base R) */
export function cranPageUrl(pkg: string): string {
	return `https://cran.r-project.org/package=${encodeURIComponent(pkg)}`;
}

/** the mirror repository of a CRAN package */
export function cranMirrorRepoUrl(pkg: string): string {
	return `${CranGithubMirror}/${encodeURIComponent(pkg)}`;
}

/** deep-link a definition into the CRAN mirror at the package's version tag (falling back to `HEAD`) */
export function cranMirrorSourceUrl(pkg: string, version: string | undefined, file?: string, line?: number): string {
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
export function rSourceUrl(pkg: string, version: string | undefined, file?: string, line?: number): string {
	const root = `${RSourceMirror}/${file ? 'blob' : 'tree'}/${rSourceRef(version)}/src/library/${encodeURIComponent(pkg)}`;
	return file ? `${root}/${file}${atLine(line)}` : `${root}/R`;
}

/** base R's own index of what a package documents, which rdrr.io has no page for */
export function baseManualIndexUrl(pkg: string): string {
	return `https://stat.ethz.ch/R-manual/R-devel/library/${encodeURIComponent(pkg)}/html/00Index.html`;
}

/** R's own manual page for a topic of a base package */
export function baseManualTopicUrl(pkg: string, topic: string): string {
	return `https://stat.ethz.ch/R-manual/R-devel/library/${encodeURIComponent(pkg)}/html/${encodeURIComponent(topic)}.html`;
}

/** where rdrr.io lists what a CRAN package documents */
export function rdrrPackageUrl(pkg: string): string {
	return `https://rdrr.io/cran/${encodeURIComponent(pkg)}/`;
}

/** rdrr.io's manual page for a topic of a CRAN package */
export function rdrrTopicUrl(pkg: string, topic: string): string {
	return `https://rdrr.io/cran/${encodeURIComponent(pkg)}/man/${encodeURIComponent(topic)}.html`;
}

/** a repository a package may come from */
export interface RRepository {
	readonly label: string;
	readonly home:  (pkg: string) => string | undefined;
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
