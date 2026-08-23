import { assert, describe, test } from 'vitest';
import {
	groupGenericMembers,
	groupGenericOf,
	isGroupGeneric,
	RGroupGenerics
} from '../../../../src/dataflow/environments/group-generics';

describe('Group-generic expansion', () => {
	test('a method on a group answers for every member it covers', () => {
		assert.include(groupGenericMembers('Math') ?? [], 'sin');
		assert.include(groupGenericMembers('Summary') ?? [], 'range');
		assert.deepEqual(groupGenericMembers('Math2'), ['round', 'signif']);
	});

	test('Ops is flattened to its operators, not to the groups it splits into', () => {
		const ops = groupGenericMembers('Ops') ?? [];
		assert.includeMembers([...ops], ['+', '==', '&', '!'], 'every member is a name a call may use');
		assert.notInclude(ops, 'Arith');
		assert.notInclude(ops, 'Compare');
	});

	test('matrixOps is a group like the others', () => {
		assert.deepEqual(groupGenericMembers('matrixOps'), ['%*%', 'crossprod', 'tcrossprod']);
		assert.strictEqual(groupGenericOf('%*%'), 'matrixOps');
		assert.strictEqual(groupGenericOf('crossprod'), 'matrixOps');
	});

	test('a name in no group has none', () => {
		assert.isUndefined(groupGenericMembers('print'));
		assert.isUndefined(groupGenericOf('print'));
		assert.isFalse(isGroupGeneric('print'));
		assert.isTrue(isGroupGeneric('Ops'));
	});

	test('every member maps back to a group, Ops excepted', () => {
		for(const [group, members] of Object.entries(RGroupGenerics)) {
			if(group === 'Ops') {
				continue;
			}
			for(const member of members) {
				assert.strictEqual(groupGenericOf(member), group, `${member} is in ${group}`);
			}
		}
	});
});
