import fs from 'node:fs';
import { SourceLocation, SourceRange } from '../../util/range';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';
import { fileProtocol } from '../../r-bridge/retriever';
import { DefaultMap } from '../../util/collections/defaultmap';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import path from 'path';
import { NumericInferenceVisitor } from './numeric-inference';
import { spawn } from 'child_process';

interface InstrumentAnnotation {
	range:  SourceRange;
	before: string;
	after:  string;
}

/**
 * Replace `workingDir` content with all files from `folder` and instrument all .R files by inserting
 * logging-statements for all POIs.
 *
 * Current POIs: Assignment calls (`<-`, `<<-`, `=`)
 * @param folder - The source folder.
 * @param workingDir - The target folder for the instrumented files.
 * @param outputFolder - The folder where the csv files should be written to.
 * @returns A promise that resolves when the instrumentation is complete.
 */
async function instrument(folder: string, workingDir: string, outputFolder: string) {
	// Empty the output folder
	fs.rmSync(workingDir, { recursive: true, force: true });
	// Copy all files recursively from folder to workingDir
	fs.mkdirSync(workingDir, { recursive: true });
	fs.cpSync(folder, workingDir, { recursive: true });

	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	analyzer.addRequest(fileProtocol + workingDir);
	await analyzer.dataflow();

	const visitor = new NumericInferenceVisitor({
		normalizedAst: await analyzer.normalize(),
		dfg:           (await analyzer.dataflow()).graph,
		controlFlow:   await analyzer.controlflow(),
		ctx:           analyzer.inspectContext()
	});

	visitor.start();

	// Get all locations of POIs
	// In this case, our POIs are assignment calls
	const locations = await analyzer.query([{
		type:          'call-context',
		callName:      '^(<-|<<-|=)$',
		callNameExact: false,
		kind:          'calls',
		subkind:       'assignment'
	}]);
	const assignments = locations['call-context'].kinds['calls'].subkinds['assignment'];

	const idMap = (await analyzer.normalize()).idMap;
	const edits: DefaultMap<string, InstrumentAnnotation[]> = new DefaultMap(() => []);
	for(const assignment of assignments) {
		const resolved = idMap.get(assignment.id);
		if(!resolved) {
			continue;
		}
		const loc = SourceLocation.fromNode(resolved);
		if(!loc) {
			continue;
		}
		if(RBinaryOp.is(resolved)) {
			const lhs = RNode.lexeme(resolved.lhs) ?? '';

			const inferredValue = visitor.getAbstractValue(resolved.lhs.info.id);

			const outputCsvPath = (path.join(outputFolder, SourceLocation.getFile(loc)?.split(workingDir).slice(-1)[0].slice(0, -2) ?? 'unknown') + '.csv');

			edits.get(SourceLocation.getFile(loc) ?? 'unknown').push({
				range:  SourceLocation.getRange(loc),
				before: `${lhs} <- (function() { `,
				after:  `; cat("${resolved.lhs.info.id}", typeof(${lhs}), tolower(as.character(is.numeric(${lhs}))), tolower(as.character(is.vector(${lhs}))), paste(length(${lhs}), collapse=""), paste0('"', gsub('"', '""', gsub("\\n", " ", ifelse(is.numeric(${lhs}), paste(${lhs}, collapse=","), ""))), '"'), paste('"', "${inferredValue?.toString() ?? 'undefined'}", '"', sep=""), "\\n", sep=",", file="${outputCsvPath}", append=TRUE); return(${lhs}) })()`,
			});
		}
	}

	for(const [file, annotations] of edits.entries()) {
		const fileLines = fs.readFileSync(file, 'utf-8').split('\n');
		const insertedCharacters: [line: number, column: number, characters: number][] = [];
		for(const annotation of annotations) {
			const endLineIndex = SourceRange.getEnd(annotation.range)[0] - 1;
			const endLineColumn = SourceRange.getEnd(annotation.range)[1];

			const endLineColumnOffset = insertedCharacters.filter(x => x[0] === endLineIndex && x[1] <= endLineColumn).reduce((acc, x) => acc + x[2], 0);

			fileLines[endLineIndex] = fileLines[endLineIndex].slice(0, endLineColumn + endLineColumnOffset) + annotation.after + fileLines[endLineIndex].slice(endLineColumn + endLineColumnOffset);
			insertedCharacters.push([endLineIndex, endLineColumn, annotation.after.length]);

			const startLineIndex = SourceRange.getStart(annotation.range)[0] - 1;
			const startLineColumn = SourceRange.getStart(annotation.range)[1];

			const startLineColumnOffset = insertedCharacters.filter(x => x[0] === startLineIndex && x[1] < startLineColumn).reduce((acc, x) => acc + x[2], 0);

			fileLines[startLineIndex] = fileLines[startLineIndex].slice(0, startLineColumn - 1 + startLineColumnOffset) + annotation.before + fileLines[startLineIndex].slice(startLineColumn - 1 + startLineColumnOffset);
			insertedCharacters.push([startLineIndex, startLineColumn - 1, annotation.before.length]);
		}

		const outputCsvPath = (path.join(outputFolder, file.split(workingDir).slice(-1)[0].slice(0, -2) ?? 'unknown') + '.csv');

		// Assure that the csv header is printed at the beginning of the file
		fileLines[0] = `(function() {cat("id,type,is_numeric,is_vector,length,value,inferredValue,\\n", file="${outputCsvPath}")})();` + fileLines[0];

		fs.writeFileSync(file, fileLines.join('\n'), 'utf-8');
	}
}

async function execute(folder: string, script: string) {
	console.log('Running in', folder);
	return new Promise((resolve, reject) => {
		const process = spawn('Rscript', [script], { cwd: folder });
		process.stdout.on('data', (data: Buffer) => {
			console.log(data.toString());
		});
		process.stderr.on('data', (data: Buffer) => {
			console.error(data.toString());
		});
		process.on('close', (code: number) => {
			if(code === 0) {
				resolve(null);
			} else {
				reject(new Error('Process exited with code ' + code));
			}
		});
	});
}

if(process.argv.length < 5) {
	console.error('Usage: ts-node src/abstract-interpretation/interval/eval.ts <folder> <output-folder> <script>');
	process.exit(1);
}

const folder = process.argv[2];
const outputFolder = process.argv[3];
const script = process.argv[4];

void instrument(folder, path.join('/tmp', folder), outputFolder).then(() => execute(path.join('/tmp', folder), script)).catch(err => {
	console.error('Error during analysis:', err);
	process.exit(1);
});