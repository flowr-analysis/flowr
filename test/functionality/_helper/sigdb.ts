import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrConfig } from '../../../src/config';
import type { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { SigDatabase, type PackageSignatureSource } from '../../../src/project/sigdb/reader';
import { SigDbBuilder, writeSignatureDb } from '../../../src/project/sigdb/build';
import { isBaseRPackage } from '../../../src/util/r-base-packages';
import { SigDbExt, FnProp, type SigDb, type SigVersionInfo } from '../../../src/project/sigdb/schema';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../src/dataflow/info';
import type { DecodedFunction } from '../../../src/project/sigdb/decode';
import { Package } from '../../../src/project/plugins/package-version-plugins/package';
import { FlowrNamespaceFile, setCallable } from '../../../src/project/plugins/file-plugins/files/flowr-namespace-file';
import { FlowrInlineTextFile } from '../../../src/project/context/flowr-file';

const pendingTmpDirs: string[] = [];

/** a fresh temp dir, tracked for removal by {@link cleanupSigTmpDirs} (register it via `afterEach`) */
export function sigTmpDir(prefix = 'sigdb-'): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	pendingTmpDirs.push(dir);
	return dir;
}

/** remove every temp dir handed out by {@link sigTmpDir} since the last call (also on test failure) */
export function cleanupSigTmpDirs(): void {
	for(const dir of pendingTmpDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

/** write a built database into `dir` and open it back, for the tests that exercise the on-disk format itself */
export async function writeAndOpen(dir: string, db: SigDb, name = 'db'): Promise<SigDatabase> {
	await writeSignatureDb(path.join(dir, name), db);
	return SigDatabase.open(path.join(dir, `${name}${SigDbExt}`));
}

/** an analyzer with our sigdb as the sole (deterministic) version resolver */
export async function sigdbAnalyzer(ts: TreeSitterExecutor, db: PackageSignatureSource, config?: FlowrConfig): Promise<FlowrAnalyzer> {
	let builder = new FlowrAnalyzerBuilder().setParser(ts);
	if(config) {
		builder = builder.setConfig(config);
	}
	return builder.unregisterPlugins(SigDbPluginName).registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(db)).build();
}

/** an exported, side-effect-free function record */
export const expFn = (name: string) => ({ name, props: FnProp.Exported, params: [], callees: [], line: 1 });

/** a CRAN version carrying the given functions */
export const ver = (functions: SigVersionInfo['functions'], cran = true): SigVersionInfo => ({ cran, functions });

/** an in-memory database with one version of each package, R's own packages as core ones: `fakeSigDb({ base: [expFn('paste')] })` */
export function fakeSigDb(packages: Readonly<Record<string, SigVersionInfo['functions']>>): SigDatabase {
	const b = new SigDbBuilder();
	for(const [name, functions] of Object.entries(packages)) {
		const latest = isBaseRPackage(name) ? '4.5.0' : '1.0.0';
		b.addPackage(name, { latest, core: isBaseRPackage(name), downloads: 5 });
		b.addVersion(name, latest, ver(functions));
	}
	return SigDatabase.fromMemory(b.build({ date: '2026-05-23', generated: 0 }));
}

/** whether the export `pkg::fn`'s built-in vertex is present in the graph (i.e. `library()` attached it) */
export function hasBuiltInVertex(df: Pick<DataflowInformation, 'graph'>, pkg: string, fn: string): boolean {
	const target = String(NodeId.fromPkgFn(pkg, fn));
	return df.graph.vertices(true).some(([id]) => String(id) === target);
}

/** an in-memory signature source knowing version `1.0.0` of the one package `pkg`, defining the given functions (a `deprecated` prop marks one deprecated) */
export function singlePackageSigDb(pkg: string, functions: readonly DecodedFunction[]): PackageSignatureSource {
	const byName = new Map(functions.map(f => [f.name, f]));
	const exported = functions.filter(f => f.exported).map(f => f.name);
	const internal = functions.filter(f => !f.exported).map(f => f.name);
	const deprecated = functions.filter(f => f.props.includes('deprecated')).map(f => f.name);
	const view = { version: '1.0.0', exported, internal, deprecated, s3Classes: [], s4Classes: [], cran: true };
	return {
		has:               p => p === pkg,
		hasVersion:        (p, version) => p === pkg && version === '1.0.0',
		isCranVersion:     () => true,
		sourceOf:          () => undefined,
		lookup:            p => p === pkg ? view : undefined,
		classOwner:        () => undefined,
		packagesExporting: name => exported.includes(name) ? [pkg] : [],
		functions:         p => p === pkg ? [...functions] : undefined,
		functionByName:    (p, name) => p === pkg ? byName.get(name) : undefined,
		transitiveCallees: () => undefined,
		classes:           () => undefined,
		dependencies:      () => undefined,
		packageNames:      () => [pkg],
		isBaseR:           () => false,
		downloads:         () => 0,
		coreVersions:      () => undefined,
		releaseDate:       () => undefined,
		releaseDates:      () => [],
		latestVersion:     () => undefined,
		close:             () => { /* nothing to release */ }
	};
}

/** what the trimmed-down ggplot2 {@link Ggplot2Namespace} exports */
export const Ggplot2Callable: readonly string[] = ['+', 'ggplot', 'aes', 'geom_point', 'geom_line', 'theme_bw', 'coord_cartesian', 'ggsave', 'fortify', 'scale_type'];

/** a trimmed-down NAMESPACE file of ggplot2 */
export const Ggplot2Namespace = `S3method(fortify,data.frame)
S3method(fortify,lm)
S3method(fortify,default)
S3method(fortify,map)
S3method(scale_type,Date)
S3method(scale_type,POSIXt)
S3method(scale_type,character)
S3method(scale_type,numeric)
S3method(scale_type,factor)
S3method(scale_type,default)
S3method(ggplot,default)
S3method(print,ggproto)
S3method(print,rel)
export("+")
export(ggplot)
export(aes)
export(geom_point)
export(geom_line)
export(theme_bw)
export(coord_cartesian)
export(ggsave)
export(fortify)
export(scale_type)
exportPattern("^[^\\\\.]\\\\.*$")
import(grid)
import(rlang)
importFrom(scales,alpha)
importFrom(stats,setNames)`;

/** a package whose NAMESPACE file reads `namespace`, which exports `callable` when given */
export function namespacePackage(name: string, namespace: string, callable?: readonly string[]): Package {
	const info = FlowrNamespaceFile.from(new FlowrInlineTextFile('NAMESPACE', namespace)).content().current;
	return new Package({ name, namespaceInfo: callable === undefined ? info : setCallable(info, [...callable]) });
}

/** ggplot2 as {@link Ggplot2Namespace} states it, with `extra` lines added to its NAMESPACE file */
export function ggplot2Package(extra = ''): Package {
	return namespacePackage('ggplot2', Ggplot2Namespace + extra, Ggplot2Callable);
}

/** makes the packages dependencies of the analyzer */
export function addPackages(analyzer: FlowrAnalyzer, ...packages: readonly Package[]): void {
	for(const pkg of packages) {
		analyzer.context().deps.addDependency(pkg);
	}
}
