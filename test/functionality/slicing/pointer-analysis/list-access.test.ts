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

		assertSliced(
			label('When whole list is redefined, then every list assignment before is not in slice', []), shell,
			`person <- list(age = 24, name = "John")
person$age <- 33
person$name <- "Jane"
person <- list(height = 164, is_male = FALSE)
person$height <- 199
person$is_male <- TRUE
result <- person`,
			['7@result'],
			`person <- list(height = 164, is_male = FALSE)
person$height <- 199
person$is_male <- TRUE
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
			`person <- list(age = 24, name = "John")
person$name <- "Malory"
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
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$name <- "Alice"
result <- person$name`,
		);

		assertSliced(
			label('When there are assignments to only other indices, then only list is in the slice', []),
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

	describe('Nested lists', () => {
		assertSliced(
			label('When index of nested list is overwritten, then overwrite is also in slice', []),
			shell,
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$name <- "Jane"
person$height <- 177
result <- person$grades$algebra`,
			['7@result'],
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
result <- person$grades$algebra`,
		);

		assertSliced(
			label('When index of nested list is overwritten after nesting, then overwrite is also in slice', []),
			shell,
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$name <- "Jane"
person$height <- 177
person$grades$algebra <- 4.0
person$grades$german <- 1.0
result <- person$grades$algebra`,
			['9@result'],
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades$algebra <- 4.0
result <- person$grades$algebra`,
		);

		assertSliced(
			label('When nested list is overwritten, then only overwrite list is in slice', []),
			shell,
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
grades <- list(arts <- 4.0, music <- 3.0)
grades$music <- 2.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$name <- "Jane"
person$height <- 177
result <- person$grades$music`,
			['9@result'],
			`grades <- list(arts <- 4.0, music <- 3.0)
grades$music <- 2.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
result <- person$grades$music`,
		);

		assertSliced(
			label('When nested list is overwritten after nesting, then only overwrite list is in slice', []),
			shell,
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts <- 4.0, music <- 3.0)
person$name <- "Jane"
person$height <- 177
result <- person$grades$music`,
			['8@result'],
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts <- 4.0, music <- 3.0)
result <- person$grades$music`,
		);

		assertSliced(
			label('When nested list is accessed, then accesses to nested list are in slice', []),
			shell,
			`grades <- list(algebra = 1.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
grades$algebra <- 5.0
person$name <- "Jane"
result <- person$grades`,
			['7@result'],
			`grades <- list(algebra = 1.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
result <- person$grades`,
		);

		assertSliced(
			label('When double nested list is accessed, then accesses to all nested lists are in slice', []),
			shell,
			`algebra_grades <- list(test = 1.0, exam = 3.0)
algebra_grades$test <- 4.0
grades <- list(algebra = algebra_grades, sports = 1.7)
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
person$name <- "Jane"
result <- person$grades`,
			['7@result'],
			`algebra_grades <- list(test = 1.0, exam = 3.0)
algebra_grades$test <- 4.0
grades <- list(algebra = algebra_grades, sports = 1.7)
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
result <- person$grades`,
		);
	});
}));
