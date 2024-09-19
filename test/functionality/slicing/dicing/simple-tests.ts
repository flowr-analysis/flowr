import { assertDiced, withShell } from '../../_helper/shell'
import type { SlicingCriteria } from '../../../../src/slicing/criterion/parse'
import type { TestLabel } from '../../_helper/label'
import { label } from '../../_helper/label'

describe.only('Simple', withShell(shell => {
	describe('Base Dicing Cases', () => {
		const testcases: { label: TestLabel, input: string, endCriterion: SlicingCriteria, startCriterion: SlicingCriteria, expected: string }[]
		= [
			{ label: label('Simple Example for a', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b', endCriterion: ['3@c'] as SlicingCriteria, startCriterion: ['1@a'] as SlicingCriteria, expected: 'a <- 3\nc <- a + b' },
			{ label: label('Simple Example for b', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b', endCriterion: ['3@c'] as SlicingCriteria, startCriterion: ['2@b'] as SlicingCriteria, expected: 'b <- 4\nc <- a + b' },
			{ label: label('Extended Example', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b\nd <- 5\ne <- d + c', endCriterion: ['5@e'] as SlicingCriteria, startCriterion: ['4@d'] as SlicingCriteria, expected: 'd <- 5\ne <- d + c' },
			{ label: label('Multiple Start Points', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b\nd <- 5\ne <- d + c', endCriterion: ['5@e'] as SlicingCriteria, startCriterion: ['4@d', '3@c'] as SlicingCriteria, expected: 'c <- a + b\nd <- 5\ne <- d + c' },
			{ label: label('Multiple End Points', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b\nd <- b + 5\ne <- d + c', endCriterion: ['4@d', '3@c'] as SlicingCriteria, startCriterion: ['2@b'] as SlicingCriteria, expected: 'b <- 4\nc <- a + b\nd <- b + 5' },
		]

		for(const testcase of testcases) {
			assertDiced(testcase.label, shell, testcase.input, testcase.startCriterion, testcase.endCriterion, testcase.expected)
		}
	})

	describe('Dicing for Loops', () => {
		const fibWhile = `x <- 1
y <- 1
i <- 0
while (i < 10) {
  h <- x
  x <- x + y
  y <- h
  i <- i + 1
}
cat(x)`

		assertDiced(label('Simple while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, ['2@y'], ['10@x'], 'y <- 1\nwhile(i < 10) x <- x + y\nx')
		assertDiced(label('Complex while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, ['2@y', '1@x'], ['10@x'], 'x <- 1\ny <- 1\nwhile(i < 10) x <- x + y\nx')
		assertDiced(label('End in while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, ['1@x'], ['7@y'], 'x <- 1\nwhile(i < 10) {\n    h <- x\n    x <- x + y\n    y <- h\n}')
		assertDiced(label('Start in while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, ['6@x'], ['10@x'], 'while(i < 10) x <- x + y\nx')
		assertDiced(label('Dice in while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, ['5@x'], ['7@y'], 'while(i < 10) {\n    h <- x\n    y <- h\n}')

	})

	describe('Dicing with functions', () => {
		const code = `x <- function(a, b) {
  y <- 10
  y <- y + a
  y * b
}
c <- 2
d <- 10
z <- x(d, c)`

		assertDiced(label('Simple function', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, ['6@c'], ['8@z'], 'x <- { y * b }\nc <- 2\nz <- x(d,c)')
		assertDiced(label('Start in function paramenter', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, ['1@a'], ['8@z'], 'x <- function(a, b) {\n        y <- a\n        y * b\n    }\nx(d, c)')
		assertDiced(label('Start in function', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, ['3@a'], ['8@z'], 'y <- a\ny * b')
		assertDiced(label('Cuts out function parameter', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, ['1@x'], ['8@z'], 'x <- { y * b }\nx(d, c)')
	})
}))