import { describe } from 'vitest';
import { assertSliced, withShell } from '../_helper/shell';
import { label } from '../_helper/label';

/* functions looked up by a name the program computes, every expected output is the one R prints */
const name = (s: string) => label(s, ['name-normal', 'function-calls', 'strings']);

describe('Snippets: dynamic names', withShell(shell => {
	function assertCalls(title: string, call: string) {
		const code = `f_123 <- function() 1\nx <- ${call}\nprint(x)`;
		assertSliced(name(title), shell, code, ['3@print'], code, { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
	}
	assertCalls('get with a name pasted from arithmetic', 'get(paste0("f_12", 1 + 2))()');
	assertCalls('get with a name pasted with a separator', 'get(paste("f", 120 + 3, sep = "_"))()');
	assertCalls('get with nested arithmetic', 'get(paste0("f_", 100 + 20 + 3))()');
	assertCalls('match.fun with a unary minus', 'match.fun(paste0("f_12", -(-3)))()');
	assertCalls('do.call with a computed name', 'do.call(paste0("f_", 2 * 61 + 1), list())');
	assertSliced(name('do.call with a name held in a variable'), shell, 'f_123 <- function() 1\nnm <- "f_123"\nx <- do.call(nm, list())\nprint(x)', ['4@print'],
		'f_123 <- function() 1\nnm <- "f_123"\nx <- do.call(nm, list())\nprint(x)', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
}));
