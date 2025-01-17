import { describe, it } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { useConfigForTest } from '../../_helper/config';
import { label } from '../../_helper/label';

describe.sequential('Vector access', withShell(shell => {
	const basicCapabilities = ['name-normal', 'function-calls', 'unnamed-arguments', 'double-bracket-access', 'subsetting'] as const;
	useConfigForTest({ solver: { pointerTracking: true } });

	describe('Simple access', () => {
		assertSliced(label('Vector with single argument', basicCapabilities), shell,
			'numbers <- c(2)\nprint(numbers[[1]])',
			['2@print'],
			'numbers <- c(2)\nprint(numbers[[1]])',
		);

		/* we reconstruct everything as every other modification could mess with the correctness of the result */
		assertSliced(label('vector with several arguments', basicCapabilities), shell,
			'numbers <- c(1, 2, 3, 4)\nprint(numbers[[1]])',
			['2@print'],
			'numbers <- c(1, 2, 3, 4)\nprint(numbers[[1]])',
		);
	});

	describe('Whole vector access', () => {
		assertSliced(label('When each argument of a vector is redefined, then original vector is still in slice', basicCapabilities), shell,
			`numbers <- c(1, 2, 3, 4)
numbers[[1]] <- 4
numbers[[2]] <- 3
numbers[[3]] <- 2
numbers[[4]] <- 1
print(numbers)`,
			['6@print'],
			`numbers <- c(1, 2, 3, 4)
numbers[[1]] <- 4
numbers[[2]] <- 3
numbers[[3]] <- 2
numbers[[4]] <- 1
print(numbers)`
		);

		assertSliced(label('When arguments are added to an empty vector, then original vector is in slice', basicCapabilities), shell,
			`x <- c()
x[[1]] <- 1
x[[2]] <- 2
x[[3]] <- 3
x[[4]] <- 4
print(x)`,
			['6@print'],
			`x <- c()
x[[1]] <- 1
x[[2]] <- 2
x[[3]] <- 3
x[[4]] <- 4
print(x)`
		);

		assertSliced(label('When whole vector is redefined, then every vector assignment before is not in slice', basicCapabilities), shell,
			`numbers <- c(1, 2)
numbers[[1]] <- 2
numbers[[2]] <- 1
numbers <- c(3, 4)
numbers[[1]] <- 4
numbers[[2]] <- 3
print(numbers)`,
			['7@print'],
			`numbers <- c(3, 4)
numbers[[1]] <- 4
numbers[[2]] <- 3
print(numbers)`
		);
	});

	describe('Access with other accesses', () => {
		assertSliced(label('With other vector', basicCapabilities), shell,
			`numbers <- c(1, 2)
other_numbers <- c(3, 4)
a <- other_numbers[[1]]
print(numbers[[1]])`,
			['4@print'],
			`numbers <- c(1, 2)
print(numbers[[1]])`,
		);

		assertSliced(label('With other accesses', basicCapabilities), shell,
			`numbers <- c(1, 2)
a <- numbers[[1]]
b <- numbers[[2]]
print(numbers[[1]])`,
			['4@print'],
			`numbers <- c(1, 2)
print(numbers[[1]])`,
		);
	});

	describe('Access with assignment', () => {
		it.fails('Currently not supported', () => {
			assertSliced(label('When there is more than one assignment to the same index, then the last assignment is in the slice', basicCapabilities),
				shell,
				`numbers <- c(1, 2)
	numbers[[1]] <- 3
	numbers[[1]] <- 4
	numbers[[1]] <- 5
	print(numbers[[1]])`,
				['5@print'],
				`numbers <- c(1, 2)
	numbers[[1]] <- 5
	print(numbers[[1]])`,
			);
		});

		it.fails('Currently not supported', () => {
			assertSliced(label('When there are assignments to the other indices, then they are not in the slice', basicCapabilities),
				shell,
				`numbers <- c(1, 2, 3)
	numbers[[1]] <- 4
	numbers[[2]] <- 5
	numbers[[3]] <- 6
	print(numbers[[1]])`,
				['5@print'],
				`numbers <- c(1, 2, 3)
	numbers[[1]] <- 4
	print(numbers[[1]])`,
			);
		});

		it.fails('Currently not supported', () => {
			assertSliced(label('When there are assignments to only other indices, then only vector is in the slice', basicCapabilities),
				shell,
				`numbers <- c(1, 2, 3)
	numbers[[2]] <- 5
	numbers[[3]] <- 6
	print(numbers[[1]])`,
				['4@print'],
				`numbers <- c(1, 2, 3)
	print(numbers[[1]])`,
			);
		});

		describe('Access within conditionals', () => {
			assertSliced(label('Only a potential overwrite', basicCapabilities),
				shell,
				`numbers <- c(1)
if(u) 
			numbers[[1]] <- 2
print(numbers[[1]])`,
				['4@print'],
				`numbers <- c(1)
if(u) numbers[[1]] <- 2
print(numbers[[1]])`);

			assertSliced(label('Potential wipe', basicCapabilities),
				shell,
				`numbers <- c(1)
if(u) {
	numbers[[1]] <- 2
} else {
	numbers[[1]] <- 3
	numbers <- c()
}
print(numbers[[1]])`,
				['8@print'],
				`numbers <- c(1)
if(u) { numbers[[1]] <- 2 } else
{ numbers <- c() }
print(numbers[[1]])`);
		});
	});

	describe('Config flag', () => {
		useConfigForTest({ solver: { pointerTracking: false } });
		assertSliced(label('When flag is false, then vector access is not in slice', ['call-normal']),
			shell,
			`numbers <- c(1, 2)
numbers[[1]] <- 3
numbers[[2]] <- 4
print(numbers[[1]])`,
			['4@print'],
			`numbers <- c(1, 2)
numbers[[1]] <- 3
numbers[[2]] <- 4
print(numbers[[1]])`
		);
	});
}));
