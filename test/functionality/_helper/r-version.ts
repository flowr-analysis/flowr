import semver from 'semver/preload';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { minRVersionOf } from '../../../src/r-bridge/lang-4.x/ast/model/syntax-version';

let sharedParser: TreeSitterExecutor | undefined;

/** The R version the syntax of `code` needs, see {@link minRVersionOf}; tree-sitter reads it on any host. */
export async function minRVersionOfCode(code: string): Promise<string | undefined> {
	/* one parser for all calls, as every parser holds on to memory of the tree-sitter module until it is closed */
	sharedParser ??= new TreeSitterExecutor();
	const analyzer = await new FlowrAnalyzerBuilder().setParser(sharedParser).build();
	analyzer.addRequest(code);
	return minRVersionOf((await analyzer.normalize()).ast.files.map(f => f.root))?.version;
}

/** Whether the R running the tests is at least `version`, which `undefined` every R is. */
export function rIsAtLeast(version: string | undefined): boolean {
	return version === undefined || (!!globalThis.rVersion && semver.gte(globalThis.rVersion, version));
}

/** Whether the R running the tests reads the syntax of `code`, like the native pipe only from R 4.1 on. */
export async function rReadsSyntaxOf(code: string): Promise<boolean> {
	return rIsAtLeast(await minRVersionOfCode(code));
}
