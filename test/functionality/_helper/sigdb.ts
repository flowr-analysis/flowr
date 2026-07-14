import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrConfig } from '../../../src/config';
import type { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { SigDatabase, type PackageSignatureSource } from '../../../src/project/sigdb/reader';
import { writeSignatureDb } from '../../../src/project/sigdb/build';
import { SigDbExt, FnProp, type SigDb, type SigVersionInfo } from '../../../src/project/sigdb/schema';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowInformation } from '../../../src/dataflow/info';

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

/** write a built database into `dir` and open it back as a real {@link SigDatabase} */
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
export const ver = (functions: SigVersionInfo['functions']): SigVersionInfo => ({ cran: true, functions });

/** whether the export `pkg::fn`'s built-in vertex is present in the graph (i.e. `library()` attached it) */
export function hasBuiltInVertex(df: Pick<DataflowInformation, 'graph'>, pkg: string, fn: string): boolean {
	const target = String(NodeId.fromPkgFn(pkg, fn));
	return df.graph.vertices(true).some(([id]) => String(id) === target);
}
