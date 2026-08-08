import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrConfig } from '../../../config';
import { FlowrTextFile } from '../../context/flowr-file';
import { FlowrDescriptionFile } from '../file-plugins/files/flowr-description-file';
import { FlowrNamespaceFile } from '../file-plugins/files/flowr-namespace-file';
import { log } from '../../../util/log';
import fs from 'fs';
import path from 'path';

export const libraryLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-library-plugin' });

/** How the fallback searches for an installed package, see `solver.sigdb.installedLibrary`. */
export type InstalledLibraryOptions = NonNullable<FlowrConfig['solver']['sigdb']['installedLibrary']>;

/** the directories below `root` that may hold a library, stopping at an installed package (it holds none) */
function libraryDirs(root: string, depth: number): string[] {
	if(depth <= 0 || !fs.existsSync(root)) {
		return [];
	}
	return fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).flatMap(e => {
		const dir = path.join(root, e.name);
		return fs.existsSync(path.join(dir, 'DESCRIPTION')) ? [] : [dir, ...libraryDirs(dir, depth - 1)];
	});
}

/**
 * The library directories to search: the ones configured, or else the ones R's environment names (which
 * already are libraries) and a project-local `renv`/`packrat` one (which nests its library below a platform
 * and an R version).
 */
function libraryRoots(opts: InstalledLibraryOptions, projectRoot?: string): string[] {
	if(opts.paths?.length) {
		return opts.paths;
	}
	const fromEnv = opts.useEnvironment === false ? [] :
		[process.env.R_LIBS_USER, process.env.R_LIBS, process.env.R_LIBS_SITE].flatMap(v => v?.split(path.delimiter) ?? []);
	const local = opts.useProjectLibrary === false || projectRoot === undefined ? [] :
		['renv/library', 'renv/staging', 'packrat/lib'].map(d => path.join(projectRoot, d))
			.flatMap(d => [d, ...libraryDirs(d, opts.maxDepth ?? 3)]);
	return [...new Set([...fromEnv, ...local])].filter(d => d.length > 0);
}

/**
 * The package installed under `name` in one of `roots`, read from its own `DESCRIPTION` and `NAMESPACE`.
 * An installed package keeps both, so its exports are recoverable even when no signature database knows it.
 */
function installedPackage(name: string, roots: readonly string[]): Package | undefined {
	for(const root of roots) {
		const dir = path.join(root, name);
		const description = path.join(dir, 'DESCRIPTION');
		const namespace = path.join(dir, 'NAMESPACE');
		if(!fs.existsSync(description) || !fs.existsSync(namespace)) {
			continue;
		}
		try {
			const version = new FlowrDescriptionFile(new FlowrTextFile(description)).version();
			const namespaceInfo = FlowrNamespaceFile.from(new FlowrTextFile(namespace)).content().current;
			libraryLog.debug(`Recovered ${name}${version ? ` ${version.str}` : ''} from ${dir}`);
			return new Package({ name, resolvedVersion: version?.str, namespaceInfo });
		} catch(e) {
			libraryLog.warn(`Could not read the installed ${name} in ${dir}`, e);
		}
	}
	return undefined;
}

/**
 * Fills in packages no signature database knows from the copy installed on this machine: a package that CRAN
 * archived (`maptools`, `rgdal`, ...) is in no database, but if it is installed, its `NAMESPACE` states its
 * exports just as well. Off unless `solver.sigdb.installedLibrary.enabled` says otherwise, and consulted only
 * for a package nothing else could resolve, so it never overrides a database entry.
 */
export class FlowrAnalyzerPackageVersionsLibraryPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-library-plugin';
	public readonly description = 'Recovers the exports of packages no database knows from their installed copy.';
	public readonly version = new SemVer('0.1.0');

	private readonly overrides?: Partial<InstalledLibraryOptions>;

	/** @param overrides - options replacing what `solver.sigdb.installedLibrary` states, `enabled` included */
	constructor(overrides?: Partial<InstalledLibraryOptions>) {
		super();
		this.overrides = overrides;
	}

	public process(ctx: FlowrAnalyzerContext): void {
		const opts = { ...ctx.config.solver.sigdb.installedLibrary, ...this.overrides } as InstalledLibraryOptions;
		if(!opts.enabled) {
			return;
		}
		const only = opts.packages?.map(p => new RegExp(p)) ?? [];
		/* walking the library directories is only worth it once something actually goes unresolved */
		let roots: readonly string[] | undefined;
		ctx.deps.addLazyResolver((name, existing) => {
			if(existing?.namespaceInfo !== undefined || (only.length > 0 && !only.some(p => p.test(name)))) {
				return undefined;
			}
			roots ??= libraryRoots(opts, ctx.files.root());
			return installedPackage(name, roots);
		});
	}
}
