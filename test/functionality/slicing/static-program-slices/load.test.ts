import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';

describe.sequential('load', withShell(shell => {
	/* in this case, we assume that it may have an impact! */
	assertSliced(label('simple loading', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in', 'newlines']),
		shell, 'load("x.RData")\ncat(N)', ['2@N'], 'load("x.RData")\nN');
	/* currently we cannot narrow this down */
	assertSliced(label('multiple loads', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in', 'newlines']),
		shell, 'load("z.RData")\nload("x.RData")\ncat(N)\nload("y.RData")', ['3@cat'], 'load("z.RData")\nload("x.RData")\ncat(N)\nload("y.RData")');
}));
