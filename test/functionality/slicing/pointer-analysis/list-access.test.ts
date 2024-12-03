import { describe } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';

describe.sequential('List access', withShell(shell => {
	describe('Simple access', () => {
		assertSliced(
			label('List with single element', []), shell,
			`person <- list(name = "John")
result <- person$name`,
			['2@result'],
			`person <- list(name = "John")
result <- person$name`,
		);

		assertSliced(
			label('List with several elements', []), shell,
			`person <- list(name = "John", age = 24, is_male = TRUE)
result <- person$name`,
			['2@result'],
			`person <- list(name = "John", age = 24, is_male = TRUE)
result <- person$name`,
		);
	});

	describe('Whole list access', () => {
		assertSliced(
			label('When each argument of a list is redefined, then original list is still in slice', []), shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
result <- person`,
			['5@result'],
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
result <- person`
		);

		assertSliced(
			label('When arguments are added to an empty list, then original list is in slice', []), shell,
			`person <- list()
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
result <- person`,
			['5@result'],
			`person <- list()
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
result <- person`
		);
	});

	describe('Access with other accesses', () => {
		assertSliced(
			label('With other list', []), shell,
			`person <- list(age = 24, name = "John")
other_person <- list(age = 24, name = "John")
a <- other_person$name
result <- person$name`,
			['4@result'],
			`person <- list(age = 24, name = "John")
result <- person$name`,
		);

		assertSliced(
			label('With other accesses', []), shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
a <- person$age
b <- person$is_male
result <- person$age`,
			['4@result'],
			`person <- list(age = 24, name = "John", is_male = TRUE)
result <- person$age`,
		);
	});

	describe('Access with assignment', () => {
		assertSliced(
			label('When there is more than one assignment to the same index, then the last assignment is in the slice', []),
			shell,
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
person$name <- "Alice"
person$name <- "Malory"
result <- person$name`,
			['5@result'],
			`person$name <- "Malory"
result <- person$name`,
		);

		assertSliced(
			label('When there are assignments to the other indices, then they are not in the slice', []),
			shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
result <- person$name`,
			['5@result'],
			`person$name <- "Alice"
result <- person$name`,
		);

		assertSliced(
			label('When there are assignments to only other indices, then list is in the slice', []),
			shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
result <- person$age`,
			['4@result'],
			`person <- list(age = 24, name = "John", is_male = TRUE)
result <- person$age`,
		);
	});
}));
