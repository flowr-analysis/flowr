import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { writesLikeR } from './transitivity';

const ok = '\nif(getOption("digits") == 3) cat("ok")';
/**
 * Global state written through calls flowR has to follow (higher-order functions, `do.call`, `eval`, dispatch, ...),
 * each checked against what R leaves changed.
 */
describe('Ambient writes through indirect calls, checked against R', withTreeSitter(parser => {
	const cases: [string, string, number, string[], string?][] = [
		['eval parse', 'eval(parse(text = "options(digits = 3)"))' + ok, 1, ['#option:digits']],
		['with', 'with(list(d = 3), options(digits = d))' + ok, 1, ['#option:digits']],
		['eval parse in fn', 'f <- function() eval(parse(text = "options(digits = 3)"))\nf()' + ok, 2, ['#option:digits']],
		['eval str2lang', 'eval(str2lang("options(digits = 3)"))' + ok, 1, ['#option:digits']],
		['eval parse var', 'x <- "options(digits = 3)"\neval(parse(text = x))' + ok, 2, ['#option:digits']],
		['eval parse two', 'eval(parse(text = "y <- 1; options(digits = 3)"))' + ok, 1, ['#option:digits']]
	];
	for(const [name, code, line, writes, imprecise] of cases) {
		writesLikeR(parser, name, code, line, writes, imprecise === undefined ? {} : { imprecise });
	}
}));
