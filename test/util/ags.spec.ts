import { splitArguments } from '../../src/util/args'
import { assert } from 'chai'

describe("Arguments", () => {
	describe("splitArguments", () => {
		const positive = (input: string, expected: string[]) => {
			it(`${JSON.stringify(input)}`, () => {
				assert.deepEqual(splitArguments(input), expected)
			})
		}

		positive('', [])
		positive('a', ['a'])
		positive('a b', ['a', 'b'])
		positive('argument are cool', ['argument', 'are', 'cool'])
		positive('a "b c" d', ['a', 'b c', 'd'])
		positive('a "b c" d "e f"', ['a', 'b c', 'd', 'e f'])
		positive('a \\"b c" d "e f" g', ['a', '"b', 'c d e', 'f g'])
		positive('a\\ b', ['a b'])
	})
})
