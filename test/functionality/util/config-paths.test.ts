import { assert, describe, test } from 'vitest';
import { label } from '../_helper/label';
import { FlowrConfig } from '../../../src/config';

/** A configuration edit as the lines it changed, which is what a link, a command line or a report carries. */
describe('Config paths', () => {
	/** the default configuration with those lines applied, which is what a shared edit amounts to */
	const withKeys = (...lines: readonly string[]): FlowrConfig => FlowrConfig.applyPaths(lines);

	test.each([
		['a flag deep in the tree', ['semantics.environment.overwriteBuiltIns.loadDefaults=false']],
		['a flag at the root', ['ignoreSourceCalls=true']],
		['two keys at once', ['solver.sigdb.enabled=false', 'ignoreLoadCalls=true']],
		['an array', ['solver.sigdb.additionalPaths=["/a","/b"]']],
		['a string', ['solver.variables="builtin"']]
	])('%s survives the round trip', (_what, lines) => {
		const config = withKeys(...lines);
		assert.notDeepEqual(config, FlowrConfig.default(), 'the edit took');
		assert.deepStrictEqual(FlowrConfig.applyPaths(FlowrConfig.changedPaths(config)), config);
	});

	test(label('an untouched configuration changed nothing', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(FlowrConfig.changedPaths(FlowrConfig.default()), []);
	});

	test(label('a path is shortened to what still names it alone', ['name-normal'], ['other']), () => {
		const paths = FlowrConfig.changedPaths(withKeys('semantics.environment.overwriteBuiltIns.loadDefaults=false'));
		assert.deepStrictEqual(paths, ['se.e.o.l=false'], '`se` because `solver` shares its first letter');
		assert.isBelow(paths[0].length, 'semantics.environment.overwriteBuiltIns.loadDefaults=false'.length / 3);
	});

	test(label('the full path is read as well, so an older link still opens', ['name-normal'], ['other']), () => {
		const written = FlowrConfig.applyPaths(['semantics.environment.overwriteBuiltIns.loadDefaults=false']);
		assert.isFalse(written.semantics.environment.overwriteBuiltIns.loadDefaults);
	});

	test(label('what cannot be read is left alone rather than guessed at', ['name-normal'], ['other']), () => {
		const untouched = JSON.stringify(FlowrConfig.default());
		for(const line of ['nonsense', '', '=false', 'so.si.en=not json', 'no.such.key=1', 's.e.o.l=false']) {
			assert.strictEqual(JSON.stringify(FlowrConfig.applyPaths([line])), untouched, `${JSON.stringify(line)} sets nothing`);
		}
	});
});
