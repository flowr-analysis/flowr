import { describe, it } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { useConfigForTest } from '../../_helper/config';
import { label } from '../../_helper/label';

describe.sequential('Vector Single Index Based Access', withShell(shell => {
	describe.each([{ type: '[[' }, { type: '[' }])('Access using $type', ({ type }) => {
		const basicCapabilities = [
			'name-normal',
			'function-calls',
			'unnamed-arguments',
			'subsetting',
			type === '[[' ? 'double-bracket-access' : 'single-bracket-access'
		] as const;
		useConfigForTest({ solver: { pointerTracking: true } });

		function acc(name: string, index: number) {
			const closingBracket = type === '[[' ? ']]' : ']';
			return `${name}${type}${index}${closingBracket}`;
		}
		
		describe('Simple access', () => {
			assertSliced(label('Vector with single argument', basicCapabilities), shell,
				`numbers <- c(2)\nprint(${acc('numbers', 1)})`,
				['2@print'],
				`numbers <- c(2)\nprint(${acc('numbers', 1)})`,
			);

			/* we reconstruct everything as every other modification could mess with the correctness of the result */
			assertSliced(label('vector with several arguments', basicCapabilities), shell,
				`numbers <- c(1, 2, 3, 4)\nprint(${acc('numbers', 1)})`,
				['2@print'],
				`numbers <- c(1, 2, 3, 4)\nprint(${acc('numbers', 1)})`,
			);
		});

		describe('Whole vector access', () => {
			assertSliced(
				label('When each argument of a vector is redefined, then original vector is still in slice', basicCapabilities),
				shell,
				`numbers <- c(1, 2, 3, 4)
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
${acc('numbers', 3)} <- 2
${acc('numbers', 4)} <- 1
print(numbers)`,
				['6@print'],
				`numbers <- c(1, 2, 3, 4)
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
${acc('numbers', 3)} <- 2
${acc('numbers', 4)} <- 1
print(numbers)`
			);

			assertSliced(
				label('When arguments are added to an empty vector, then original vector is in slice', basicCapabilities),
				shell,
				`x <- c()
${acc('x', 1)} <- 1
${acc('x', 2)} <- 2
${acc('x', 3)} <- 3
${acc('x', 4)} <- 4
print(x)`,
				['6@print'],
				`x <- c()
${acc('x', 1)} <- 1
${acc('x', 2)} <- 2
${acc('x', 3)} <- 3
${acc('x', 4)} <- 4
print(x)`
			);

			assertSliced(
				label('When whole vector is redefined, then every vector assignment before is not in slice', basicCapabilities),
				shell,
				`numbers <- c(1, 2)
${acc('numbers', 1)} <- 2
${acc('numbers', 2)} <- 1
numbers <- c(3, 4)
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
print(numbers)`,
				['7@print'],
				`numbers <- c(3, 4)
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
print(numbers)`
			);
		});

		describe('Access with other accesses', () => {
			assertSliced(
				label('With other vector', basicCapabilities),
				shell,
				`numbers <- c(1, 2)
other_numbers <- c(3, 4)
a <- ${acc('other_numbers', 1)}
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- c(1, 2)
print(${acc('numbers', 1)})`,
			);

			assertSliced(
				label('With other accesses', basicCapabilities),
				shell,
				`numbers <- c(1, 2)
a <- ${acc('numbers', 1)}
b <- ${acc('numbers', 2)}
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- c(1, 2)
print(${acc('numbers', 1)})`,
			);
		});

		describe('Access with assignment', () => {
			it.fails('Currently not supported', () => {
				assertSliced(
					label('When there is more than one assignment to the same index, then the last assignment is in the slice', basicCapabilities),
					shell,
					`numbers <- c(1, 2)
${acc('numbers', 1)} <- 3
${acc('numbers', 1)} <- 4
${acc('numbers', 1)} <- 5
print(${acc('numbers', 1)})`,
					['5@print'],
					`numbers <- c(1, 2)
${acc('numbers', 1)} <- 5
print(${acc('numbers', 1)})`,
				);
			});

			it.fails('Currently not supported', () => {
				assertSliced(
					label('When there are assignments to the other indices, then they are not in the slice', basicCapabilities),
					shell,
					`numbers <- c(1, 2, 3)
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 5
${acc('numbers', 3)} <- 6
print(${acc('numbers', 1)})`,
					['5@print'],
					`numbers <- c(1, 2, 3)
${acc('numbers', 1)} <- 4
print(${acc('numbers', 1)})`,
				);
			});

			it.fails('Currently not supported', () => {
				assertSliced(
					label('When there are assignments to only other indices, then only vector is in the slice', basicCapabilities),
					shell,
					`numbers <- c(1, 2, 3)
${acc('numbers', 2)} <- 5
${acc('numbers', 3)} <- 6
print(${acc('numbers', 1)})`,
					['4@print'],
					`numbers <- c(1, 2, 3)
print(${acc('numbers', 1)})`,
				);
			});

			describe('Access within conditionals', () => {
				assertSliced(
					label('Only a potential overwrite', basicCapabilities),
					shell,
					`numbers <- c(1)
if(u) 
			${acc('numbers', 1)} <- 2
print(${acc('numbers', 1)})`,
					['4@print'],
					`numbers <- c(1)
if(u) ${acc('numbers', 1)} <- 2
print(${acc('numbers', 1)})`
				);

				assertSliced(
					label('Potential wipe', basicCapabilities),
					shell,
					`numbers <- c(1)
if(u) {
	${acc('numbers', 1)} <- 2
} else {
	${acc('numbers', 1)} <- 3
	numbers <- c()
}
print(${acc('numbers', 1)})`,
					['8@print'],
					`numbers <- c(1)
if(u) { ${acc('numbers', 1)} <- 2 } else
{ numbers <- c() }
print(${acc('numbers', 1)})`
				);
			});
		});

		describe('Config flag', () => {
			useConfigForTest({ solver: { pointerTracking: false } });
			assertSliced(
				label('When flag is false, then vector access is not in slice', ['call-normal']),
				shell,
				`numbers <- c(1, 2)
${acc('numbers', 1)} <- 3
${acc('numbers', 2)} <- 4
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- c(1, 2)
${acc('numbers', 1)} <- 3
${acc('numbers', 2)} <- 4
print(${acc('numbers', 1)})`
			);
		});
	});
}));
