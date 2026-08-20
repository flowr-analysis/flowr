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
		assertLinter('Closed inline', parser, 'close(file("x"))',
			'unclosed-connection',
			[]
		);
		assertLinter('Never closed', parser, 'a <- file("x")',
			'unclosed-connection',
			[{
				certainty: LintingResultCertainty.Certain,
				loc:       [1, 6, 1, 14],
				quickFix:  [{
					type:        'replace',
					loc:         [1, 15, 1, 14],
					description: 'Close the connection with `close(a)`',
					replacement: '\nclose(a)'
				}]
			}]
		);
		assertLinter('Closed after the last use', parser, `read <- function(){
	con <- file("x")
	readLines(con)
}`,
		'unclosed-connection',
		[{
			certainty: LintingResultCertainty.Certain,
			loc:       [2, 9, 2, 17],
			quickFix:  [{
				type:        'replace',
				loc:         [3, 16, 3, 15],
				description: 'Close the connection with `close(con)`',
				replacement: '\n close(con)'
			}]
		}]
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
			certainty: LintingResultCertainty.Certain,
			loc:       [1, 6, 1, 23],
			quickFix:  [{
				type:        'replace',
				loc:         [2, 7, 2, 6],
				description: 'Close the connection with `close(a)`',
				replacement: '\nclose(a)'
			}]
		}]
		);
		assertLinter('Closed with new definer', parser, `a <- textConnection(AB)
b <- a
c <- b
close(c)`,
		'unclosed-connection',
		[]
		);
		assertLinter('Closed by a wrapper function', parser, `shut <- function(con) close(con)
a <- textConnection(AB)
shut(a)`,
		'unclosed-connection',
		[]
		);
		assertLinter('Opened by a wrapper function', parser, `make <- function() textConnection(AB)
a <- make()
close(a)`,
		'unclosed-connection',
		[]
		);
		assertLinter('Closed in both branches', parser, `a <- textConnection(AB)
if(x){
	close(a)
} else {
	close(a)
}`,
		'unclosed-connection',
		[]
		);
		assertLinter('Closed on exit', parser, `read <- function(){
	con <- file("x")
	on.exit(close(con))
	readLines(con)
}
read()`,
		'unclosed-connection',
		[]
		);
		assertLinter('Closed by withr', parser, `con <- withr::local_connection(file("x"))
readLines(con)`,
		'unclosed-connection',
		[]
		);
		assertLinter('Database connection closed', parser, `con <- DBI::dbConnect(drv)
DBI::dbDisconnect(con)`,
		'unclosed-connection',
		[]
		);
		assertLinter('Database connection left open', parser, 'con <- DBI::dbConnect(drv)',
			'unclosed-connection',
			[{
				certainty: LintingResultCertainty.Certain,
				loc:       [1, 8, 1, 26],
				quickFix:  [{
					type:        'replace',
					loc:         [1, 27, 1, 26],
					description: 'Close the connection with `close(con)`',
					replacement: '\nclose(con)'
				}]
			}]
		);
		assertLinter('Configured functions', parser, `a <- myOpen("x")
b <- myOpen("y")
myClose(a)`,
		'unclosed-connection',
		[{
			certainty: LintingResultCertainty.Certain,
			loc:       [2, 6, 2, 16],
			quickFix:  [{
				type:        'replace',
				loc:         [2, 17, 2, 16],
				description: 'Close the connection with `close(b)`',
				replacement: '\nclose(b)'
			}]
		}],
		undefined,
		{ openFns: ['myOpen'], closeFns: ['myClose'] }
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
		assertLinter('Opened conditionally, closed unconditionally', parser, `if(x){
	a <- textConnection(A)
}
close(a)`,
		'unclosed-connection',
		[]
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
			certainty: LintingResultCertainty.Certain,
			loc:       [4, 7, 4, 23],
			quickFix:  [{
				type:        'replace',
				loc:         [4, 24, 4, 23],
				description: 'Close the connection with `close(b)`',
				replacement: '\n close(b)'
			}]
		}]
		);
		assertLinter('Opened and closed within the loop', parser, `for(f in files){
	con <- file(f)
	readLines(con)
	close(con)
}`,
		'unclosed-connection',
		[]
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
