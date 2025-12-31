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
		{ type: KnownRoxygenTags.Description, value: 'This is a simple\nexample of a roxygen2 comment.' },
		{ type: KnownRoxygenTags.Name, value: 'example_name!' },
		{ type: KnownRoxygenTags.DocType, value: 'methods' }
	]);
});