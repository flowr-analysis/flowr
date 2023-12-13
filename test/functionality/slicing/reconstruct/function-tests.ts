import { assert } from 'chai'
import { plain, Code, merge, prettyPrintCodeToString } from '../../../../src/reconstruct/helper'

describe('Functions_Reconstruct', () => {
	describe('plain', () => {
		function positive(input: string, line: number, column: number, expected: Code) {
			it(`${input} for ${line}:${column}`, () => {
				const result:Code = plain(input, {line,column})
				assert.deepStrictEqual(result,expected)
			})
		}

		for(const testCase of [
			{input: 'Hello', line: 1, column: 1, expected: [{linePart: [{part: 'Hello', loc: {line: 1, column: 1}}],indent: 0}]},
			{input: 'Hello World', line: 4, column: 3, expected: [{linePart: [{part: 'Hello World', loc: {line: 4, column: 3}}],indent: 0}]},
			{input: 'Hello\nWorld', line: 1, column: 1, expected: [{linePart: [{part: 'Hello', loc: {line: 1, column: 1}},{part: 'World', loc: {line: 2, column: 1}}],indent: 0}]},
			{input: 'Hello\nWorld', line: 3, column: 4, expected: [{linePart: [{part: 'Hello', loc: {line: 3, column: 4}},{part: 'World', loc: {line: 4, column: 4}}],indent: 0}]},
			{input: 'Hello\nWorld\n24', line: 1, column: 1, expected: [{linePart: [{part: 'Hello', loc: {line: 1, column: 1}},{part: 'World', loc: {line: 2, column: 1}},{part: '24', loc: {line: 3, column: 1}}],indent: 0}]}
		]) {
			positive(testCase.input, testCase.line, testCase.column, testCase.expected)
		}
	})
	describe.only('merge', () => {
		function positive(snipbits: Code[],expected: Code) {
			it(prettyPrintCodeToString(expected),() => {
				const result:Code = merge(snipbits)
				//console.log(JSON.stringify(result))
				assert.deepStrictEqual(result, expected)
			})
		}
		describe('single line merge', () => {
			for(const testCase of [
				{snipbit: [[{linePart: [{part: 'Hello World', loc: {line: 4, column: 3}}],indent: 0}]], expected: [{linePart: [{part: 'Hello World', loc: {line: 4, column: 3}}],indent: 0}]},
				{snipbit: [[{linePart: [{part: 'Hello', loc: {line: 1, column: 1}},{part: 'World', loc: {line: 1, column: 1}}],indent: 0}]], expected: [{linePart: [{part: 'Hello', loc: {line: 1, column: 1}},{part: 'World', loc: {line: 1, column: 1}}],indent: 0}]}
			]) {
				positive(testCase.snipbit, testCase.expected)
			}
		})
		describe('two lines merge', () => {
			const testCases = [
				//Case 1 (in order)
				{
					snipbit:  [[{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}],[{linePart: [{part: 'World', loc: {line: 1, column: 0}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 0}}], indent: 0}]
				},
				{
					snipbit:  [[{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}, {part: 'World', loc: {line: 1, column: 0}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 0}}], indent: 0}]
				},
				{
					snipbit:  [[{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}, {part: 'World', loc: {line: 1, column: 0}}], indent: 0}],[{linePart: [{part: '24', loc: {line: 1, column: 7}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 0}}, {part: '24', loc: {line: 1, column: 7}}], indent: 0}]
				},
				//Case 2 (out of order)
				{
					snipbit:  [[{linePart: [{part: 'World', loc: {line: 1, column: 0}}], indent: 0}],[{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 0}}], indent: 0}]
				},
				{
					snipbit:  [[{linePart: [{part: 'World', loc: {line: 1, column: 0}}, {part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 0}}], indent: 0}]
				},
				{
					snipbit:  [[{linePart: [{part: '24', loc: {line: 1, column: 7}}], indent: 0}], [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}, {part: 'World', loc: {line: 1, column: 0}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 0}}, {part: '24', loc: {line: 1, column: 7}}], indent: 0}]
				}
			]
			for(const testCase of testCases) {
				positive(testCase.snipbit, testCase.expected)
			}
		})
	})
})