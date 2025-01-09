import { describe, it } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { useConfigForTest } from '../../_helper/config';

describe.sequential('List access', withShell(shell => {
	const basicCapabilities = ['name-normal', 'function-calls', 'named-arguments', 'dollar-access', 'subsetting'] as const;
	useConfigForTest({ solver: { pointerTracking: true } });
	describe('Simple access', () => {
		assertSliced(label('List with single element', basicCapabilities), shell,
			'person <- list(name = "John")\nprint(person$name)',
			['2@print'],
			'person <- list(name = "John")\nprint(person$name)',
		);

		/* we reconstruct everything as every other modification could mess with the correctness of the result */
		assertSliced(label('List with several elements', basicCapabilities), shell,
			'person <- list(name = "John", age = 24, is_male = TRUE)\nprint(person$name)',
			['2@print'],
			'person <- list(name = "John", age = 24, is_male = TRUE)\nprint(person$name)'
		);
	});

	describe('Whole list access', () => {
		assertSliced(label('When each argument of a list is redefined, then original list is still in slice', basicCapabilities), shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
print(person)`,
			['5@print'],
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
print(person)`
		);

		assertSliced(label('When arguments are added to an empty list, then original list is in slice', basicCapabilities), shell,
			`person <- list()
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
print(person)`,
			['5@print'],
			`person <- list()
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
print(person)`
		);

		assertSliced(label('When whole list is redefined, then every list assignment before is not in slice', basicCapabilities), shell,
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
		assertSliced(label('With other list', basicCapabilities), shell,
			`person <- list(age = 24, name = "John")
other_person <- list(age = 24, name = "John")
a <- other_person$name
print(person$name)`,
			['4@print'],
			`person <- list(age = 24, name = "John")
print(person$name)`,
		);

		assertSliced(label('With other accesses', basicCapabilities), shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
a <- person$age
b <- person$is_male
print(person$age)`,
			['4@print'],
			`person <- list(age = 24, name = "John", is_male = TRUE)
print(person$age)`,
		);
	});

	describe('Access with assignment', () => {
		assertSliced(label('When there is more than one assignment to the same index, then the last assignment is in the slice', basicCapabilities),
			shell,
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
person$name <- "Alice"
person$name <- "Malory"
print(person$name)`,
			['5@print'],
			`person <- list(age = 24, name = "John")
person$name <- "Malory"
print(person$name)`,
		);

		assertSliced(label('When there are assignments to the other indices, then they are not in the slice', basicCapabilities),
			shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
person$age <- 33
print(person$name)`,
			['5@print'],
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$name <- "Alice"
print(person$name)`,
		);

		assertSliced(label('When there are assignments to only other indices, then only list is in the slice', basicCapabilities),
			shell,
			`person <- list(age = 24, name = "John", is_male = TRUE)
person$is_male <- FALSE
person$name <- "Alice"
result <- person$age`,
			['4@result'],
			`person <- list(age = 24, name = "John", is_male = TRUE)
result <- person$age`,
		);

		describe('Access within conditionals', () => {
			assertSliced(label('Only a potential overwrite', basicCapabilities),
				shell,
				`person <- list(age = 24)
if(u) 
			person$age <- 33
print(person$age)`,
				['4@print'],
				`person <- list(age = 24)
if(u) person$age <- 33
print(person$age)`);
			assertSliced(label('Potential wipe', basicCapabilities),
				shell,
				`person <- list(age = 24)
if(u) {
	person$age <- 33
} else {
	person$age <- 42
	person <- list()
}
print(person$age)`,
				['8@print'],
				`person <- list(age = 24)
if(u) { person$age <- 33 } else
{ person <- list() }
print(person$age)`);
			assertSliced(label('Potential addition in nesting', basicCapabilities),
				shell,
				`person <- list(age = 24)
if(u) person$name <- "peter"
wrapper <- list(person = person)
print(wrapper$person$name)`,
				['4@print'],
				`person <- list(age = 24)
if(u) person$name <- "peter"
wrapper <- list(person = person)
print(wrapper$person$name)`);
			it.fails('Currently we can not handle the indirect passing minimally and include the name line', () => {
				assertSliced(label('Potential addition in nesting (not needed)', basicCapabilities),
					shell,
					`person <- list(age = 24)
if(u) person$name <- "peter"
wrapper <- list(person = person)
print(wrapper$person$age)`,
					['4@print'],
					`person <- list(age = 24)
wrapper <- list(person = person)
print(wrapper$person$age)`);
			});
		});
	});

	describe('Nested lists', () => {
		assertSliced(label('When index of nested list is overwritten, then overwrite is also in slice', basicCapabilities),
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

		assertSliced(label('When index of nested list is overwritten after nesting, then overwrite is also in slice', basicCapabilities),
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

		assertSliced(label('When nested list is overwritten, then only overwrite list is in slice', basicCapabilities),
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

		assertSliced(label('When nested list is overwritten after nesting, then only overwrite list is in slice', basicCapabilities),
			shell,
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts = 4.0, music = 3.0)
person$name <- "Jane"
person$height <- 177
result <- person$grades$music`,
			['8@result'],
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts = 4.0, music = 3.0)
result <- person$grades$music`,
		);

		assertSliced(label('When nested list is accessed, then accesses to nested list are in slice', basicCapabilities),
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

		assertSliced(label('When nested list is accessed, then accesses to nested lists are in slice', basicCapabilities),
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

		assertSliced(label('When double nested list is accessed, then accesses to nested lists are in slice', basicCapabilities),
			shell,
			`algebra_grades <- list(test = 1.0, exam = 3.0)
algebra_grades$test <- 4.0
grades <- list(algebra = algebra_grades, sports = 1.7)
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
person$name <- "Jane"
result <- person$grades$algebra`,
			['7@result'],
			`algebra_grades <- list(test = 1.0, exam = 3.0)
algebra_grades$test <- 4.0
grades <- list(algebra = algebra_grades, sports = 1.7)
person <- list(name = "John", grades = grades)
result <- person$grades$algebra`,
		);

		it.fails('When list is assigned, then accesses to list and nested lists are in slice', () => {
			assertSliced(label('When list is assigned, then accesses to list and nested lists are in slice', basicCapabilities),
				shell,
				`algebra_grades <- list(test = 1.0, exam = 3.0)
algebra_grades$test <- 4.0
grades <- list(algebra = algebra_grades, sports = 1.7)
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
person$name <- "Jane"
result <- person`,
				['7@result'],
				`algebra_grades <- list(test = 1.0, exam = 3.0)
algebra_grades$test <- 4.0
grades <- list(algebra = algebra_grades, sports = 1.7)
grades$sports <- 1.0
person <- list(name = "John", grades = grades)
person$name <- "Jane"
result <- person`,
			);
		});

		it.fails('When nested list is redefined twice, then only second redefinition is in slice', () => {
			assertSliced(label('When nested list is redefined twice, then only second redefinition is in slice', basicCapabilities),
				shell,
				`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts = 4.0, music = 3.0)
person$grades <- list(arts = 4.0, music = 3.0)
person$name <- "Jane"
person$height <- 177
person$grades$arts <- 1.0
result <- person$grades$music`,
				['7@result'],
				`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts = 4.0, music = 3.0)
person$grades$arts <- 1.0
result <- person$grades$music`,
			);
		});

		it.fails('When nested list is redefined with static value, then only static value assignment is in slice', () => {
			assertSliced(label('When nested list is redefined with static value, then only static value assignment is in slice', basicCapabilities),
				shell,
				`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts = 4.0, music = 3.0)
person$grades <- 3
person$name <- "Jane"
person$height <- 177
result <- person$grades`,
				['7@result'],
				`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- 3
result <- person$grades`,
			);
		});

		it.fails('When static list value is redefined with list, then only list value assignment is in slice', () => {
			assertSliced(label('When static list value is redefined with list, then only list value assignment is in slice', basicCapabilities),
				shell,
				`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
grades$algebra <- 1.0
grades$sports <- 1.0
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$name <- "Jane"
person$name <- list(first_name = "Jane", last_name = "Doe")
person$name$first_name <- "John"
person$height <- 177
result <- person$name`,
				['7@result'],
				`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$name <- list(first_name = "Jane", last_name = "Doe")
person$name$first_name <- "John"
result <- person$name`,
			);
		});
	});

	describe('Config flag', () => {
		useConfigForTest({ solver: { pointerTracking: false } });
		assertSliced(label('When flag is false, then list access is not in slice', ['call-normal']), shell,
			`person <- list(age = 24, name = "John")
person$name <- "Jane"
person$age <- 23
print(person$name)`, ['4@print'], `person <- list(age = 24, name = "John")
person$name <- "Jane"
person$age <- 23
print(person$name)`
		);
	});
}));
