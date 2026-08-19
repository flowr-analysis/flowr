import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';
import { MemorySignatureSource, memorySourceOfPackages } from '../../../src/project/sigdb/memory-source';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { FlowrAnalyzerPackageVersionsSigDbPlugin, SigDbPluginName } from '../../../src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin';
import { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { NoEdges } from '../../../src/dataflow/graph/graph';

/**
 * The source the playground ships instead of a database file: it has to answer what a package brings into
 * scope well enough for an attach to resolve, which is what these check.
 */
describe('In-memory signature source', withTreeSitter(parser => {
	/* the shape a page bakes: the version and its release date, then the exports */
	const source = memorySourceOfPackages({ dplyr: ['', '', 'filter', 'mutate'], tibble: ['', '', 'tibble'] });

	test(label('answers what it was given', ['name-normal'], ['other']), () => {
		assert.deepStrictEqual(source.packageNames().sort(), ['dplyr', 'tibble']);
		assert.isTrue(source.has('dplyr'));
		assert.isFalse(source.has('data.table'));
		assert.deepStrictEqual([...source.lookup('dplyr')?.exported ?? []], ['filter', 'mutate']);
		assert.isUndefined(source.lookup('data.table'));
		assert.deepStrictEqual([...source.packagesExporting('filter')], ['dplyr']);
	});

	test(label('a baked version is what the exports are said to come from', ['name-normal'], ['other']), () => {
		const versioned = memorySourceOfPackages({ dplyr: ['1.1.4', '2023-11-17', 'filter'] });
		assert.strictEqual(String(versioned.latestVersion('dplyr')), '1.1.4');
		assert.isTrue(versioned.hasVersion('dplyr', '1.1.4'));
		assert.deepStrictEqual(versioned.releaseDates('dplyr').map(r => String(r.version)), ['1.1.4']);
		assert.strictEqual(versioned.releaseDate('dplyr')?.toISOString().slice(0, 10), '2023-11-17');
	});

	test(label('a source given no version claims none', ['name-normal'], ['other']), () => {
		assert.isUndefined(source.latestVersion('dplyr'), 'no release to name');
		assert.isFalse(source.hasVersion('dplyr', '1.1.4'), 'and none to confirm');
		assert.strictEqual(source.lookup('dplyr')?.version, '', 'the exports are known, the release they are from is not');
		/* asked for a version it cannot tell apart, it still answers with what it has */
		assert.deepStrictEqual([...source.lookup('dplyr', '1.1.4')?.exported ?? []], ['filter', 'mutate']);
		const versioned = new MemorySignatureSource({ dplyr: { version: '1.1.4', exported: ['filter'] } });
		assert.isTrue(versioned.hasVersion('dplyr', '1.1.4'));
		assert.isUndefined(versioned.lookup('dplyr', '1.0.0'), 'a version it does know, it can rule out');
	});

	test(label('the class owner is the package registering it', ['name-normal'], ['other']), () => {
		const owning = new MemorySignatureSource({ zoo: { exported: ['zoo', 'print.zoo'], s3Classes: ['zoo'] } });
		assert.strictEqual(owning.classOwner('zoo'), 'zoo');
		assert.isUndefined(owning.classOwner('data.frame'));
	});

	test(label('an attach resolved from it reaches the package function', ['function-calls', 'library-loading'], ['dataflow']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
			/* exactly what the playground does: no database file, one source held in memory */
			.unregisterPlugins(SigDbPluginName)
			.registerPlugins(new FlowrAnalyzerPackageVersionsSigDbPlugin(source))
			.build();
		analyzer.addRequest({ request: 'text', content: 'library(dplyr)\ndf <- data.frame(id = 1:3)\nfilter(df, id > 2)' });
		const dataflow = await analyzer.dataflow();
		const idMap = (await analyzer.normalize()).idMap;
		const targets = [...dataflow.graph.outgoingEdges(SlicingCriterion.parse('3@filter', idMap)) ?? NoEdges].map(([target]) => target);
		assert.include(targets, NodeId.fromPkgFn('dplyr', 'filter'), 'the call reaches dplyr, not the filter of stats');
		assert.include(targets, SlicingCriterion.parse('1@library', idMap), 'and reads the load that attached it');
	});
}));
