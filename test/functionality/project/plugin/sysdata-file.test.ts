import { assert, test } from 'vitest';
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
import { writeFilesUnder } from './plugin-test-helper';

const tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'flowr-sysdata-test-'));
process.on('exit', () => fs.rmSync(tempFolder, { recursive: true, force: true }));

/** Writes a project below {@link tempFolder}, running `rSetup` in it so a test can have R produce the binary files a package ships. Returns the project root. */
function project(name: string, files: Record<string, string>, rSetup?: (root: string) => string): string {
	const root = path.join(tempFolder, name);
	writeFilesUnder(root, files);
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
	return [...graph.vertices(true)].filter(([id]) => lexemeOf(id) === name).flatMap(([id]) =>
		[...graph.outgoingEdges(id) ?? NoEdges].filter(([, edge]) => DfEdge.includesType(edge, EdgeType.Reads)).map(([target]) => String(target)));
}

const SaveSysdata = (root: string) => `secretTable <- c(1, 2, 3)\nsecretHelper <- function(x) x\nsave(secretTable, secretHelper, file = "${root}/R/sysdata.rda", version = 2)`;
const Pkg = (name: string) => ({ DESCRIPTION: `Package: ${name}\nVersion: 1.0.0\n` });
/** Writes `files` under `projectName` (running `rSetup` for the binary sysdata), then checks the loaded `dataFile` name, `objects` (sysdataObjects()) and/or what a read of `reads[0]` resolves to (filtered to built-ins). */
function testSysdata(name: string, projectName: string, files: Record<string, string>, rSetup: ((root: string) => string) | undefined, expected: { dataFile?: string, objects?: unknown[], reads?: [string, string[]] }) {
	test(name, async() => {
		const root = project(projectName, files, rSetup);
		const { dataflow, analyzer } = await analyze(root);
		const filesCtx = analyzer.inspectContext().files;
		if(expected.dataFile) {
			assert.deepEqual(filesCtx.getFilesByRole(FileRole.Data).map(f => path.basename(f.path())), [expected.dataFile]);
		}
		if(expected.objects) {
			assert.deepEqual([...filesCtx.sysdataObjects()], expected.objects);
		}
		if(expected.reads) {
			const [read, targets] = expected.reads;
			const idMap = (await analyzer.normalize()).idMap;
			assert.deepEqual(readsOf(dataflow.graph, id => idMap.get(id)?.lexeme, read).filter(r => r.startsWith('built-in:')), targets);
		}
	});
}

testSysdata('a source package is tagged as data and states its objects with the types they were saved as', 'source-objects', { ...Pkg('mypkg'), 'R/main.R': 'h <- secretTable\n' }, SaveSysdata, { dataFile: 'sysdata.rda', objects: [{ name: 'secretTable', type: SexpType.RealSxp }, { name: 'secretHelper', type: SexpType.CloSxp }] });
testSysdata('the package\'s own code reads them without anything bringing them in', 'source-reads', { ...Pkg('mypkg'), 'R/main.R': 'h <- secretTable\n' }, SaveSysdata, { reads: ['secretTable', ['built-in:mypkg:secretTable']] });
testSysdata('they are internal, so the `:::` spelling reaches them too', 'source-internal', { ...Pkg('mypkg'), 'R/main.R': 'h <- mypkg:::secretTable\n' }, SaveSysdata, { reads: ['secretTable', ['built-in:mypkg:secretTable']] });
testSysdata('an assignment the package makes itself shadows them', 'source-shadowed', { ...Pkg('mypkg'), 'R/main.R': 'secretTable <- 5\nh <- secretTable\n' }, SaveSysdata, { reads: ['secretTable', []] });
testSysdata('a project with no package namespace has nothing to lazy-load them into', 'no-package', { 'R/main.R': 'h <- secretTable\n' }, SaveSysdata, { reads: ['secretTable', []] });
/* the index only records where each object sits, so the type is not among what it states */
testSysdata('an installed package states the names its lazy-load database holds, reached the same way', 'installed', { ...Pkg('instpkg'), 'R/main.R': 'h <- storedTable\n' },
	r => `e <- new.env()\nassign("storedTable", 1:3, e)\ntools:::makeLazyLoadDB(e, "${r}/R/sysdata")`,
	{ objects: [{ name: 'storedTable' }], reads: ['storedTable', ['built-in:instpkg:storedTable']] });
