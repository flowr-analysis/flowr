import { describe } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { AccessType, ContainerType, setupContainerFunctions } from '../../_helper/pointer-analysis';
import { amendConfig, defaultConfigOptions } from '../../../../src/config';

const config = amendConfig(defaultConfigOptions, c => {
	c.solver.pointerTracking = true;
	return c;
});

describe.sequential('Container Single Index Based Access', withShell(shell => {

	describe('Failures in Practice', () => {
		assertSliced(
			label('Potential addition in nesting (not needed)', ['subsetting-multiple']),
			shell,
			`data <- read.csv(file = "data.csv", header = TRUE)
data$count = 1 : nrow(data)
data <- data[order(-age), ]

print(data)`,
			['5@print'],
			`data <- read.csv(file = "data.csv", header = TRUE)
data$count = 1 : nrow(data)
data <- data[order(-age), ]
print(data)`,
			config);
	});
	describe.each(
		[
			{ container: ContainerType.Vector, type: AccessType.DoubleBracket, hasNamedArguments: false },
			{ container: ContainerType.Vector, type: AccessType.SingleBracket, hasNamedArguments: false },
			{ container: ContainerType.List,   type: AccessType.DoubleBracket, hasNamedArguments: false },
			{ container: ContainerType.List,   type: AccessType.SingleBracket, hasNamedArguments: false },
			{ container: ContainerType.List,   type: AccessType.DoubleBracket, hasNamedArguments: true  },
			{ container: ContainerType.List,   type: AccessType.SingleBracket, hasNamedArguments: true  },
			{ container: ContainerType.List,   type: AccessType.Dollar,        hasNamedArguments: true  },
		]
	)('Access for container $container using $type and hasNamedArguments $hasNamedArguments', ({ container, type, hasNamedArguments }) => {
		const { acc, accS, def, accessCapability } = setupContainerFunctions(container, type, hasNamedArguments);

		const basicCapabilities = [
			'name-normal',
			'function-calls',
			hasNamedArguments ? 'named-arguments' : 'unnamed-arguments',
			'subsetting-multiple',
			accessCapability,
		] as const;

		describe('Simple access', () => {

			assertSliced(
				label('Container with single argument', basicCapabilities),
				shell,
				`numbers <- ${def('2')}
print(${acc('numbers', 1)})`,
				['2@print'],
				`numbers <- ${def('2')}
print(${acc('numbers', 1)})`,
				config);

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
print(numbers)`,
				config
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
print(x)`, config
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
print(numbers)`, config
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
print(${acc('numbers', 1)})`, config
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
print(${acc('numbers', 1)})`, config
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
print(${acc('numbers', 1)})`, config
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
print(${acc('numbers', 1)})`, config
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
print(${acc('numbers', 1)})`, config
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
print(${acc('numbers', 1)})`, config
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
print(${acc('numbers', 1)})`, config
				);
			});
		});

		describe('Disable config flag (pointer tracking)', () => {
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

		describe('Container assignment', () => {
			assertSliced(
				label('When container is self-redefined, then indices get passed', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
numbers <- numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- ${def('1', '2')}
numbers <- numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`, config
			);

			assertSliced(
				label('When container is self-redefined with previous assignment, then indices get passed', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 1
numbers <- numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`,
				['5@print'],
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 1
numbers <- numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`, config
			);

			assertSliced(
				label('When container is defined from other container, then indices get passed', basicCapabilities),
				shell,
				`other_numbers <- ${def('1', '2')}
numbers <- other_numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`,
				['4@print'],
				`other_numbers <- ${def('1', '2')}
numbers <- other_numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`, config
			);

			assertSliced(
				label('When container is defined from other container with previous assignment, then indices get passed', basicCapabilities),
				shell,
				`other_numbers <- ${def('1', '2')}
${acc('other_numbers', 1)} <- 1
numbers <- other_numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`,
				['5@print'],
				`other_numbers <- ${def('1', '2')}
${acc('other_numbers', 1)} <- 1
numbers <- other_numbers
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`, config
			);

			assertSliced(
				label('When container has unknown definition and single index is read, then unknown definition is in slice', basicCapabilities),
				shell,
				`numbers <- foo()
${acc('numbers', 1)} <- 1
${acc('numbers', 2)} <- 2
print(${acc('numbers', 1)})`,
				['4@print'],
				`numbers <- foo()
${acc('numbers', 1)} <- 1
print(${acc('numbers', 1)})`, config
			);

			assertSliced(
				label('When container has unknown definition and container is read, then unknown definition is in slice', basicCapabilities),
				shell,
				`numbers <- foo()
${acc('numbers', 1)} <- 1
${acc('numbers', 2)} <- 2
print(numbers)`,
				['4@print'],
				`numbers <- foo()
${acc('numbers', 1)} <- 1
${acc('numbers', 2)} <- 2
print(numbers)`,
			);
		});

		describe.skipIf(container !== ContainerType.List)('Nested Lists', () => {
			assertSliced(
				label('When index of nested list is overwritten, then overwrite is also in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 2)} <- "Jane"
${acc('person', 3)} <- 177
result <- ${acc(acc('person', 5), 1)}`,
				['7@result'],
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
result <- ${acc(acc('person', 5), 1)}`, config
			);

			assertSliced(
				label('When index of nested list is overwritten after nesting, then overwrite is also in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 2)} <- "Jane"
${acc('person', 3)} <- 177
${acc(acc('person', 5), 1)} <- 4.0
${acc(acc('person', 5), 2)} <- 1.0
result <- ${acc(acc('person', 5), 1)}`,
				['9@result'],
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc(acc('person', 5), 1)} <- 4.0
result <- ${acc(acc('person', 5), 1)}`, config
			);

			assertSliced(
				label('When nested list is overwritten, then only overwrite list is in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
grades <- ${def('4.0', '3.0')}
${acc('grades', 2)} <- 2.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 2)} <- "Jane"
${acc('person', 3)} <- 177
result <- ${acc(acc('person', 5), 2)}`,
				['9@result'],
				`grades <- ${def('4.0', '3.0')}
${acc('grades', 2)} <- 2.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
result <- ${acc(acc('person', 5), 2)}`, config
			);

			assertSliced(
				label('When nested list is overwritten after nesting, then only overwrite list is in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 5)} <- ${def('4.0', '3.0')}
${acc('person', 2)} <- "Jane"
${acc('person', 3)} <- 177
result <- ${acc(acc('person', 5), 2)}`,
				['8@result'],
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 5)} <- ${def('4.0', '3.0')}
result <- ${acc(acc('person', 5), 2)}`, config
			);

			assertSliced(
				label('When nested list is accessed, then accesses to nested list are in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('"John"', 'grades')}
${acc('grades', 1)} <- 5.0
${acc('person', 1)} <- "Jane"
result <- ${acc('person', 2)}`,
				['7@result'],
				`grades <- ${def('1.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('"John"', 'grades')}
result <- ${acc('person', 2)}`, config
			);

			assertSliced(
				label('When nested list is accessed, then accesses to nested lists are in slice', basicCapabilities),
				shell,
				`algebra_grades <- ${def('1.0', '3.0')}
${acc('algebra_grades', 1)} <- 4.0
grades <- ${def('algebra_grades', '1.7')}
${acc('grades', 2)} <- 1.0
person <- ${def('"John"', 'grades')}
${acc('person', 1)} <- "Jane"
result <- ${acc('person', 2)}`,
				['7@result'],
				`algebra_grades <- ${def('1.0', '3.0')}
${acc('algebra_grades', 1)} <- 4.0
grades <- ${def('algebra_grades', '1.7')}
${acc('grades', 2)} <- 1.0
person <- ${def('"John"', 'grades')}
result <- ${acc('person', 2)}`, config
			);

			assertSliced(
				label('When double nested list is accessed, then accesses to nested lists are in slice', basicCapabilities),
				shell,
				`algebra_grades <- ${def('1.0', '3.0')}
${acc('algebra_grades', 1)} <- 4.0
grades <- ${def('algebra_grades', '1.7')}
${acc('grades', 2)} <- 1.0
person <- ${def('"John"', 'grades')}
${acc('person', 1)} <- "Jane"
result <- ${acc(acc('person', 2), 1)}`,
				['7@result'],
				`algebra_grades <- ${def('1.0', '3.0')}
${acc('algebra_grades', 1)} <- 4.0
grades <- ${def('algebra_grades', '1.7')}
person <- ${def('"John"', 'grades')}
result <- ${acc(acc('person', 2), 1)}`, config
			);

			assertSliced(
				label('When list is assigned, then accesses to list and nested lists are in slice', basicCapabilities),
				shell,
				`algebra_grades <- ${def('1.0', '3.0')}
${acc('algebra_grades', 1)} <- 4.0
grades <- ${def('algebra_grades', '1.7')}
${acc('grades', 2)} <- 1.0
person <- ${def('"John"', 'grades')}
${acc('person', 1)} <- "Jane"
result <- person`,
				['7@result'],
				`algebra_grades <- ${def('1.0', '3.0')}
${acc('algebra_grades', 1)} <- 4.0
grades <- ${def('algebra_grades', '1.7')}
${acc('grades', 2)} <- 1.0
person <- ${def('"John"', 'grades')}
${acc('person', 1)} <- "Jane"
result <- person`,
				undefined,
				'fail-both', undefined, config
			);

			assertSliced(
				label('When nested list is redefined twice, then only second redefinition is in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 5)} <- ${def('4.0', '3.0')}
${acc('person', 5)} <- ${def('4.0', '3.0')}
${acc('person', 2)} <- "Jane"
${acc('person', 3)} <- 177
${acc(acc('person', 5), 1)} <- 1.0
result <- ${acc(acc('person', 5), 2)}`,
				['10@result'],
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 5)} <- ${def('4.0', '3.0')}
${acc(acc('person', 5), 1)} <- 1.0
result <- ${acc(acc('person', 5), 2)}`,
				undefined,
				'fail-both', undefined, config
			);

			assertSliced(
				label('When nested list is redefined with static value, then only static value assignment is in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 5)} <- ${def('4.0', '3.0')}
${acc('person', 5)} <- 3
${acc('person', 2)} <- "Jane"
${acc('person', 3)} <- 177
result <- ${acc('person', 5)}`,
				['9@result'],
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 5)} <- 3
result <- ${acc('person', 5)}`,
				undefined,
				'fail-both', undefined, config
			);

			assertSliced(
				label('When static list value is redefined with list, then only list value assignment is in slice', basicCapabilities),
				shell,
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
${acc('grades', 1)} <- 1.0
${acc('grades', 4)} <- 1.0
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 2)} <- "Jane"
${acc('person', 2)} <- ${def('"Jane"', '"Doe"')}
${acc(acc('person', 2), 1)} <- "John"
${acc('person', 3)} <- 177
result <- ${acc('person', 2)}`,
				['9@result'],
				`grades <- ${def('1.3', '2.0', '2.3', '1.7')}
person <- ${def('24', '"John"', '164', 'FALSE', 'grades')}
${acc('person', 2)} <- ${def('"Jane"', '"Doe"')}
${acc(acc('person', 2), 1)} <- "John"
result <- ${acc('person', 2)}`,
				undefined,
				'fail-both', undefined, config
			);

			assertSliced(
				label('When non existing index is accessed, then parent index is referenced', basicCapabilities),
				shell,
				`a <- ${def('1')}
b <- ${def('1', 'a')}
c <- ${def('b')}
print(${acc(acc(acc('c', 1), 42), 1)})`,
				['4@print'],
				`a <- ${def('1')}
b <- ${def('1', 'a')}
c <- ${def('b')}
print(${acc(acc(acc('c', 1), 42), 1)})`, config
			);

			describe('Access within conditionals', () => {

				assertSliced(
					label('Potential addition in nesting', basicCapabilities),
					shell,
					`person <- ${def('24')}
if(u) ${acc('person', 2)} <- "peter"
wrapper <- ${def('person')}
print(${acc(acc('wrapper', 1), 2)})`,
					['4@print'],
					`person <- ${def('24')}
if(u) ${acc('person', 2)} <- "peter"
wrapper <- ${def('person')}
print(${acc(acc('wrapper', 1), 2)})`, config
				);

				//Currently we can not handle the indirect passing minimally and include the name line
				assertSliced(
					label('Potential addition in nesting (not needed)', basicCapabilities),
					shell,
					`person <- ${def('24')}
if(u) ${acc('person', 2)} <- "peter"
wrapper <- ${def('person')}
print(${acc(acc('wrapper', 1), 1)})`,
					['4@print'],
					`person <- ${def('24')}
wrapper <- ${def('person')}
print(${acc(acc('wrapper', 1), 1)})`,
					undefined,
					'fail-both', undefined, config
				);
			});
		});

		// Only bracket access is affected from unknown access operations.
		describe.skipIf(type === AccessType.Dollar)('Unknown access', () => {
			assertSliced(
				label('When access cannot be resolved, then all indices are read', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 1
${acc('numbers', 2)} <- 2
print(${accS('numbers', 'foo()')})`,
				['4@print'],
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 1
${acc('numbers', 2)} <- 2
print(${accS('numbers', 'foo()')})`,
			);
		});
	});
}));
