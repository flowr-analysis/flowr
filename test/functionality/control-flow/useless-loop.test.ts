import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { defaultConfigOptions } from '../../../src/config';
import { extractCfg } from '../../../src/control-flow/extract-cfg';
import { onlyLoopsOnce } from '../../../src/control-flow/useless-loop';
import type { SingleSlicingCriterion } from '../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../src/slicing/criterion/parse';


describe('One Iteration Loop Detection', withTreeSitter(shell => {
	function checkLoop(name: string, code: string, node: SingleSlicingCriterion, expectedLoopsOnlyOnce: boolean) {
		test(name, async() => {
			const result = await createDataflowPipeline(shell, { 
				request: requestFromInput(code.trim()) 
			}, defaultConfigOptions).allRemainingSteps();
			const cfg = extractCfg(result.normalize, defaultConfigOptions, result.dataflow.graph);

			const actual = onlyLoopsOnce(slicingCriterionToId(node, result.normalize.idMap), result.dataflow.graph, cfg, result.normalize, defaultConfigOptions);
			assert(actual === expectedLoopsOnlyOnce, `Expected to ${expectedLoopsOnlyOnce ? 'loop only once' : 'loop multiple times'}`);
		});
	}

	describe('Simple Cases', () => {
		checkLoop('for (i in c(1))', 'for(i in c(1)) { print(i) }',  '1@for',    true);	
		checkLoop('for (i in 1:1)',  'for(i in 1:1)  { print(i) }',  '1@for',    true);	

		checkLoop('Always Break',    'repeat { print(42); break; }', '1@repeat', true);
		
		// works after #1858 is merged
		// checkLoop('Simple For with Alias', 'x <- c(1); for(i in x) { print(i) }', '1@for', true);
	});


	describe('Stopped Loop', () => {
		const loopVariants = [/*'while (TRUE)',*/ 'repeat', 'for (i in 1:10)', 'for (i in c(1,2))'];
		const stopVariants = ['break', 'return(42)', 'stop(42)', 'stopifnot(FALSE)'];

		for(const loop of loopVariants) {
			for(const stop of stopVariants) {
				const code = `${loop} { print(42); ${stop} }`;
				checkLoop(code, code, `1@${loop.split(' ')[0]}`, true);
			}
		}
	});

	describe('Branches', () => {
		const loopVariants = ['while (TRUE)', 'repeat', 'for (i in 1:10)', 'for (i in c(1,2))'];
		const stopVariants = ['break', 'return(42)', 'stop(42)', 'stopifnot(FALSE)'];
		const branchVariants = ['if (TRUE) { %s }', 'if (u) { %s } else { %s }', 'if (FALSE) {} else { %s }'];


		for(const loop of loopVariants) {
			for(const stop of stopVariants) {
				for(const branch of branchVariants) {
					const code = `${loop} { print(42); ${branch.replaceAll('%s', stop)} }`;
					checkLoop(code, code, `1@${loop.split(' ')[0]}`, true);
				}
			}
		}
	});

	// Negative Tests
	describe('Negative', () => {
		checkLoop('Normal For',     'for (i in c(1,2)) { print(42); }',                                    '1@for',    false);
		checkLoop('repeat',         'repeat { print(42); }',                                               '1@repeat', false);
		checkLoop('while',          'while(TRUE) { print(42) }',                                           '1@while',  false);
		checkLoop('stopifnot(TRUE)','while(TRUE) { stopifnot(TRUE) }',                                     '1@while',  false);
		checkLoop('unknown while',  'while(x) { print(42) }',                                              '1@while',  false);
	
		checkLoop('Useful Loop before uselss', 'for (i in c(1,2)) { print(42); }\nrepeat { break; }',      '1@for',    false);
		checkLoop('Useful Loop after  uselss', 'repeat { break; }\nfor (i in c(1,2)) { print(42); }',      '2@for',    false);

		checkLoop('false break', 'for (i in c(1,2)) { if (FALSE) { break } }',                             '1@for',    false);

		describe('Branches', () => {
			const loopVariants = [/*'while (TRUE)',*/ 'repeat', 'for (i in 1:10)', 'for (i in c(1,2))'];
			const stopVariants = ['break', 'return(42)', 'stop(42)', 'stopifnot(FALSE)'];
			const branchVariants = ['if (FALSE)', 'if (u)'];


			for(const loop of loopVariants) {
				for(const stop of stopVariants) {
					for(const branch of branchVariants) {
						const code = `${loop} { print(42); ${branch} { ${stop} } }`;
						checkLoop(code, code, `1@${loop.split(' ')[0]}`, false);
					}
				}
			}
		});
	});

}));