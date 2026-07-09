import path from 'path';
import type { FlowrConfig } from '../../../config';
import { FlowrAnalyzerBuilder } from '../../flowr-analyzer-builder';
import { FileRole } from '../../context/flowr-file';
import type { ReadOnlyFlowrAnalyzerFilesContext } from '../../context/flowr-analyzer-files-context';
import type { FlowrNamespaceFile } from '../file-plugins/files/flowr-namespace-file';
import { PkgDbBuilder, type PkgDb } from './pkgdb';
import { fileProtocol } from '../../../r-bridge/retriever';
import { pkgDbLog } from './flowr-analyzer-package-versions-pkgdb-plugin';

/** name, version, and exported identifiers extracted from a locally installed R package. */
export interface InstalledPackageInfo {
	name:     string;
	version:  string;
	exported: string[];
}

/**
 * The exported identifiers of a parsed `NAMESPACE` (real exports plus S3 methods as `generic.class`).
 * Pattern-based exports (`exportPattern`) are not expanded, as that requires the actual object list.
 */
function namespaceExports(ns: FlowrNamespaceFile | undefined): string[] {
	if(ns === undefined) {
		return [];
	}
	try {
		const info = ns.content().current;
		const s3 = Array.from(info.exportS3Generics).flatMap(([generic, methods]) => methods.map(m => `${generic}.${m}`));
		return Array.from(new Set([...info.exportedSymbols, ...info.exportedFunctions, ...s3]));
	} catch(e) {
		pkgDbLog.warn(`could not read NAMESPACE exports from ${ns.path()}: ${(e as Error).message}`);
		return [];
	}
}

/**
 * Reads the {@link InstalledPackageInfo} of every locally installed R package below `dir` (a single installed
 * package or a whole library folder) by spawning a fresh flowR analyzer and inspecting its file context: each
 * discovered `DESCRIPTION` yields a package's name and version, and its sibling `NAMESPACE` the exports.
 *
 * The extraction is defensive: a package that cannot be read is skipped (not fatal), and an empty list is
 * returned if `dir` cannot be analyzed at all.
 * @param config - the configuration for the spawned analyzer (typically the caller's own config)
 * @param dir    - the installed package directory or library folder to read
 */
export async function readInstalledPackages(config: FlowrConfig, dir: string): Promise<InstalledPackageInfo[]> {
	const analyzer = await new FlowrAnalyzerBuilder().setConfig(config).build().catch(e => {
		pkgDbLog.warn(`could not spawn an analyzer for ${dir}: ${(e as Error).message}`);
		return undefined;
	});
	if(analyzer === undefined) {
		return [];
	}
	try {
		analyzer.addRequest(fileProtocol + dir);
		return extractInstalledPackages(analyzer.inspectContext().files);
	} catch(e) {
		pkgDbLog.warn(`could not analyze ${dir}: ${(e as Error).message}`);
		return [];
	} finally {
		analyzer.close();
	}
}

function extractInstalledPackages(files: ReadOnlyFlowrAnalyzerFilesContext): InstalledPackageInfo[] {
	// index the discovered NAMESPACE files by their directory so each DESCRIPTION can find its sibling in O(1)
	const namespaceByDir = new Map(files.getFilesByRole(FileRole.Namespace).map(ns => [path.dirname(ns.path()), ns]));
	const packages: InstalledPackageInfo[] = [];
	for(const desc of files.getFilesByRole(FileRole.Description)) {
		try {
			const name = desc.packageName();
			if(name === undefined) {
				continue;
			}
			packages.push({
				name,
				version:  desc.version()?.str ?? desc.content().get('Version')?.[0] ?? '0.0.0',
				exported: namespaceExports(namespaceByDir.get(path.dirname(desc.path())))
			});
		} catch(e) {
			pkgDbLog.warn(`could not read the package at ${desc.path()}: ${(e as Error).message}`);
		}
	}
	return packages;
}

/**
 * Builds a `latest`-scope {@link PkgDb} from a single locally installed R package or a whole library folder.
 * The result can be handed to flowR via `$FLOWR_PKGDB`. See {@link readInstalledPackages} for the extraction.
 */
export async function buildPkgDbFromInstalled(config: FlowrConfig, dir: string, meta: { date: string, generated: number }): Promise<{ db: PkgDb, added: string[] }> {
	const builder = new PkgDbBuilder();
	const added: string[] = [];
	for(const info of await readInstalledPackages(config, dir)) {
		builder.addPackage(info.name, { latest: info.version, downloads: 1 });
		builder.addVersion(info.name, info.version, { exported: info.exported, internal: [], deprecated: [], cran: false });
		added.push(info.name);
	}
	return { db: builder.build('latest', { version: 1, date: meta.date, generated: meta.generated }), added };
}
