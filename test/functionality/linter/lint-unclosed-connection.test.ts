import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('unclosed-connection', () => {
		assertLinter('All closed', parser, `zz <- textConnection(E)
readLines(zz, 2)
close(zz)`,
			'unclosed-connection',
			[]
		);
    assertLinter('Only one closed', parser, `a <- textConnection(AB)
b <- a
if(x){
	b <- textConnection(LETTERS)
	close(b)
	close(b)
}
t <- 2`,
			'unclosed-connection',
			[{
                certainty: LintingResultCertainty.Uncertain,
                loc:       [1, 6, 1, 23]
            }]
		);
	assertLinter('Not necessarily closed', parser, `a <- textConnection(AB)
b <- textConnection(E)
if(x){
	close(a)
}
t <- 2
close(b)`,
			'unclosed-connection',
			[{
                certainty: LintingResultCertainty.Uncertain,
                loc:       [1, 6, 1, 23]
            }]
		);
	assertLinter('Openend and closed', parser, `a <- 4+3
if(x){
	a <- textConnection(A)
	b <- textConnection(B)
}
t <- 34
if(x){
	close(a)
}
if(y){
	close(b)
}`,
			'unclosed-connection',
			[{
                certainty: LintingResultCertainty.Uncertain,
                loc:       [4, 6, 4, 22]
            }]
		);
	});
}));
