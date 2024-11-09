import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';

describe.sequential('dollar access', withShell(shell => {
	/* in this case, we assume that it may have an impact! */
	assertSliced(label('problems in practice', ['name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'dollar-access', 'newlines']),
		shell, `
cor <- t$estimate
pv <- t$p.value
print(cor + pv)
		`, ['4@print'], 'cor <- t$estimate\npv <- t$p.value\nprint(cor + pv)');
}));
