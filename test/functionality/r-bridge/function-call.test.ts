import { assert, describe, test } from 'vitest';
import { RFunctionCall } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../src/r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../../../src/dataflow/environments/identifier';
import type { RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model';

function callOf(content: Identifier): RNode {
	return { type: RType.FunctionCall, named: true, functionName: { type: RType.Symbol, content } } as unknown as RNode;
}

describe('RFunctionCall.isNamed', () => {
	const plain = callOf('filter');
	const qualified = callOf(Identifier.make('filter', 'dplyr'));
	const other = callOf(Identifier.make('filter', 'stats'));
	test('without a name, any named call', () => {
		assert.isTrue(RFunctionCall.isNamed(plain));
		assert.isFalse(RFunctionCall.isNamed({ type: RType.FunctionCall, named: false } as unknown as RNode));
	});
	test('a plain name ignores the namespace', () => {
		for(const call of [plain, qualified, other]) {
			assert.isTrue(RFunctionCall.isNamed(call, 'filter'));
		}
		assert.isFalse(RFunctionCall.isNamed(plain, 'select'));
	});
	test('a namespaced name only holds for that namespace', () => {
		const dplyr = Identifier.make('filter', 'dplyr');
		assert.isTrue(RFunctionCall.isNamed(qualified, dplyr));
		assert.isFalse(RFunctionCall.isNamed(other, dplyr));
		assert.isFalse(RFunctionCall.isNamed(plain, dplyr));
	});
	test('a set holds plain names', () => {
		const names = new Set(['filter', 'select']);
		assert.isTrue(RFunctionCall.isNamed(qualified, names));
		assert.isFalse(RFunctionCall.isNamed(callOf('mutate'), names));
	});
});
