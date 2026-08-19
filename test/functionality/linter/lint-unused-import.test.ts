import { describe } from 'vitest';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { withTreeSitter } from '../_helper/shell';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

/** the packages the tests resolve against; {@link controlledSigDb} reports every one of them as version `1.0.0` */
const sigDb = controlledSigDb({
	ggplot2: ['ggplot', 'aes', 'geom_point'],
	random1: ['test1', 'test3'],
	p:       ['f']
});

describe('flowR linter', withTreeSitter(parser => {
	describe('unused import', () => {
		assertLinter('Unused Import', parser, 'library(ggplot2)', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [1, 1, 1, 16],
				version:   ['ggplot2', '1.0.0']
			},
		], undefined, { sigDb });
		assertLinter('Used and unused imports', parser, 'library(p)\nlibrary(ggplot2)\nlibrary(random1)\nggplot()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [1, 1, 1, 10],
				version:   ['p', '1.0.0']
			},
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [3, 1, 3, 16],
				version:   ['random1', '1.0.0']
			},
		], undefined, { sigDb });
		assertLinter('Used and unused imports with require', parser, 'require(ggplot2)\nrequire(random1)\naes()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [2, 1, 2, 16],
				version:   ['random1', '1.0.0']
			},
		], undefined, { sigDb });
		assertLinter('Not in package database', parser, 'library(ggplot2)\nlibrary(random1)\nlibrary(notInDb)\naes()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [2, 1, 2, 16],
				version:   ['random1', '1.0.0']
			}
		], undefined, { sigDb });
		assertLinter('Whitelisted package', parser, 'require(p)\nrequire(ggplot2)\nrequire(random1)\naes()', 'unused-import', [
			{
				certainty: LintingResultCertainty.Uncertain,
				loc:       [1, 1, 1, 10],
				version:   ['p', '1.0.0']
			},
		], undefined, { sigDb, whitelist: ['random1'] });
	});
}));
