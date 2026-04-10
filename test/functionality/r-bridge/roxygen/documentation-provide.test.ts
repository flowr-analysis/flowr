import { assert, describe, test } from 'vitest';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type { Documentation } from '../../../../src/r-bridge/roxygen2/documentation-provider';
import { getDocumentationOf } from '../../../../src/r-bridge/roxygen2/documentation-provider';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../../_helper/shell';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { KnownRoxygenTags } from '../../../../src/r-bridge/roxygen2/roxygen-ast';


describe('Provide Comments', withTreeSitter(ts => {
	function check(code: string, requests: Record<SingleSlicingCriterion, Documentation>): void {
		test.each(Object.entries(requests))('Provide docs for criterion $0', async(request, expect) => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
			analyzer.addRequest(requestFromInput(code));
			const normalize = await analyzer.normalize();
			const criterion = slicingCriterionToId(request as SingleSlicingCriterion, normalize.idMap);
			const docs = getDocumentationOf(criterion, normalize.idMap);
			assert.deepStrictEqual(docs, expect);
		});
	}

	check(`
#' This is an important function description.
#'
#' @param arg1 Description for argument one.
#' @param arg2 Description for argument two.
#' @param special.arg A special argument
f <- function(arg1 = NULL, arg2 = "value", special.arg = FALSE) {
  return(TRUE)
}

#' Another function
#' @inheritParams f
#' @param x Some x value
#' @param arg1 Description for argument one.
g <- function(x, arg1, arg2) { }
	`, {
		'7@f': [
			{ type: KnownRoxygenTags.Text, value: 'This is an important function description.' },
			{ type: KnownRoxygenTags.Param, value: { name: 'arg1', description: 'Description for argument one.' } },
			{ type: KnownRoxygenTags.Param, value: { name: 'arg2', description: 'Description for argument two.' } },
			{ type: KnownRoxygenTags.Param, value: { name: 'special.arg', description: 'A special argument' } }
		],
		'$3':   { type: KnownRoxygenTags.Param, value: { name: 'arg1', description: 'Description for argument one.' } },
		'$6':   { type: KnownRoxygenTags.Param, value: { name: 'arg2', description: 'Description for argument two.' } },
		'$9':   { type: KnownRoxygenTags.Param, value: { name: 'special.arg', description: 'A special argument' } },
		'15@g': [
			{ type: KnownRoxygenTags.Text, value: 'Another function' },
			// is expanded!
			{ type: KnownRoxygenTags.Param, value: { name: 'arg2', description: 'Description for argument two.' } },
			{ type: KnownRoxygenTags.Param, value: { name: 'special.arg', description: 'A special argument' } },
			{ type: KnownRoxygenTags.Param, value: { name: 'x', description: 'Some x value' } },
			{ type: KnownRoxygenTags.Param, value: { name: 'arg1', description: 'Description for argument one.' } }
		],
		'$21': { type: KnownRoxygenTags.Param, value: { name: 'x', description: 'Some x value' } },
		'$23': { type: KnownRoxygenTags.Param, value: { name: 'arg1', description: 'Description for argument one.' } },
		'$25': { type: KnownRoxygenTags.Param, value: { name: 'arg2', description: 'Description for argument two.' } } // expanded
	});
}));
