import { assert, describe, test } from 'vitest';
import type { RoxygenTag } from '../../../../src/r-bridge/roxygen2/roxygen-ast';
import { KnownRoxygenTags } from '../../../../src/r-bridge/roxygen2/roxygen-ast';
import { parseRoxygenComment } from '../../../../src/r-bridge/roxygen2/roxygen-parse';

describe('Parse Comments', () => {
	function check(name: string, comments: string | string[], expected: readonly RoxygenTag[]) {
		const lines = Array.isArray(comments) ? comments : comments.split('\n');
		test(name, () => {
			const parsed = parseRoxygenComment(lines);
			assert.deepStrictEqual(parsed, expected);
		});
	}
	check('Sample Description', `
#' @title Example Title
#'
#' @description This is a simple
#' example of a roxygen2 comment.
#' 
#' @name example_name!
#' @docType methods
	`, [
		{ type: KnownRoxygenTags.Title, value: 'Example Title' },
		{ type: KnownRoxygenTags.Description, value: 'This is a simple\n example of a roxygen2 comment.' },
		{ type: KnownRoxygenTags.Name, value: 'example_name!' },
		{ type: KnownRoxygenTags.DocType, value: 'methods' }
	]);
	check('Sample Function Description', `
#' This is an important function description.
#'
#' @usage sample(arg1 = NULL,
#'               arg2 = "value",
#'               special.arg = FALSE)
#'
#'
#' @param arg1 Description for argument one.
#' @param arg2 Description for argument two.
#' @param special.arg A special argument
#'
#' @description
#' This is a very long @details crazy complex description
#' that goes on 
#' and on
#' 
#' and on!
#'
#' @details
#' Detail1
#' Detail2
#'
#' Detail 3!! Jay
#' @return This returns something very important.
#' You know?!
#'
#' @references
#' Ref1
#' Ref2
#' @export
#'
#' @examples
#' x <- rnorm(1000, mean = 5, sd = 2)
#' dist <- list(name = "norm", mean = 5, sd = 2)
#'
#' ## Compute the entropy through discretization
#' even more example!
#' @keywords utilities anotherkey
#' @returns Even more retuuuhuuurn
#' @importFrom stats sd IQR
	`, [
		{ type: KnownRoxygenTags.Text, value: 'This is an important function description.' },
		{ type: KnownRoxygenTags.Usage, value: 'sample(arg1 = NULL,\n               arg2 = "value",\n               special.arg = FALSE)' },
		{ type: KnownRoxygenTags.Param, value: { name: 'arg1', description: 'Description for argument one.' } },
		{ type: KnownRoxygenTags.Param, value: { name: 'arg2', description: 'Description for argument two.' } },
		{ type: KnownRoxygenTags.Param, value: { name: 'special.arg', description: 'A special argument' } },
		{ type: KnownRoxygenTags.Description, value: 'This is a very long @details crazy complex description\n that goes on\n and on\n\n and on!' },
		{ type: KnownRoxygenTags.Details, value: 'Detail1\n Detail2\n\n Detail 3!! Jay' },
		{ type: KnownRoxygenTags.Return, value: 'This returns something very important.\n You know?!' },
		{ type: KnownRoxygenTags.References, value: 'Ref1\n Ref2' },
		{ type: KnownRoxygenTags.Export },
		{ type: KnownRoxygenTags.Examples, value: 'x <- rnorm(1000, mean = 5, sd = 2)\n dist <- list(name = "norm", mean = 5, sd = 2)\n\n ## Compute the entropy through discretization\n even more example!' },
		{ type: KnownRoxygenTags.Keywords, value: ['utilities', 'anotherkey'] },
		{ type: KnownRoxygenTags.Returns, value: 'Even more retuuuhuuurn' },
		{ type: KnownRoxygenTags.ImportFrom, value: { package: 'stats', symbols: ['sd', 'IQR'] } }
	]);
});