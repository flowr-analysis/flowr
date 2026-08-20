import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import { MIN_VERSION_PIPE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { describe } from 'vitest';

/**
 * A data-masked argument is evaluated in a frame whose parent is the caller, so a name that is not a column of the
 * data resolves to the enclosing binding and has to survive the slice.
 */
describe('Data Masking', { concurrent: false }, withShell(shell => {
	const capabilities: SupportedFlowrCapabilityId[] = ['name-normal', 'call-normal', 'numbers',
		'unnamed-arguments', 'named-arguments', ...OperatorDatabase['<-'].capabilities];

	describe('keeps what a masked argument reads from the enclosing scope', () => {
		const cases: Record<string, { call: string, minRVersion?: string }> = {
			'subset':    { call: 'res <- subset(d, a >= k)' },
			'transform': { call: 'res <- transform(d, c = a * k)' },
			'with':      { call: 'res <- with(d, a + k)' },
			'filter':    { call: 'res <- dplyr::filter(d, a >= k)' },
			'pipe':      { call: 'res <- d |> dplyr::filter(a >= k)', minRVersion: MIN_VERSION_PIPE }
		};
		for(const [name, { call, minRVersion }] of Object.entries(cases)) {
			const code = `k <- 100
d <- data.frame(a = 1:5)
${call}
print(res)`;
			assertSliced(label(name, capabilities), shell, code, ['4@res'], code.split('\n').slice(0, 3).concat('res').join('\n'), { minRVersion });
		}
	});

	assertSliced(label('a column name drags nothing else in', capabilities),
		shell, `k <- 100
d <- data.frame(a = 1:5)
res <- subset(d, a >= 1)
print(res)`, ['4@res'], `d <- data.frame(a = 1:5)
res <- subset(d, a >= 1)
res`);
}));
