import { assert, describe, test } from 'vitest';
import { BasePrimitiveTopics, statedSignatures } from '../../../../src/dataflow/environments/default-builtin-config';
import { PkgName } from '../../../../src/dataflow/environments/identifier';

/**
 * A primitive has no R closure, so the signature database holds no entry and no help topic for it. These are
 * what flowR carries instead, and they are only worth carrying while they name something other than the name.
 */
describe('base primitive topics', () => {
	const stated = statedSignatures();

	test('every one of them is a name flowR states for base R', () => {
		const missing = Object.keys(BasePrimitiveTopics)
			.filter(name => !(stated.get(name) ?? []).some(entry => entry.pkg === PkgName.Base));

		assert.deepStrictEqual(missing, [], 'a topic for a name flowR does not state helps nobody');
	});

	test('none of them repeats the name it documents', () => {
		const pointless = Object.entries(BasePrimitiveTopics).filter(([name, topic]) => name === topic);

		assert.deepStrictEqual(pointless, [], 'a topic equal to the name is what happens without one');
	});

	test('each topic reads as a manual page', () => {
		const odd = Object.values(BasePrimitiveTopics).filter(topic => !/^[A-Za-z.][A-Za-z0-9._-]*$/.test(topic));

		assert.deepStrictEqual(odd, [], 'a topic names an `.Rd` page, so it is a plain topic name');
	});

	test('the ones a reader is most likely to look up are there', () => {
		for(const [name, topic] of [['sin', 'Trig'], ['+', 'Arithmetic'], ['[', 'Extract'], ['if', 'Control'], ['max', 'Extremes']]) {
			assert.strictEqual(BasePrimitiveTopics[name], topic, `${name} is documented under ${topic}`);
		}
	});
});
