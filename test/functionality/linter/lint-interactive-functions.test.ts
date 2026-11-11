import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('interactive functions', () => {
		assertLinter('View left in a script', parser, 'p <- penguins\nView(p)', 'interactive-functions', [
			{ certainty: LintingResultCertainty.Certain, function: 'utils::View', loc: [2, 1, 2, 7] }
		], { totalCalls: 1, totalFunctionDefinitions: 1 });
		assertLinter('the debugger left in a script', parser, 'x <- 1\nbrowser()\nprint(x)', 'interactive-functions', [
			{ certainty: LintingResultCertainty.Certain, function: 'base::browser', loc: [2, 1, 2, 9] }
		], { totalCalls: 1, totalFunctionDefinitions: 1 });
		assertLinter('only when interactive', parser, 'if(interactive()) View(mtcars)', 'interactive-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
		assertLinter('only when interactive, in a block', parser, 'if(interactive()) { x <- mtcars; View(x) }', 'interactive-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
		assertLinter('in the branch a non-interactive session takes', parser, 'if(!interactive()) View(mtcars) else print(1)', 'interactive-functions', [
			{ certainty: LintingResultCertainty.Certain, function: 'utils::View', loc: [1, 20, 1, 31] }
		], { totalCalls: 1, totalFunctionDefinitions: 1 });
		assertLinter('in the else of a non-interactive check', parser, 'if(!interactive()) print(1) else View(mtcars)', 'interactive-functions', [], { totalCalls: 0, totalFunctionDefinitions: 0 });
		assertLinter('within a function, which may be meant for interactive use', parser, 'show <- function(d) View(d)\nshow(mtcars)', 'interactive-functions', [
			{ certainty: LintingResultCertainty.Uncertain, function: 'utils::View', loc: [1, 21, 1, 27] }
		], { totalCalls: 1, totalFunctionDefinitions: 1 });
		assertLinter('a function of the same name the code defines', parser, 'View <- function(x) print(x)\nView(1)', 'interactive-functions', []);
	});
}));
