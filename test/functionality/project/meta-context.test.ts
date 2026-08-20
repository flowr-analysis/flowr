import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerMetaContext, MetaPriority } from '../../../src/project/context/flowr-analyzer-meta-context';

describe('Meta context', () => {
	test('a contribution is read back', () => {
		const meta = new FlowrAnalyzerMetaContext();
		meta.contribute({ name: 'pkg', rVersion: '4.5' }, MetaPriority.Manifest);
		assert.strictEqual(meta.getProjectName(), 'pkg');
		assert.strictEqual(meta.getRVersion(), '4.5');
	});

	test('undefined fields do not overwrite what another source knew', () => {
		const meta = new FlowrAnalyzerMetaContext();
		meta.contribute({ name: 'pkg' }, MetaPriority.Manifest);
		meta.contribute({ name: undefined, title: 'T' }, MetaPriority.Description);
		assert.strictEqual(meta.getProjectName(), 'pkg');
		assert.strictEqual(meta.getProjectTitle(), 'T');
	});

	test('the more trusted source wins, whichever contributes first', () => {
		for(const descFirst of [true, false]) {
			const meta = new FlowrAnalyzerMetaContext();
			const contribute = [
				() => meta.contribute({ name: 'from-desc' }, MetaPriority.Description),
				() => meta.contribute({ name: 'from-manifest' }, MetaPriority.Manifest)
			];
			for(const c of descFirst ? contribute : contribute.reverse()) {
				c();
			}
			assert.strictEqual(meta.getProjectName(), 'from-desc', `description first: ${descFirst}`);
		}
	});

	test('an equally trusted source does not overwrite', () => {
		const meta = new FlowrAnalyzerMetaContext();
		meta.contribute({ name: 'first' }, MetaPriority.Manifest);
		meta.contribute({ name: 'second' }, MetaPriority.Manifest);
		assert.strictEqual(meta.getProjectName(), 'first');
	});

	test('a name is no namespace unless the source says so', () => {
		const meta = new FlowrAnalyzerMetaContext();
		meta.contribute({ name: 'rv-project' }, MetaPriority.Manifest);
		assert.strictEqual(meta.getProjectName(), 'rv-project');
		assert.isUndefined(meta.getNamespace(), 'a project that is no package must not claim a namespace');
	});

	test('reset clears every field', () => {
		const meta = new FlowrAnalyzerMetaContext();
		meta.contribute({ name: 'pkg', rVersion: '4.5' }, MetaPriority.Description);
		meta.reset();
		assert.isUndefined(meta.getProjectName());
		assert.isUndefined(meta.getRVersion());
	});

	test('reading asks for the contributions first', () => {
		let runs = 0;
		const meta = new FlowrAnalyzerMetaContext(() => {
			runs++;
			meta.contribute({ name: 'lazy' }, MetaPriority.Manifest);
		});
		assert.strictEqual(meta.getProjectName(), 'lazy', 'a read must not depend on someone else asking first');
		meta.getRVersion();
		// every read asks; skipping the repeated work is up to the callback, which is guarded
		assert.strictEqual(runs, 2);
	});
});
