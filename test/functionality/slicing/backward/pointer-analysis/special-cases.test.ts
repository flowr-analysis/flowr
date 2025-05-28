import { describe } from 'vitest';
import { assertSliced, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { useConfigForTest } from '../../../_helper/config';

// Tests that cannot be generalized and are not covered by other tests
describe.sequential('Special Cases', withShell(shell => {
	useConfigForTest({ solver: { pointerTracking: true } });

	assertSliced(
		label('When multiple indices are accessed with unknown access operator, then all indices are in slice', ['name-normal', 'function-calls', 'named-arguments', 'unnamed-arguments', 'subsetting-multiple', 'single-bracket-access', 'dollar-access']),
		shell,
		`data <- read.csv(file = "data.csv", header = TRUE)
data$count = 1 : nrow(data)
data <- data[order(-age), ]
print(data)`,
		['4@print'],
		`data <- read.csv(file = "data.csv", header = TRUE)
data$count = 1 : nrow(data)
data <- data[order(-age), ]
print(data)`,
	);
}));
