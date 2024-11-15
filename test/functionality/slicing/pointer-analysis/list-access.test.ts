import { describe, test } from 'vitest';
import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';

describe.sequential('List access', withShell(shell => {
	test('Simple access slice', () => {
		const slice = `person <- list(age = 24, name = "John")
a <- person$name`;

		assertSliced(
			label('Slice on list object', []), shell, slice, ['2@person'],
			`person <- list(age = 24, name = "John")
person`,
		);
		assertSliced(
			label('Slice on access operator', []), shell, slice, ['2@$'],
			`person <- list(age = 24, name = "John")
person$name`,
		);
		assertSliced(
			label('Slice on accessed index', []), shell, slice, ['2@name'],
			'person$name',
		);
		assertSliced(
			label('Slice on result of access', []), shell, slice, ['2@a'],
			`person <- list(age = 24, name = "John")
a <- person$name`,
		);
	});

	test('Access slice with noise', () => {
		const slice = `person <- list(age = 24, name = "John")
other_person <- list(age = 24, name = "John")
b <- person$age
a <- person$name`;

		assertSliced(
			label('Slice on list object', []), shell, slice, ['4@person'],
			`person <- list(age = 24, name = "John")
person`,
		);
		assertSliced(
			label('Slice on access operator', []), shell, slice, ['4@$'],
			`person <- list(age = 24, name = "John")
person$name`,
		);
		assertSliced(
			label('Slice on accessed index', []), shell, slice, ['4@name'],
			'person$name',
		);
		assertSliced(
			label('Slice on result of access', []), shell, slice, ['4@a'],
			`person <- list(age = 24, name = "John")
a <- person$name`,
		);
	});

	test('Access slice with noise and multiple accesses', () => {
		const slice = `person <- list(age = 24, name = "John")
b <- person$name
a <- person$age
c <- person$name`;

		assertSliced(
			label('Slice on list object', []), shell, slice, ['4@person'],
			`person <- list(age = 24, name = "John")
person`,

		);
		assertSliced(
			label('Slice on access operator', []), shell, slice, ['4@$'],
			`person <- list(age = 24, name = "John")
person$name`,
		);
		assertSliced(
			label('Slice on accessed index', []), shell, slice, ['4@name'],
			'person$name',
		);
		assertSliced(
			label('Slice on result of access', []), shell, slice, ['4@c'],
			`person <- list(age = 24, name = "John")
c <- person$name`,
		);
	});

	test('Access slice with previous assignment', () => {
		const slice = `person <- list(age = 24, name = "John")
person$name <- "Bob"
a <- person$name`;

		assertSliced(
			label('Slice on list object', []), shell, slice, ['3@person'],
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
person`,

		);
		assertSliced(
			label('Slice on access operator', []), shell, slice, ['3@$'],
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
person$name`,
		);
		assertSliced(
			label('Slice on accessed index', []), shell, slice, ['3@name'],
			'person$name',
		);
		assertSliced(
			label('Slice on result of access', []), shell, slice, ['3@a'],
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
a <- person$name`,
		);
	});

	test.fails('Access slice with previous assignment to other index', () => {
		const slice = `person <- list(age = 24, name = "John")
person$name <- "Bob"
person$age <- 25
a <- person$name`;

		assertSliced(
			label('Slice on list object', []), shell, slice, ['4@person'],
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
person`,

		);
		assertSliced(
			label('Slice on access operator', []), shell, slice, ['4@$'],
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
person$name`,
		);
		assertSliced(
			label('Slice on accessed index', []), shell, slice, ['4@name'],
			'person$name',
		);
		assertSliced(
			label('Slice on result of access', []), shell, slice, ['4@a'],
			`person <- list(age = 24, name = "John")
person$name <- "Bob"
a <- person$name`,
		);
	});
}));
