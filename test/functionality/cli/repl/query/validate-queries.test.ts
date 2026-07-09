import { describe, expect, test } from 'vitest';
import { validateQueries } from '../../../../../src/cli/repl/commands/repl-query';
import { standardReplOutput, type ReplOutput } from '../../../../../src/cli/repl/commands/repl-main';
import type { Query } from '../../../../../src/queries/query';
import { label } from '../../../_helper/label';

function capture(): { output: ReplOutput, errors: string[] } {
	const errors: string[] = [];
	return {
		errors,
		output: { formatter: standardReplOutput.formatter, stdout: () => {}, stderr: (m: string) => errors.push(m) }
	};
}

describe('validateQueries', () => {
	test(label('rejects a name that only exists on Object.prototype without crashing', [], ['other']), () => {
		for(const type of ['toString', 'constructor', 'hasOwnProperty', 'valueOf']) {
			const { output, errors } = capture();
			expect(validateQueries(output, [{ type } as unknown as Query])).toBe(false);
			expect(errors.join('\n')).toContain('Unknown query type');
		}
	});

	test(label('reports the missing field and a template for a known query type', [], ['other']), () => {
		const { output, errors } = capture();
		expect(validateQueries(output, [{ type: 'call-context' } as unknown as Query])).toBe(false);
		expect(errors.join('\n')).toContain('"callName" is required');
		expect(errors.join('\n')).toContain('Template:');
	});

	test(label('accepts a well-formed compound (virtual) query', [], ['other']), () => {
		const compound = {
			type:            'compound',
			query:           'call-context',
			commonArguments: { callName: 'mean' },
			arguments:       [{}]
		} as unknown as Query;
		const { output } = capture();
		expect(validateQueries(output, [compound])).toBe(true);
	});
});
