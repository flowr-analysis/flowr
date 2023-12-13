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
		describe('three lines merge', () => {
			const testCases = [
				//Case 1 (in order) 123
				{
					snipbit:  [[{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}, {part: 'World', loc: {line: 1, column: 7}}], indent: 0}],[{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0},{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]
				},
				//Case 2 (2nd Line out of order) 213
				{
					snipbit:  [[{linePart: [{part: 'World', loc: {line: 1, column: 7}}, {part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}],[{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0},{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]
				},
				//Case 3 (3rd Line out of order) 231
				{
					snipbit:  [[{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0}],[{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}], [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0},{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]
				},
				//Case 4 (reverse order) 321
				{
					snipbit:  [[{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}],[{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0}], [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0},{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]
				},
				//Case 5 () 312
				{
					snipbit:  [[{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}], [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}], [{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0},{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]
				},
				//Case 6 () 132
				{
					snipbit:  [[{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0}], [{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}], [{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0}]],
					expected: [{linePart: [{part: 'Hello', loc: {line: 0, column: 0}}], indent: 0},{linePart: [{part: 'World', loc: {line: 1, column: 7}}], indent: 0},{linePart: [{part: '24', loc: {line: 2, column: 7}}], indent: 0}]
				}
			]
			for(const testCase of testCases) {
				positive(testCase.snipbit, testCase.expected)
			}
		})
		describe('random lines merge', () => {
			function makeTestCase(lines: number): Code[] {
				const testCase = [] as Code[]
				const partPool = ['Hello', 'World', 'FlowR', 'Is', 'Incredible']
				for(let i = 0; i < lines; i++) {
					const line: Code = [{linePart: [{part: partPool[Math.random() % 5], loc: {line: Math.random() % lines, column: Math.random() % 15}}], indent: 0}]
					testCase.push(line)
				}
				return testCase
			}
			function checkTestCase(code: Code): boolean {
				let currentLoc = {line: 0, column: 0}
				for(let line = 0; line < code.length; line++) {
					for(let part = 0; part < code[line].linePart.length; part++) {
						const nextLoc = code[line].linePart[part].loc
						if(currentLoc.line <= nextLoc.line && currentLoc.column <= nextLoc.column) {
							currentLoc = nextLoc
						}
						else {
							return false
						}
					}
				}
				return true
			}
			function positive(lines: number) {
				const snipbit = makeTestCase(lines)
				it(`case with ${lines} lines`, () => {
					const merged = merge(snipbit)
					assert.isTrue(checkTestCase(merged), JSON.stringify(merged))
				})
			}
			for(let i = 0; i < 15; i++) {
				positive(i)
			}
		})
	})
})