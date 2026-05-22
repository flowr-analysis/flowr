import { describe } from 'vitest';
import { IntervalDomain } from '../../../src/abstract-interpretation/domains/interval-domain';
import { IntervalInferenceVisitor } from '../../../src/documentation/wiki-absint';
import { withShell } from '../_helper/shell';
import { testInferredValues } from './inference';

function createOutputCode(marker: string, symbol: string): string {
	return `cat(sprintf("${marker}: %s,%s,%s\\n", is.numeric(${symbol}), length(${symbol}) == 1, paste(${symbol}, collapse=";")))`;
}

function parseOutput(output: string): IntervalDomain | undefined {
	const OutputRegex = /(TRUE|FALSE),(TRUE|FALSE),(.*)$/;
	const result = output.match(OutputRegex);

	if(result?.length === 4) {
		const numeric = result[1] === 'TRUE';
		const scalar = result[2] === 'TRUE';
		const value = Number.parseInt(result[3]);

		if(numeric && scalar && !Number.isNaN(value)) {
			return new IntervalDomain([value, value]);
		}
	}
}

describe('Interval Inference', withShell(shell => {
	testInferredValues(
		'Simple addition',
		shell,
		`
x <- 42
y <- if (runif(1) < 0.5) 6 else 12
z <- x + y
        `.trim(),
		{
			'1@x': new IntervalDomain([42, 42]),
			'2@y': new IntervalDomain([6, 12]),
			'3@z': new IntervalDomain([48, 54])
		},
		config => new IntervalInferenceVisitor(config),
		createOutputCode,
		parseOutput
	);
}));
