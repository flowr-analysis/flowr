import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';

describe.sequential('eval', withShell(shell => {
	assertSliced(label('simple eval use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation','newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(x)"))', ['2@y'], 'x <- 2\ny <- eval(parse(text="print(x)"))');
	assertSliced(label('simple eval no-use', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'strings', 'built-in-evaluation','newlines']),
		shell, 'x <- 2\ny <- eval(parse(text="print(y)"))', ['2@y'], 'y <- eval(parse(text="print(y)"))');
}));
