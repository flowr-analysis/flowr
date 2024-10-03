import { assertDiced, assertDicedIds, withShell } from '../../_helper/shell'
import type { DicingCriterion } from '../../../../src/slicing/criterion/parse'
import type { TestLabel } from '../../_helper/label'
import { label } from '../../_helper/label'
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id'

describe('Simple', withShell(shell => {
	describe('Checks for IDs', () => {
		const testcases: { label: TestLabel, input: string, endCriterion: DicingCriterion, startCriterion: DicingCriterion, expected: ReadonlySet<NodeId> }[]
		= [
			{ label: label('Simple Example', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b', endCriterion: { type: 'union', criteria: ['3@c'] }, startCriterion: { type: 'union', criteria: ['1@a'] }, expected: new Set([6, 9, 10, 7, 0, 2]) as ReadonlySet<NodeId> }
		]

		for(const testcase of testcases) {
			assertDicedIds(testcase.label, shell, testcase.input, testcase.startCriterion, testcase.endCriterion, testcase.expected)
		}
	})

	describe('Base Dicing Cases', () => {
		const testcases: { label: TestLabel, input: string, endCriterion: DicingCriterion, startCriterion: DicingCriterion, expected: string }[]
		= [
			{ label: label('Simple Example for a', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b', endCriterion: { type: 'union', criteria: ['3@c'] }, startCriterion: { type: 'union', criteria: ['1@a'] }, expected: 'a <- 3\nc <- a + b' },
			{ label: label('Simple Example for b', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b', endCriterion: { type: 'union', criteria: ['3@c'] }, startCriterion: { type: 'union', criteria: ['2@b'] }, expected: 'b <- 4\nc <- b' },
			{ label: label('Extended Example', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b\nd <- 5\ne <- d + c', endCriterion: { type: 'union', criteria: ['5@e'] }, startCriterion: { type: 'union', criteria: ['4@d'] }, expected: 'd <- 5\ne <- d + c' },
			{ label: label('Multiple Start Points', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b\nd <- 5\ne <- d + c', endCriterion: { type: 'union', criteria: ['5@e'] }, startCriterion: { type: 'union', criteria: ['4@d', '3@c'] }, expected: 'c <- a + b\nd <- 5\ne <- d + c' },
			{ label: label('Multiple End Points', ['assignment-functions', 'binary-operator']), input: 'a <- 3\nb <- 4\nc <- a + b\nd <- b + 5\ne <- d + c', endCriterion: { type: 'union', criteria: ['4@d', '3@c'] }, startCriterion: { type: 'union', criteria: ['2@b'] }, expected: 'b <- 4\nc <- b\nd <- b + 5' },
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

		assertDiced(label('Simple while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'union', criteria: ['2@y'] }, { type: 'union', criteria: ['10@x'] }, 'y <- 1\nwhile(i < 10) x <- y\nx')
		assertDiced(label('Complex while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'union', criteria: ['2@y', '1@x'] }, { type: 'union', criteria: ['10@x'] }, 'x <- 1\ny <- 1\nwhile(i < 10) x <- x + y\nx')
		assertDiced(label('End in while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'union', criteria: ['1@x'] }, { type: 'union', criteria: ['7@y'] }, 'x <- 1\nwhile(i < 10) {\n    h <- x\n    x <- x + y\n    y <- h\n}')
		assertDiced(label('Start in while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'union', criteria: ['6@x'] }, { type: 'union', criteria: ['10@x'] }, 'while(i < 10) x <- x + y\nx')
		assertDiced(label('Dice in while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'union', criteria: ['5@x'] }, { type: 'union', criteria: ['7@y'] }, 'while(i < 10) {\n    h <- x\n    y <- h\n}')

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

		assertDiced(label('Simple function', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, { type: 'union', criteria: ['6@c'] }, { type: 'union', criteria: ['8@z'] }, 'x <- function(a, b) { y * b }\nc <- 2\nx(d, c)')
		assertDiced(label('Start in function paramenter', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, { type: 'union', criteria: ['1@a'] }, { type: 'union', criteria: ['8@z'] }, 'x <- function(a, b) {\n        y <- a\n        y * b\n    }\nx(d, c)')
		assertDiced(label('Start in function', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, { type: 'union', criteria: ['3@a'] }, { type: 'union', criteria: ['8@z'] }, 'y <- a\ny * b')
		assertDiced(label('Cuts out function parameter', ['assignment-functions', 'binary-operator', 'function-calls', 'function-definitions']), shell, code, { type: 'union', criteria: ['1@x'] }, { type: 'union', criteria: ['8@z'] }, 'x <- { y * b }\nx(d, c)')
	})

	describe.only('Dicing with ifs', () => {
		const ifCode = `x <- 4
if(x > 5) {
    x <- 3
} else {
    x <- 6
}
cat(x)`
		assertDiced(label('Simple If', ['assignment-functions', 'binary-operator', 'control-flow']), shell, ifCode, { type: 'union', criteria: ['2@x'] }, { type: 'union', criteria: ['5@x'] }, 'if(x > 5) { x <- 3 } else\n{ x <- 6 }')
		assertDiced(label('Simple If', ['assignment-functions', 'binary-operator', 'control-flow']), shell, ifCode, { type: 'intersection', criteria: ['1@x', '3@x'] }, { type: 'union', criteria: ['5@x'] }, 'if(x > 5) { x <- 3 } else\n{ x <- 6 }')
		assertDiced(label('Simple If', ['assignment-functions', 'binary-operator', 'control-flow']), shell, ifCode, { type: 'union', criteria: ['2@x'] }, { type: 'intersection', criteria: ['5@x', '3@x'] }, 'if(x > 5) { x <- 3 } else\n{ x <- 6 }')

	})

	describe('Intersection dicing', () => {
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

		assertDicedIds(label('Simple Intersection ID Test', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'intersection', criteria: ['1@x', '2@y'] }, { type: 'union', criteria: ['10@x'] }, new Set([33, 17, 20, 21, 31]))
		assertDicedIds(label('Excluding while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'intersection', criteria: ['1@x', '6@x'] }, { type: 'union', criteria: ['10@x'] }, new Set([33, 17, 21, 31]))
		assertDicedIds(label('If Test', ['assignment-functions', 'control-flow', 'binary-operator']), shell, 'x <- 4\nif(x < 5) {\n    x <- 6\n} else {\n    x <- 3\n}\ncat(x)', { type: 'intersection', criteria: ['1@x', '2@if'] }, { type: 'union', criteria: ['7@x'] }, new Set([20, 8, 14, 18, 16, 11, 17, 5, 10]))
		assertDicedIds(label('If Test (two end criteria)', ['assignment-functions', 'control-flow', 'binary-operator']), shell, 'x <- 4\nif(x < 5) {\n    x <- 6\n} else {\n    x <- 3\n}\ncat(x)', { type: 'union', criteria: ['1@x'] }, { type: 'intersection', criteria: ['3@x', '7@x'] }, new Set([20, 8, 14, 18, 16, 11, 17, 5, 10]))
	})

	describe('Symetrical Difference dicing', () => {
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

		assertDicedIds(label('Simple Difference ID Test', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'symetrical difference', criteria: ['1@x', '2@y'] }, { type: 'union', criteria: ['10@x'] }, new Set([0, 3, 5, 19, 2, 18]))
		assertDicedIds(label('Excluding while', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'symetrical difference', criteria: ['1@x', '6@x'] }, { type: 'union', criteria: ['10@x'] }, new Set([0, 20, 18, 2]))
		assertDicedIds(label('If Test', ['assignment-functions', 'control-flow', 'binary-operator']), shell, 'x <- 4\nif(x < 5) {\n    x <- 6\n} else {\n    x <- 3\n}\ncat(x)', { type: 'symetrical difference', criteria: ['1@x', '2@if'] }, { type: 'union', criteria: ['7@x'] }, new Set([3, 0, 2]))
		assertDicedIds(label('Difference of two endings', ['assignment-functions', 'binary-operator', 'while-loop']), shell, fibWhile, { type: 'union', criteria: ['1@x'] }, { type: 'symetrical difference', criteria: ['7@y', '4@while'] }, new Set([]))
	})
}))