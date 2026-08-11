import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';

describe('flowR linter', withTreeSitter(parser => {
	describe('unclosed-connection', () => {
		assertLinter('All closed', parser, `a <- textConnection(A)
readLines(a, 2)
file <- file()
b <- textConnection(B)

close(a)
close(b)
close(file)`,
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
		assertLinter('Closed with new definer', parser, `a <- textConnection(AB)
b <- a
c <- b
close(c)`,
		'unclosed-connection',
		[]
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
		assertLinter('Openend and closed in different branches', parser, `a <- 4+3
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
			loc:       [3, 7, 3, 23]
		},
		{
			certainty: LintingResultCertainty.Uncertain,
			loc:       [4, 7, 4, 23]
		}]
		);
		assertLinter('Nested branches - not necessarily closed', parser, `a <- 4+3
if(x){
	a <- textConnection(A)
	b <- textConnection(B)
	if(y){
	close(a)
	}
}`,
		'unclosed-connection',
		[{
			certainty: LintingResultCertainty.Uncertain,
			loc:       [3, 7, 3, 23]
		},
		{
			certainty: LintingResultCertainty.Uncertain,
			loc:       [4, 7, 4, 23]
		}]
		);
		assertLinter('Nested branches - not closed', parser, `if(x){
	a <- 4
	while(a > 0){
		b <- textConnection(A)
		readLines(b, 2)
		a <- a - 1
	}
	close(b)
} 
else {
	a <- textConnection(A)
	close(a)
}`,
		'unclosed-connection',
		[{
			certainty: LintingResultCertainty.Uncertain,
			loc:       [4, 8, 4, 24]
		}]
		);
	});
}));
