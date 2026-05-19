import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import fs from 'fs';
import path from 'path';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import { getVarsAndTypesFromShell } from '../../../project/plugin/load-pipeline/load-pipeline.test';

describe('load', withTreeSitter(parser => {
	const dir = 'test/testfiles/project/plugins/rda-files/zenodo';
	const files = fs.readdirSync(dir)
		.filter(file => file.toLowerCase().endsWith('.rdata') || file.toLowerCase().endsWith('.rda'))
		.map(file => path.join(dir, file));

	for(const file of files) {
		const rShell = new RShellExecutor();
		const varsAndTypesFromShell = getVarsAndTypesFromShell(file, rShell);
		rShell.close();

		if(!varsAndTypesFromShell || varsAndTypesFromShell.size === 0) {
			continue;
		}

		let graph = emptyGraph();
		for(const [varName] of varsAndTypesFromShell) {
			console.warn(`${varName}`);
			const syntheticId = `3:loaded:${varName.replaceAll('.', '_')}`;
			graph = graph.defineVariable(syntheticId);
		}

		assertDataflow(
			label(`load defines variables from ${path.basename(file)}`, ['name-normal']),
			parser,
			`load("${file}")`,
			graph,
			{ expectIsSubgraph: true }
		);
	}
}));