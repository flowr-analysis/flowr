import { assert, describe, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { FileRole } from '../../../../src/project/context/flowr-file';
import { RShellExecutor } from '../../../../src/r-bridge/shell-executor';
import { rPath } from '../../_helper/r-path';
import { SexpType } from '../../../../src/project/plugins/file-plugins/files/flowr-rda-file';
import { DfEdge, EdgeType } from '../../../../src/dataflow/graph/edge';
import { NoEdges, type DataflowGraph } from '../../../../src/dataflow/graph/graph';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sysdata-test-'));

process.on('exit', () => fs.rmSync(tempFolder, { recursive: true, force: true }));

/**
 * Writes a project below {@link tempFolder} and runs `rSetup` in it, so a test can have R produce the binary
 * files a package ships. Returns the project root.
 */
function project(name: string, files: Record<string, string>, rSetup?: (root: string) => string): string {
	const root = path.join(tempFolder, name);
	for(const [file, content] of Object.entries(files)) {
		fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), content);
	}
	if(rSetup) {
		const shell = new RShellExecutor();
		shell.run(rSetup(rPath(root)));
		shell.close();
	}
	return root;
}

async function analyze(root: string) {
	const analyzer = await new FlowrAnalyzerBuilder().build();
	analyzer.addRequest({ request: 'project', content: root });
	return { dataflow: await analyzer.dataflow(), analyzer };
}

/** Every node a use of `name` reads, so a test can say what the name resolved to. */
function readsOf(graph: DataflowGraph, lexemeOf: (id: NodeId) => string | undefined, name: string): string[] {
	const targets: string[] = [];
	for(const [id] of graph.vertices(true)) {
		if(lexemeOf(id) !== name) {
			continue;
		}
		for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) {
			if(DfEdge.includesType(edge, EdgeType.Reads)) {
				targets.push(String(target));
			}
		}
	}
	return targets;
}

const SaveSysdata = (root: string) =>
	`secretTable <- c(1, 2, 3)
	 secretHelper <- function(x) x
	 save(secretTable, secretHelper, file = "${root}/R/sysdata.rda", version = 2)`;

describe('The system data a package lazy-loads into its namespace', () => {
	test('a source package states its objects with the types they were saved as', async() => {
		const root = project('source-states', {
			'DESCRIPTION': 'Package: mypkg\nVersion: 1.0.0\n',
			'R/main.R':    'h <- secretTable\n'
		}, SaveSysdata);
		const { analyzer } = await analyze(root);
		const files = analyzer.inspectContext().files;
		assert.deepEqual(files.getFilesByRole(FileRole.Data).map(f => path.basename(f.path())), ['sysdata.rda']);
		assert.deepEqual([...files.sysdataObjects()], [
			{ name: 'secretTable', type: SexpType.RealSxp },
			{ name: 'secretHelper', type: SexpType.CloSxp }
		]);
	});

	test('the package\'s own code reads them without anything bringing them in', async() => {
		const root = project('source-reads', {
			'DESCRIPTION': 'Package: mypkg\nVersion: 1.0.0\n',
			'R/main.R':    'h <- secretTable\n'
		}, SaveSysdata);
		const { dataflow, analyzer } = await analyze(root);
		const idMap = (await analyzer.normalize()).idMap;
		assert.deepEqual(readsOf(dataflow.graph, id => idMap.get(id)?.lexeme, 'secretTable'), ['built-in:mypkg:secretTable']);
	});

	test('they are internal, so the `:::` spelling reaches them too', async() => {
		const root = project('source-internal', {
			'DESCRIPTION': 'Package: mypkg\nVersion: 1.0.0\n',
			'R/main.R':    'h <- mypkg:::secretTable\n'
		}, SaveSysdata);
		const { dataflow, analyzer } = await analyze(root);
		const idMap = (await analyzer.normalize()).idMap;
		assert.deepEqual(readsOf(dataflow.graph, id => idMap.get(id)?.lexeme, 'secretTable'), ['built-in:mypkg:secretTable']);
	});

	test('an assignment the package makes itself shadows them', async() => {
		const root = project('source-shadowed', {
			'DESCRIPTION': 'Package: mypkg\nVersion: 1.0.0\n',
			'R/main.R':    'secretTable <- 5\nh <- secretTable\n'
		}, SaveSysdata);
		const { dataflow, analyzer } = await analyze(root);
		const idMap = (await analyzer.normalize()).idMap;
		const reads = readsOf(dataflow.graph, id => idMap.get(id)?.lexeme, 'secretTable');
		assert.deepEqual(reads.filter(r => r.startsWith('built-in:')), [], 'the package\'s own definition answers');
	});

	test('a project with no package namespace has nothing to lazy-load them into', async() => {
		const root = project('no-package', {
			'R/main.R': 'h <- secretTable\n'
		}, SaveSysdata);
		const { dataflow, analyzer } = await analyze(root);
		const idMap = (await analyzer.normalize()).idMap;
		assert.deepEqual(readsOf(dataflow.graph, id => idMap.get(id)?.lexeme, 'secretTable'), []);
	});

	test('an installed package states the names its lazy-load database holds', async() => {
		const root = project('installed', {
			'DESCRIPTION': 'Package: instpkg\nVersion: 1.0.0\n',
			'R/main.R':    'h <- storedTable\n'
		}, r => `e <- new.env()
			assign("storedTable", 1:3, e)
			tools:::makeLazyLoadDB(e, "${r}/R/sysdata")`);
		const { dataflow, analyzer } = await analyze(root);
		const files = analyzer.inspectContext().files;
		/* the index only records where each object sits, so the type is not among what it states */
		assert.deepEqual([...files.sysdataObjects()], [{ name: 'storedTable' }]);
		const idMap = (await analyzer.normalize()).idMap;
		assert.deepEqual(readsOf(dataflow.graph, id => idMap.get(id)?.lexeme, 'storedTable'), ['built-in:instpkg:storedTable']);
	});
});
