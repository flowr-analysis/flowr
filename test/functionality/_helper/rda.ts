import { rPath } from './r-path';
import type { RShellExecutor } from '../../../src/r-bridge/shell-executor';
import fs from 'fs';
import path from 'path';

const RealWorldRdaDir = 'test/functionality/project/plugin/load-pipeline/zenodo/files';
export const MissingRealWorldRda = `no .rda/.rdata fixture in ${RealWorldRdaDir}: run test/functionality/project/plugin/load-pipeline/setup.sh with a zenodo/zenodo_files.csv (see that folder's README.md) to download it`;
/** every real-world `.rda`/`.rdata` fixture on disk, empty where the corpus was never downloaded */
export function realWorldRdaFiles(): string[] {
	return fs.existsSync(RealWorldRdaDir)
		? fs.readdirSync(RealWorldRdaDir).filter(f => /\.(rda|rdata)$/i.test(f)).map(f => path.join(RealWorldRdaDir, f))
		: [];
}

/**
 * Loads an RDA file in a fresh R environment and returns a map of variable names to their types.
 * @param file   - Path to the RDA file to load
 * @param rShell - The R shell executor to use for running the R code
 * @returns      A map from variable name to its R type string
 */
export function getVarsAndTypesFromShell(file: string, rShell: RShellExecutor) {
	const output = rShell.run(`
		e <- new.env()
		
		vars <- load("${rPath(file)}", envir = e)

		for(v in vars) {
			cat(v, "::", typeof(e[[v]]), "\\n")
		}
	`);

	const result = new Map<string, string>();

	for(const line of output.split('\n')) {
		const [name, type] = line.split('::').map(x => x.trim());

		if(name && type) {
			result.set(name, type);
		}
	}

	return result;
}

/* Maps the {@link SexpType} to its string representation in the R shell*/
export const SexpToRType = {
	0:  'NULL',
	1:  'symbol',
	2:  'pairlist',
	3:  'closure',
	4:  'environment',
	5:  'prom',
	6:  'language',
	7:  'special',
	8:  'builtin',
	9:  'character',
	10: 'logical',
	13: 'integer',
	14: 'double',
	15: 'complex',
	16: 'string',
	17: '...',
	19: 'list',
	20: 'expression',
	24: 'raw',
	25: 'S4',
} as const;
