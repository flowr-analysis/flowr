import { describe, expect, it } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import fs from 'fs';
import path from 'path';
import { RShellExecutor } from '../../../../../src/r-bridge/shell-executor';
import { getVarsAndTypesFromShell, SexpToRType } from '../../../project/plugin/load-pipeline/load-pipeline.test';
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder';
import seedrandom from 'seedrandom';
import { RandomRCodeGenerator, RObjectType, SeededRandom } from '../../../util/project/plugin/random-r-code-generator';
import os from 'os';
import { FlowrConfig } from '../../../../../src/config';
import { BuiltInProcName } from '../../../../../src/dataflow/environments/built-in-proc-name';
import { NodeId } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('load real-world', withTreeSitter(parser => {
	const dir = 'test/functionality/project/plugin/load-pipeline/zenodo/files';
	if(!(fs.existsSync(dir) && fs.readdirSync(dir).length > 0)) {
		it.skip('skipped - no RDA files found', () => {});
		return;
	}

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
				const syntheticId = `3:loaded:${varName}`;
				const cds = [{ id: '3', when: true }];

				if(varType === SexpToRType[3] || varType === SexpToRType[7] || varType === SexpToRType[8]) {
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

			assertDataflow(
				label(`loading ${path.basename(file)} overwrites an existing variable`, ['name-normal']),
				parser,
				`${firstVar} <- 42\nload("${file}")\nprint(${firstVar})`,
				emptyGraph()
					.use(`3@${firstVar}`, firstVar)
					.reads(`3@${firstVar}`, `6:loaded:${firstVar}`),
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

			const firstClosure = [...varsAndTypesFromShell.entries()].find(([, type]) => type === SexpToRType[3]);
			if(!firstClosure) {
				continue;
			}
			const [closureName] = firstClosure;

			assertDataflow(
				label(`function from load is callable in ${path.basename(file)}`, ['name-normal']),
				parser,
				`load("${file}")\n${closureName}()`,
				emptyGraph()
					.defineVariable(`3:loaded:${closureName}`, undefined, { cds: [{ id: 3, when: true }] })
					.defineFunction(`3:loaded:${closureName}:fdef`, [], {
						entryPoint:        `3:loaded:${closureName}:fdef`,
						graph:             new Set(),
						out:               [],
						in:                [],
						unknownReferences: [],
						hooks:             [],
						environment:       defaultEnv()
					}, { cds: [{ id: 3, when: true }] })
					.definedBy(`3:loaded:${closureName}`, `3:loaded:${closureName}:fdef`)
					.reads(`2@${closureName}`, `3:loaded:${closureName}`),
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
			assertDataflow(
				label('load is ignored when ignoreLoadCalls is true', ['name-normal']),
				parser,
				`load("${files[0]}")`,
				emptyGraph(),
				{
					expectIsSubgraph:    true,
					mustNotHaveVertices: new Set([`3:loaded:${firstVar}`]),
				},
				0,
				FlowrConfig.setInConfig(FlowrConfig.default(), 'ignoreLoadCalls', true)
			);
		}
	});
}));

