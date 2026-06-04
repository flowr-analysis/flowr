import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import fs from 'fs';
import path from 'path';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import { getVarsAndTypesFromShell } from '../../../project/plugin/load-pipeline/load-pipeline.test';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import { builtInId } from '../../../../../src/dataflow/environments/built-in';
import { defaultConfigOptions } from '../../../../../src/config';

describe('load', withTreeSitter(parser => {
	const dir = 'test/testfiles/project/plugins/rda-files/zenodo';
	const files = fs.readdirSync(dir)
		.filter(file => file.toLowerCase().endsWith('.rdata') || file.toLowerCase().endsWith('.rda'))
		.map(file => path.join(dir, file));

	describe('defines variables', () => {
		for(const file of files) {
			const rShell = new RShellExecutor();
			const varsAndTypesFromShell = getVarsAndTypesFromShell(file, rShell);
			rShell.close();

			if(!varsAndTypesFromShell || varsAndTypesFromShell.size === 0) {
				continue;
			}

			let graph = emptyGraph();
			for(const [varName, varType] of varsAndTypesFromShell) {
				const syntheticId = `3:loaded:${varName.replaceAll('.', '_')}`;
				const cds = [{ id: '3', when: true }];

				if(varType === 'closure' || varType === 'special' || varType === 'builtin') {
					const fdefId = `${syntheticId}:fdef`;
					graph = graph.defineFunction(fdefId, [], {
						entryPoint:        fdefId,
						graph:             new Set(),
						out:               [],
						in:                [],
						unknownReferences: [],
						hooks:             [],
						environment:       defaultEnv(),
					}, { cds });
					graph = graph.defineVariable(syntheticId, undefined, { cds });
					graph = graph.definedBy(syntheticId, fdefId);
				} else {
					graph = graph.defineVariable(syntheticId, undefined, { cds });
				}
			}

			assertDataflow(
				label(`load defines variables from ${path.basename(file)}`, ['name-normal']),
				parser,
				`load("${file}")`,
				graph,
				{ expectIsSubgraph: true }
			);
		}
	});

	describe('overwrite behavior', () => {
		for(const file of files) {
			const rShell = new RShellExecutor();
			const varsAndTypesFromShell = getVarsAndTypesFromShell(file, rShell);
			rShell.close();

			if(!varsAndTypesFromShell || varsAndTypesFromShell.size === 0) {
				continue;
			}

			const firstEntry = [...varsAndTypesFromShell.entries()][0];
			if(!firstEntry) {
				continue;
			}
			const [firstVar] = firstEntry;
			const escapedFirstVar = firstVar.replaceAll('.', '_');

			assertDataflow(
				label(`loading ${path.basename(file)} overwrites an existing variable`, ['name-normal']),
				parser,
				`${firstVar} <- 42\nload("${file}")\nprint(${firstVar})`,
				emptyGraph()
					.use(`3@${firstVar}`, firstVar)
					.reads(`3@${firstVar}`, `6:loaded:${escapedFirstVar}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);

			assertDataflow(
				label(`assignment overwrites loaded variable from ${path.basename(file)}`, ['name-normal']),
				parser,
				`load("${file}")\n${firstVar} <- 42\nprint(${firstVar})`,
				emptyGraph()
					.use(`3@${firstVar}`, firstVar)
					.reads(`3@${firstVar}`, `2@${firstVar}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);
		}
	});

	describe('function call', () => {
		for(const file of files) {
			const rShell = new RShellExecutor();
			const varsAndTypesFromShell = getVarsAndTypesFromShell(file, rShell);
			rShell.close();

			const firstClosure = [...varsAndTypesFromShell.entries()].find(([, type]) => type === 'closure');
			if(!firstClosure) {
				continue;
			}
			const [closureName] = firstClosure;
			const escapedName = closureName.replaceAll('.', '_');

			assertDataflow(
				label(`function from load is callable in ${path.basename(file)}`, ['name-normal']),
				parser,
				`load("${file}")\n${closureName}()`,
				emptyGraph()
					.defineVariable(`3:loaded:${escapedName}`, undefined, { cds: [{ id: 3, when: true }] })
					.defineFunction(`3:loaded:${escapedName}:fdef`, [], {
						entryPoint:        `3:loaded:${escapedName}:fdef`,
						graph:             new Set(),
						out:               [],
						in:                [],
						unknownReferences: [],
						hooks:             [],
						environment:       defaultEnv()
					}, { cds: [{ id: 3, when: true }] })
					.definedBy(`3:loaded:${escapedName}`, `3:loaded:${escapedName}:fdef`)
					.reads(`2@${closureName}`, `3:loaded:${escapedName}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);
		}
	});

	describe('ignore load calls config', () => {
		const rShell = new RShellExecutor();
		const varsAndTypesFromShell = getVarsAndTypesFromShell(files[0], rShell);
		rShell.close();
		const firstEntry = [...varsAndTypesFromShell.entries()][0];
		if(firstEntry) {
			const [firstVar] = firstEntry;
			const escapedFirstVar = firstVar.replaceAll('.', '_');
			assertDataflow(
				label('load is ignored when ignoreLoadCalls is true', ['name-normal']),
				parser,
				`load("${files[0]}")`,
				emptyGraph(),
				{
					expectIsSubgraph:    true,
					mustNotHaveVertices: new Set([`3:loaded:${escapedFirstVar}`])
				}, 0, { ...defaultConfigOptions, ignoreLoadCalls: true }
			);
		}
	});

	describe('file not found', () => {
		assertDataflow(
			label('load with nonexistent file is unknown side effect', ['name-normal']),
			parser,
			'load("nonexistent.rda")',
			emptyGraph()
				.call('3', 'load', [argumentInCall('1')], { returns: [], reads: [builtInId('load')] })
				.argument('3', '1')
				.calls('3', builtInId('load')),
			{ expectIsSubgraph: true }
		);
	});
}));