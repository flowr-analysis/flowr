import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';
import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';

describe.sequential('source', withShell(shell => {
	const addFiles = [
		new FlowrInlineTextFile('simple', 'N <- 9'),
		new FlowrInlineTextFile('closure1', 'f <- function() { function() 3 }'),
		new FlowrInlineTextFile('closure2', 'f <- function() { x <<- 3 }')
	];

	assertSliced(label('simple source', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("simple")\ncat(N)', ['2@N'], 'source("simple")\nN', { addFiles });
	assertSliced(label('simple source with alias', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'x <- "simple"\nsource(x)\ncat(N)', ['3@N'], 'x <- "simple"\nsource(x)\nN', { addFiles });
	assertSliced(label('do not always include source', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("simple")\ncat(N)\nx <- 3', ['3@x'], 'x <- 3', { addFiles });
	assertSliced(label('sourcing a closure', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'sourcing-external-files', 'newlines', 'normal-definition', 'implicit-return', 'closures', 'numbers']),
		shell, 'source("closure1")\ng <- f()\nprint(g())', ['3@g'], 'source("closure1")\ng <- f()\ng()', { addFiles });
	assertSliced(label('sourcing a closure w/ side effects', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'sourcing-external-files', 'newlines', 'normal-definition', 'implicit-return', 'closures', 'numbers', ...OperatorDatabase['<<-'].capabilities]),
		shell, 'x <- 2\nsource("closure2")\nf()\nprint(x)', ['4@x'], 'source("closure2")\nf()\nx', { addFiles });
	assertSliced(label('multiple sources', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("simple")\nsource("closure1")\ncat(N + f())', ['3@cat'], 'source("simple")\nsource("closure1")\ncat(N + f())', { addFiles });
	assertSliced(label('Include unresolved sources', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("unknown")\ncat(N)', ['2@cat'], 'source("unknown")\ncat(N)', { addFiles });
}));