describe('load random', withTreeSitter(parser => {
	const seed = 0;
	const rng = seedrandom(seed.toString());
	const rnd = new SeededRandom(rng);
	const rcg = new RandomRCodeGenerator(rnd);
	const tempFolder = fs.mkdtempSync(path.resolve(os.tmpdir(), 'flowr-load-test-'));

	const createRda = (types: RObjectType[], filename: string): { file: string, vars: string[] } => {
		const { rCode, vars } = rcg.generateRCodeWithTypes(types);
		const file = path.join(tempFolder, filename);
		const rShell = new RShellExecutor();
		rShell.run(`${rCode}\nsave(${vars.join(', ')}, file="${file}")`);
		rShell.close();
		return { file, vars };
	};

	describe('defines variables', () => {
		const { file, vars } = createRda([
			RObjectType.Literal,
			RObjectType.Vector,
			RObjectType.Function,
			RObjectType.List,
		], 'defines_variables.rda');

		const rShell = new RShellExecutor();
		const varsAndTypes = getVarsAndTypesFromShell(file, rShell);
		rShell.close();

		it('generated rda contains expected variable names', () => {
			expect([...varsAndTypes.keys()].sort()).toEqual(vars.sort());
		});

		let graph = emptyGraph();
		for(const [varName, varType] of varsAndTypes) {
			const syntheticId = `3:loaded:${varName}`;
			const cds = [{ id: '3', when: true }];
			if(varType === SexpToRType[3] || varType === SexpToRType[7]  || varType === SexpToRType[8]) {
				const fdefId = `${syntheticId}:fdef`;
				graph = graph.defineFunction(fdefId, [], {
					entryPoint: fdefId, graph: new Set(), out: [], in: [], unknownReferences: [], hooks: [], environment: defaultEnv()
				}, { cds });
				graph = graph.defineVariable(syntheticId, undefined, { cds });
				graph = graph.definedBy(syntheticId, fdefId);
			} else {
				graph = graph.defineVariable(syntheticId, undefined, { cds });
			}
		}

		assertDataflow(
			label('load defines variables from generated rda', ['name-normal']),
			parser,
			`load("${file}")`,
			graph,
			{ expectIsSubgraph: true }
		);
	});

	describe('overwrite behavior', () => {
		const { file: fileNoClosure, vars: varsNoClosure } = createRda([RObjectType.Literal], 'overwrite_no_closure.rda');
		const { file: fileClosure, vars: varsClosure } = createRda([RObjectType.Function], 'overwrite_closure.rda');

		const rShell = new RShellExecutor();
		const varsNoClosureFromShell = getVarsAndTypesFromShell(fileNoClosure, rShell);
		const varsClosureFromShell = getVarsAndTypesFromShell(fileClosure, rShell);
		rShell.close();

		it('generated rda contains expected variable names', () => {
			expect([...varsNoClosureFromShell.keys()].sort()).toEqual(varsNoClosure.sort());
			expect([...varsClosureFromShell.keys()].sort()).toEqual(varsClosure.sort());
		});

		const firstNoClosureEntry = [...varsNoClosureFromShell.entries()][0];
		const firstClosureEntry = [...varsClosureFromShell.entries()][0];

		if(firstNoClosureEntry) {
			const [firstVar] = firstNoClosureEntry;

			assertDataflow(
				label('load overwrites existing variable (no closure)', ['name-normal']),
				parser,
				`${firstVar} <- 42\nload("${fileNoClosure}")\nprint(${firstVar})`,
				emptyGraph()
					.use(`3@${firstVar}`, firstVar)
					.reads(`3@${firstVar}`, `6:loaded:${firstVar}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);

			assertDataflow(
				label('assignment overwrites loaded variable (no closure)', ['name-normal']),
				parser,
				`load("${fileNoClosure}")\n${firstVar} <- 42\nprint(${firstVar})`,
				emptyGraph()
					.use(`3@${firstVar}`, firstVar)
					.reads(`3@${firstVar}`, `2@${firstVar}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);
		}

		if(firstClosureEntry) {
			const [firstVar] = firstClosureEntry;

			assertDataflow(
				label('load overwrites existing closure variable', ['name-normal']),
				parser,
				`${firstVar} <- 42\nload("${fileClosure}")\nprint(${firstVar})`,
				emptyGraph()
					.use(`3@${firstVar}`, firstVar)
					.reads(`3@${firstVar}`, `6:loaded:${firstVar}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);

			assertDataflow(
				label('assignment overwrites loaded closure variable', ['name-normal']),
				parser,
				`load("${fileClosure}")\n${firstVar} <- 42\nprint(${firstVar})`,
				emptyGraph()
					.use(`3@${firstVar}`, firstVar)
					.reads(`3@${firstVar}`, `2@${firstVar}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);
		}
	});

	describe('function call', () => {
		const { file, vars } = createRda([RObjectType.Function], 'function_call.rda');
		const rShell = new RShellExecutor();
		const varsAndTypes = getVarsAndTypesFromShell(file, rShell);
		rShell.close();

		it('generated rda contains expected variable names', () => {
			expect([...varsAndTypes.keys()].sort()).toEqual(vars.sort());
		});

		const firstClosure = [...varsAndTypes.entries()].find(([, type]) => type === SexpToRType[3]);
		if(firstClosure) {
			const [closureName] = firstClosure;

			assertDataflow(
				label('function from generated load is callable', ['name-normal']),
				parser,
				`load("${file}")\n${closureName}()`,
				emptyGraph()
					.defineVariable(`3:loaded:${closureName}`, undefined, { cds: [{ id: 3, when: true }] })
					.defineFunction(`3:loaded:${closureName}:fdef`, [], {
						entryPoint: `3:loaded:${closureName}:fdef`, graph: new Set(), out: [], in: [], unknownReferences: [], hooks: [], environment: defaultEnv()
					}, { cds: [{ id: 3, when: true }] })
					.definedBy(`3:loaded:${closureName}`, `3:loaded:${closureName}:fdef`)
					.reads(`2@${closureName}`, `3:loaded:${closureName}`),
				{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
			);
		}
	});

	describe('ignore load calls config', () => {
		const { file, vars } = createRda([RObjectType.Literal], 'ignore_config.rda');
		const rShell = new RShellExecutor();
		const varsAndTypes = getVarsAndTypesFromShell(file, rShell);
		rShell.close();

		it('generated rda contains expected variable names', () => {
			expect([...varsAndTypes.keys()].sort()).toEqual(vars.sort());
		});

		const firstEntry = [...varsAndTypes.entries()][0];
		if(firstEntry) {
			const [firstVar] = firstEntry;
			assertDataflow(
				label('load is ignored when ignoreLoadCalls is true (generated)', ['name-normal']),
				parser,
				`load("${file}")`,
				emptyGraph()
					.call('3', 'load', [argumentInCall('1')], { returns: [], reads: [NodeId.toBuiltIn('load')] })
					.argument('3', '1')
					.calls('3', NodeId.toBuiltIn('load'))
					.markIdForUnknownSideEffects('3'),
				{
					expectIsSubgraph:    true,
					mustNotHaveVertices: new Set([`3:loaded:${firstVar}`])
				},
				0,
				FlowrConfig.setInConfig(FlowrConfig.default(), 'ignoreLoadCalls', true)
			);
		}
	});

	process.on('exit', () => {
		try {
			fs.rmSync(tempFolder, { recursive: true, force: true });
		} catch(e) {
			console.error('Error during cleanup:', e);
		}
	});
}));

describe('file not found', withTreeSitter(parser => {
	assertDataflow(
		label('load with nonexistent file is unknown side effect', ['name-normal']),
		parser,
		'load("nonexistent.rda")',
		emptyGraph()
			.call('3', 'load', [argumentInCall('1')], { returns: [], reads: [NodeId.toBuiltIn('load')] })
			.argument('3', '1')
			.calls('3', NodeId.toBuiltIn('load')),
		{ expectIsSubgraph: true }
	);
}));

describe('no resolvable file argument', withTreeSitter(parser => {
	assertDataflow(label('load without any file argument is unknown side effect', ['unnamed-arguments']), parser, 'load()', emptyGraph()
		.call('1', 'load', [], { returns: [], reads: [NodeId.toBuiltIn('load')], origin: [BuiltInProcName.Function] })
		.calls('1', NodeId.toBuiltIn('load'))
		.markIdForUnknownSideEffects('1'),
	{ expectIsSubgraph: true }
	);

	assertDataflow(label('load with only envir argument is unknown side effect', ['unnamed-arguments', 'name-normal']), parser, 'e <- new.env()\nload(envir = e)', emptyGraph()
		.use('6', 'e')
		.reads('6', '0')
		.use('7', 'envir')
		.reads('7', '6')
		.call('2', 'new.env', [], { returns: [], reads: [NodeId.toBuiltIn('new.env')] })
		.calls('2', NodeId.toBuiltIn('new.env'))
		.call('3', '<-', [argumentInCall('0'), argumentInCall('2')], { returns: ['0'], reads: ['2', NodeId.toBuiltIn('<-')], onlyBuiltIn: true })
		.calls('3', NodeId.toBuiltIn('<-'))
		.call('8', 'load', [argumentInCall('7', { name: 'envir' })], { returns: [], reads: [NodeId.toBuiltIn('load')], origin: [BuiltInProcName.Function] })
		.calls('8', NodeId.toBuiltIn('load'))
		.defineVariable('0', 'e', { definedBy: ['2', '3'] })
		.markIdForUnknownSideEffects('8'),
	{ expectIsSubgraph: true }
	);
}));