import { assert, describe, test } from 'vitest';
import {
	groupGenericMembers,
	groupGenericOf,
	isGroupGeneric,
	RGroupGenerics,
	s3GroupGenericMembers
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

	test('matrixOps holds the one operator R puts in it', () => {
		/* getGroupMembers('matrixOps') is `%*%` alone: crossprod dispatches on no group method */
		assert.deepEqual(groupGenericMembers('matrixOps'), ['%*%']);
		assert.strictEqual(groupGenericOf('%*%'), 'matrixOps');
		assert.isUndefined(groupGenericOf('crossprod'));
		assert.isUndefined(groupGenericOf('tcrossprod'));
	});

	test('the groups hold what R says they hold', () => {
		/* checked against methods::getGroupMembers */
		assert.includeMembers([...groupGenericMembers('Math') ?? []], ['cospi', 'sinpi', 'tanpi', 'gamma', 'lgamma', 'digamma', 'trigamma']);
		assert.include(groupGenericMembers('Summary') ?? [], 'all');
		assert.strictEqual(groupGenericOf('all'), 'Summary');
		assert.strictEqual(groupGenericOf('gamma'), 'Math');
		/* S4 keeps round and signif apart in Math2, and a name in no group stays out of every one */
		assert.strictEqual(groupGenericOf('round'), 'Math2');
		assert.notInclude(groupGenericMembers('Math') ?? [], 'round');
		assert.isUndefined(groupGenericOf('mean'));
	});

	test('an S3 Math method also answers for round and signif', () => {
		/* S3 has no Math2: `round(x)` on an object with a `Math.cls` dispatches to it */
		assert.includeMembers([...s3GroupGenericMembers('Math') ?? []], ['round', 'signif', 'sin']);
		assert.deepEqual(s3GroupGenericMembers('Summary'), groupGenericMembers('Summary'));
		assert.isUndefined(s3GroupGenericMembers('print'));
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
