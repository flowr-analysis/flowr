import { assertSliced, withShell } from '../../_helper/shell';
import { setSourceProvider } from '../../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import { requestProviderFromFile, requestProviderFromText } from '../../../../src/r-bridge/retriever';
import { label } from '../../_helper/label';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe, beforeAll, afterAll } from 'vitest';

describe.sequential('source', withShell(shell => {
	const sources = {
		simple:   'N <- 9',
		closure1: 'f <- function() { function() 3 }',
		closure2: 'f <- function() { x <<- 3 }'
	};
	beforeAll(() => setSourceProvider(requestProviderFromText(sources)));
	afterAll(() => setSourceProvider(requestProviderFromFile()));

	assertSliced(label('simple source', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("simple")\ncat(N)', ['2@N'], 'source("simple")\nN');
	assertSliced(label('do not always include source', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("simple")\ncat(N)\nx <- 3', ['3@x'], 'x <- 3');
	assertSliced(label('sourcing a closure', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'sourcing-external-files', 'newlines', 'normal-definition', 'implicit-return', 'closures', 'numbers']),
		shell, 'source("closure1")\ng <- f()\nprint(g())', ['3@g'], 'source("closure1")\ng <- f()\ng()');
	assertSliced(label('sourcing a closure w/ side effects', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'sourcing-external-files', 'newlines', 'normal-definition', 'implicit-return', 'closures', 'numbers', ...OperatorDatabase['<<-'].capabilities]),
		shell, 'x <- 2\nsource("closure2")\nf()\nprint(x)', ['4@x'], 'source("closure2")\nf()\nx');
	assertSliced(label('multiple sources', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("simple")\nsource("closure1")\ncat(N + f())', ['3@cat'], 'source("simple")\nsource("closure1")\ncat(N + f())');
	assertSliced(label('Include unresolved sources', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'sourcing-external-files','newlines']),
		shell, 'source("unknown")\ncat(N)', ['2@cat'], 'source("unknown")\ncat(N)');
}));
