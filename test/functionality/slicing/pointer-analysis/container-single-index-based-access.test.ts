import { describe } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { useConfigForTest } from '../../_helper/config';
import { label } from '../../_helper/label';

describe.sequential('Container Single Index Based Access', withShell(shell => {
	describe.each(
		[
			{ container: 'c',    type: '[[', hasNamedArguments: false },
			{ container: 'c',    type: '[',  hasNamedArguments: false },
			{ container: 'list', type: '[[', hasNamedArguments: false },
			{ container: 'list', type: '[',  hasNamedArguments: false },
			{ container: 'list', type: '[[', hasNamedArguments: true  },
			{ container: 'list', type: '[',  hasNamedArguments: true  },
		]
	)('Access for container $container using $type and hasNamedArguments $hasNamedArguments', ({ container, type, hasNamedArguments }) => {
		const basicCapabilities = [
			'name-normal',
			'function-calls',
			hasNamedArguments ? 'named-arguments' : 'unnamed-arguments',
			'subsetting-multiple',
			type === '[[' ? 'double-bracket-access' : 'single-bracket-access'
		] as const;
		useConfigForTest({ solver: { pointerTracking: true } });

		/**
		 * Creates access string
		 * 
		 * Example for name='numbers', index=1 and type='[[':
		 * ```r
		 * numbers[[1]]
		 * ```
		 */
		function acc(name: string, index: number) {
			const closingBracket = type === '[[' ? ']]' : ']';
			return `${name}${type}${index}${closingBracket}`;
		}

		/**
		 * Creates definition string
		 * 
		 * Example for values=['1', '2', '3', '4'], container='list' and hasNamedArguments=true:
		 * ```r
		 * list(arg1 = 1, arg2 = 2, arg3 = 3, arg4 = 4)
		 * ```
		 */
		function def(...values: string[]) {
			const parameterList = values.map((value, i) => {
				if(hasNamedArguments) {
					return `arg${i + 1} = ${value}`;
				} else {
					return value;
				}
			}).join(', ');
			return `${container}(${parameterList})`;
		}

		describe('Simple access', () => {
			assertSliced(
				label('Container with single argument', basicCapabilities),
				shell,
				`numbers <- ${def('2')}
print(${acc('numbers', 1)})`,
				['2@print'],
				`numbers <- ${def('2')}
print(${acc('numbers', 1)})`,
			);

			/* we reconstruct everything as every other modification could mess with the correctness of the result */
			assertSliced(
				label('Container with several arguments', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2', '3', '4')}
print(${acc('numbers', 1)})`,
				['2@print'],
				`numbers <- ${def('1', '2', '3', '4')}
print(${acc('numbers', 1)})`,
			);
		});

		describe('Whole container access', () => {
			assertSliced(
				label('When each argument of a container is redefined, then original container is still in slice', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2', '3', '4')}
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
${acc('numbers', 3)} <- 2
${acc('numbers', 4)} <- 1
print(numbers)`,
				['6@print'],
				`numbers <- ${def('1', '2', '3', '4')}
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
${acc('numbers', 3)} <- 2
${acc('numbers', 4)} <- 1
print(numbers)`
			);

			assertSliced(
				label('When arguments are added to an empty container, then original container is in slice', basicCapabilities),
				shell,
				`x <- ${def()}
${acc('x', 1)} <- 1
${acc('x', 2)} <- 2
${acc('x', 3)} <- 3
${acc('x', 4)} <- 4
print(x)`,
				['6@print'],
				`x <- ${def()}
${acc('x', 1)} <- 1
${acc('x', 2)} <- 2
${acc('x', 3)} <- 3
${acc('x', 4)} <- 4
print(x)`
			);

			assertSliced(
				label('When whole container is redefined, then every container assignment before is not in slice', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 2
${acc('numbers', 2)} <- 1
numbers <- ${def('3', '4')}
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
print(numbers)`,
				['7@print'],
				`numbers <- ${def('3', '4')}
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 3
print(numbers)`
			);
		});

		describe('Access with other accesses', () => {
			assertSliced(
				label('With other container', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
other_numbers <- ${def('3', '4')}
a <- ${acc('other_numbers', 1)}
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- ${def('1', '2')}
print(${acc('numbers', 1)})`,
			);

			assertSliced(
				label('With other accesses', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
a <- ${acc('numbers', 1)}
b <- ${acc('numbers', 2)}
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- ${def('1', '2')}
print(${acc('numbers', 1)})`,
			);
		});

		describe('Access with assignment', () => {
			assertSliced(
				label('When there is more than one assignment to the same index, then the last assignment is in the slice', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 3
${acc('numbers', 1)} <- 4
${acc('numbers', 1)} <- 5
print(${acc('numbers', 1)})`,
				['5@print'],
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 5
print(${acc('numbers', 1)})`,
			);

			assertSliced(
				label('When there are assignments to the other indices, then they are not in the slice', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2', '3')}
${acc('numbers', 1)} <- 4
${acc('numbers', 2)} <- 5
${acc('numbers', 3)} <- 6
print(${acc('numbers', 1)})`,
				['5@print'],
				`numbers <- ${def('1', '2', '3')}
${acc('numbers', 1)} <- 4
print(${acc('numbers', 1)})`,
			);

			assertSliced(
				label('When there are assignments to only other indices, then only container is in the slice', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2', '3')}
${acc('numbers', 2)} <- 5
${acc('numbers', 3)} <- 6
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- ${def('1', '2', '3')}
print(${acc('numbers', 1)})`,
			);

			describe('Access within conditionals', () => {
				assertSliced(
					label('Only a potential overwrite', basicCapabilities),
					shell,
					`numbers <- ${def('1')}
if(u) 
			${acc('numbers', 1)} <- 2
print(${acc('numbers', 1)})`,
					['4@print'],
					`numbers <- ${def('1')}
if(u) ${acc('numbers', 1)} <- 2
print(${acc('numbers', 1)})`
				);

				assertSliced(
					label('Potential wipe', basicCapabilities),
					shell,
					`numbers <- ${def('1')}
if(u) {
	${acc('numbers', 1)} <- 2
} else {
	${acc('numbers', 1)} <- 3
	numbers <- ${def()}
}
print(${acc('numbers', 1)})`,
					['8@print'],
					`numbers <- ${def('1')}
if(u) { ${acc('numbers', 1)} <- 2 } else
{ numbers <- ${def()} }
print(${acc('numbers', 1)})`
				);
			});
		});

		describe('Config flag', () => {
			useConfigForTest({ solver: { pointerTracking: false } });
			assertSliced(
				label('When flag is false, then container access is not in slice', ['call-normal']),
				shell,
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 3
${acc('numbers', 2)} <- 4
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 3
${acc('numbers', 2)} <- 4
print(${acc('numbers', 1)})`
			);
		});
	});
}));
