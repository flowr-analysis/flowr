import { expect } from 'chai';
import { label } from '../../_helper/label';
import { Environment, initializeCleanEnvironments } from '../../../../src/dataflow/environments/environment';
import { assert, describe, test } from 'vitest';

describe('Initialization', () => {
	test(label('Clean creation should have no info but the default information', ['global-scope'], ['other']), () => {
		const clean = initializeCleanEnvironments();
		assert.isDefined(clean.current,'there should be a current environment');
		expect(clean.current.memory.size, 'the current environment should have no memory').to.be.equal(0);
		expect(clean.level, 'the level of the clean environment is predefined as 0').to.be.equal(0);
		expect(clean.current.parent.isBuiltInDefault, 'the parent environment is the built-in environment').to.be.equal(true);
		expect(clean.current.parent.id, 'the ID of the parent environment is predefined as 0').to.be.equal(0);
	});
	test(label('Clean creation should create independent new environments', ['lexicographic-scope'], ['other']), () => {
		const clean = initializeCleanEnvironments();
		clean.current.parent = new Environment(clean.current.parent, false);
		const newParentId = clean.current.parent.id;

		const second = initializeCleanEnvironments();
		expect(second.current.parent.id, 'the new one should have a parent, the built-in environment').to.be.equal(0);
		assert.isDefined(clean.current.parent, 'the old one should still have the parent');
		expect(clean.current.parent.id, 'parent should be unchanged').to.be.equal(newParentId);
		expect(second.current.parent.id, 'parent IDs should not be the same').not.to.be.equal(newParentId);
	});
});
