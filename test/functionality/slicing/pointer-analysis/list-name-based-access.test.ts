import { describe } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { useConfigForTest } from '../../_helper/config';

describe.sequential('List name based access', withShell(shell => {
	const basicCapabilities = ['name-normal', 'function-calls', 'named-arguments', 'dollar-access', 'subsetting-multiple'] as const;
	useConfigForTest({ solver: { pointerTracking: true } });

	describe('Nested lists', () => {
		assertSliced(
			label('When index of nested list is overwritten, then overwrite is also in slice', basicCapabilities),
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
			label('When index of nested list is overwritten after nesting, then overwrite is also in slice', basicCapabilities),
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
			label('When nested list is overwritten, then only overwrite list is in slice', basicCapabilities),
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
			label('When nested list is overwritten after nesting, then only overwrite list is in slice', basicCapabilities),
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

		assertSliced(
			label('When nested list is accessed, then accesses to nested list are in slice', basicCapabilities),
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
			label('When nested list is accessed, then accesses to nested lists are in slice', basicCapabilities),
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

		assertSliced(
			label('When double nested list is accessed, then accesses to nested lists are in slice', basicCapabilities),
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
		
		assertSliced(
			label('When list is assigned, then accesses to list and nested lists are in slice', basicCapabilities),
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
			undefined,
			'fail-both',
		);

		assertSliced(
			label('When nested list is redefined twice, then only second redefinition is in slice', basicCapabilities),
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
			['10@result'],
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- list(arts = 4.0, music = 3.0)
person$grades$arts <- 1.0
result <- person$grades$music`,
			undefined,
			'fail-both',
		);

		assertSliced(
			label('When nested list is redefined with static value, then only static value assignment is in slice', basicCapabilities),
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
			['9@result'],
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$grades <- 3
result <- person$grades`,
			undefined,
			'fail-both',
		);

		assertSliced(
			label('When static list value is redefined with list, then only list value assignment is in slice', basicCapabilities),
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
			['9@result'],
			`grades <- list(algebra = 1.3, german = 2.0, english = 2.3, sports = 1.7)
person <- list(age = 24, name = "John", height = 164, is_male = FALSE, grades = grades)
person$name <- list(first_name = "Jane", last_name = "Doe")
person$name$first_name <- "John"
result <- person$name`,
			undefined,
			'fail-both'
		);

		describe('Access within conditionals', () => {
			assertSliced(
				label('Potential addition in nesting', basicCapabilities),
				shell,
				`person <- list(age = 24)
if(u) person$name <- "peter"
wrapper <- list(person = person)
print(wrapper$person$name)`,
				['4@print'],
				`person <- list(age = 24)
if(u) person$name <- "peter"
wrapper <- list(person = person)
print(wrapper$person$name)`,
			);

			//Currently we can not handle the indirect passing minimally and include the name line
			assertSliced(
				label('Potential addition in nesting (not needed)', basicCapabilities),
				shell,
				`person <- list(age = 24)
if(u) person$name <- "peter"
wrapper <- list(person = person)
print(wrapper$person$age)`,
				['4@print'],
				`person <- list(age = 24)
wrapper <- list(person = person)
print(wrapper$person$age)`,
				undefined,
				'fail-both',
			);
		});
	});
}));
