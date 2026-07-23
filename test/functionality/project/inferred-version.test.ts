import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../src/config';
import { Package } from '../../../src/project/plugins/package-version-plugins/package';

function contextWith(...packages: Package[]): FlowrAnalyzerContext {
	const ctx = new FlowrAnalyzerContext(FlowrConfig.default(), new Map());
	for(const p of packages) {
		ctx.deps.addDependency(p);
	}
	return ctx;
}

const range = (comparator: string | undefined, version: string) =>
	Package.parsePkgVersionRange(comparator, version) as NonNullable<ReturnType<typeof Package.parsePkgVersionRange>>;

describe('Inferred dependency version', () => {
	test('a declared range is what the dependency can be', () => {
		const inferred = contextWith(new Package({ name: 'cli', versionConstraints: [range('>= ', '3.0.0')] })).inferredVersion('cli');
		assert.strictEqual(inferred?.raw, '>= 3.0.0');
	});

	test('constraints of several sources are combined', () => {
		const inferred = contextWith(
			new Package({ name: 'ggplot2', versionConstraints: [range('>= ', '3.0.0')] }),
			new Package({ name: 'ggplot2', versionConstraints: [range(undefined, '3.5.1')] })
		).inferredVersion('ggplot2');
		assert.isDefined(inferred);
		assert.isTrue(inferred?.test('3.5.1'), 'the pinned version must satisfy the combined range');
		assert.isFalse(inferred?.test('3.0.0'), 'a version outside the pin must not');
	});

	test('contradicting sources leave no possible version', () => {
		const ctx = contextWith(new Package({ name: 'x', versionConstraints: [range('>= ', '2.0.0')] }));
		assert.doesNotThrow(() => ctx.deps.addDependency(new Package({ name: 'x', versionConstraints: [range(undefined, '1.5.0')] })));
		assert.isUndefined(ctx.inferredVersion('x'), 'a range nothing can satisfy must not be handed out');
		// the individual constraints stay available on the package itself
		assert.strictEqual(ctx.deps.getDependency('x')?.versionConstraints.length, 2);
	});

	test('an unknown dependency has no inferred version', () => {
		assert.isUndefined(contextWith().inferredVersion('nope'));
	});

	test('a dependency nothing constrains has no inferred version', () => {
		assert.isUndefined(contextWith(new Package({ name: 'plain' })).inferredVersion('plain'));
	});
});
