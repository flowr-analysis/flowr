import { assert, describe, test } from 'vitest';
import { UnknownSideEffect } from '../../../../src/dataflow/graph/graph';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { analyze } from '../../_helper/analyzer';
import { label } from '../../_helper/label';
import { assertSliceKeeps, withTreeSitter } from '../../_helper/shell';

/**
 * Chat calls of `ellmer` talk to a remote LLM, so what they do cannot be modeled.
 * These tests check how this shows up in the analysis, not which functions are registered.
 */
describe('ellmer side effects', withTreeSitter(parser => {
	async function unknownEffects(code: string) {
		const analyzer = await analyze(parser, code, { sigDb: false });
		const { graph } = await analyzer.dataflow();
		const { idMap } = await analyzer.normalize();
		const ids = new Set(graph.unknownSideEffects.values().map(UnknownSideEffect.id));
		return (criterion: SlicingCriterion) => ids.has(SlicingCriterion.parse(criterion, idMap));
	}

	test(label('a namespaced ellmer chat call is an unknown side effect', ['name-normal', 'call-normal', 'namespaces', 'newlines'], ['dataflow']), async() => {
		const isUnknown = await unknownEffects('ellmer::chat_openai()\nnchar("hello")');
		assert.isTrue(isUnknown('1^'), 'the remote model is out of reach');
		assert.isFalse(isUnknown('2@nchar'), 'ordinary calls stay unmarked');
	});

	test(label('an ellmer chat call loaded with library is an unknown side effect', ['name-normal', 'call-normal', 'strings', 'newlines'], ['dataflow']), async() => {
		const isUnknown = await unknownEffects('library(ellmer)\nchat <- chat_anthropic()\nnchar("hello")');
		assert.isTrue(isUnknown('2@chat_anthropic'), 'unqualified calls resolve to the loaded package');
		assert.isFalse(isUnknown('3@nchar'));
	});

	test(label('a function of the same name without ellmer is not marked', ['name-normal', 'call-normal', 'newlines'], ['dataflow']), async() => {
		const isUnknown = await unknownEffects('chat_openai <- function() 1\nchat_openai()');
		assert.isFalse(isUnknown('2@chat_openai'), 'a user definition shadows the package function');
	});

	assertSliceKeeps('a slice of unrelated code keeps the chat call', parser, 'x <- 1\nellmer::chat_openai()\ny <- 2\ny', '4@y',
		{ kept: ['chat_openai()', 'y <- 2'], dropped: ['x <- 1'] });
}));
