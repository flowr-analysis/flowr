import { splitAtEscapeSensitive } from '../../../src/util/args'
import { assert } from 'chai'

describe("Arguments", () => {
	describe("splitArguments", () => {
		const positive = (input: string, expected: string[], split = ' ') => {
			it(`${JSON.stringify(input)}`, () => {
				assert.deepEqual(splitAtEscapeSensitive(input, split), expected)
			})
		}

		positive('', [])
		positive('a', ['a'])
		positive('a b', ['a', 'b'])
		positive('argument are cool', ['argument', 'are', 'cool'])
		positive('a "b c" d', ['a', 'b c', 'd'])
		positive('a "b\nc" d', ['a', 'b\nc', 'd'])
		// this seems to be an error with the comparison function as it does not expand escaped characters?
		positive('a "b\\nc" d', ['a', 'b\nc', 'd'])
		positive('a "b\t\r\v\f\bc" d', ['a', 'b\t\r\v\f\bc', 'd'])
		positive('a "b c" d "e f"', ['a', 'b c', 'd', 'e f'])
		positive('a \\"b c" d "e f" g', ['a', '"b', 'c d e', 'f g'])
		positive('a\\ b', ['a b'])
	})
})
