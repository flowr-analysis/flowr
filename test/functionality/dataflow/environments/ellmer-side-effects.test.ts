import { assert, describe, test } from 'vitest';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { UnknownSideEffect } from '../../../../src/dataflow/graph/graph';
import { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { analyze } from '../../_helper/analyzer';
import { label } from '../../_helper/label';
import { withTreeSitter } from '../../_helper/shell';

describe('ellmer side effects', withTreeSitter(parser => {
	test(label('ellmer chat calls resolve and retain unknown side effects', ['name-normal', 'call-normal', 'namespaces', 'strings', 'newlines'], ['dataflow']), async() => {
		const analyzer = await analyze(parser, 'ellmer::chat_openai()\nellmer::chat("openai")\nnchar("hello")', { sigDb: false });
		const { graph } = await analyzer.dataflow();
		const { idMap } = await analyzer.normalize();
		const effects = [...graph.unknownSideEffects].map(UnknownSideEffect.id);
		const openai = SlicingCriterion.parse('1^', idMap);
		const chat = SlicingCriterion.parse('2^', idMap);

		assert.include(Dataflow.callTargetsOf(openai, graph), NodeId.toBuiltIn('chat_openai'));
		assert.include(Dataflow.callTargetsOf(chat, graph), NodeId.toBuiltIn('chat'));
		assert.includeMembers(effects, [openai, chat]);
		assert.notInclude(effects, SlicingCriterion.parse('3^', idMap));
	});
}));
