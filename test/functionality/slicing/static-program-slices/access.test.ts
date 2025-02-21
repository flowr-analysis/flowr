import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import { describe } from 'vitest';
import { MIN_VERSION_PIPE } from '../../../../src/r-bridge/lang-4.x/ast/model/versions';

describe.sequential('dollar access', withShell(shell => {
	describe('problems in practice', () => {
	/* in this case, we assume that it may have an impact! */
		assertSliced(label('access addition', ['name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'dollar-access', 'newlines']),
			shell, `
cor <- t$estimate
pv <- t$p.value
print(cor + pv)
		`, ['4@print'], 'cor <- t$estimate\npv <- t$p.value\nprint(cor + pv)');

		for(const pipe of ['%>%', '|>']) {
			const code = `
library(dplyr)
data <- read.csv(file = "data.csv", header = TRUE)
data$name <- gsub("\\\\.", "", data$name)
data <- data ${pipe} filter(age >= 30)
print(data)
		`.trim();

			assertSliced(label(`${pipe}-pipe with access`, ['name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'dollar-access', 'replacement-functions', 'newlines', 'built-in-pipe-and-pipe-bind']),
				shell, code, ['5@print'], code, {
					minRVersion: MIN_VERSION_PIPE
				});
		}
	});
}));
