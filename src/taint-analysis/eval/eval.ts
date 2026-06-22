/**
 * Evaluation script for flowR's taint analysis.
 *
 * It uses the {@link FlowrAnalyzer} API and collects the function-call
 * mappings through the {@link TaintAnalysisInstrumentation} hook (`analyzer.taint().withHook(...)`).
 *
 * For every `.R` file found (recursively) below the given dataset directory it runs the
 * configured taint analyses and writes one JSON line with the collected trace to stdout
 * (progress is always logged to stderr).
 *
 * Usage:
 *   ts-node src/taint-analysis/eval/eval.ts <dataset-dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { FlowrAnalyzerBuilder } from '../../project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../project/flowr-analyzer';
import { fileProtocol } from '../../r-bridge/retriever';
import { TaintAnalysisInstrumentation } from './instrumentation';
import type { AllPredefinedTaintAnalysisNames } from '../predefined/predefined';
import { allPredefinedTaintAnalysisNames } from '../predefined/predefined';
import { log, LogLevel } from '../../util/log';
import type { TaintInferenceResult } from '../builder/taint-analysis';
import { Bottom } from '../../abstract-interpretation/domains/lattice';

interface ScriptRun {
	/** Script path relative to its project. */
	scriptName: string;
	/** Absolute path to the R file. */
	path:       string;
}

/** Recursively yield all relevant `.R` files below `dir`. */
function* findRFiles(dir: string): Generator<string> {
	for(const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if(entry.isDirectory()) {
			yield* findRFiles(fullPath);
		} else if(entry.isFile() && entry.name.endsWith('.R')) {
			yield fullPath;
		}
	}
}

/** Collect all scripts below the dataset root, deriving source/id/script name from the path. */
function collectScripts(root: string): ScriptRun[] {
	return Array.from(findRFiles(root), file => {
		const parts = path.relative(root, file).split(path.sep);
		return {
			scriptName: parts.length >= 3 ? parts.slice(2).join('/') : parts[parts.length - 1],
			path:       file,
		};
	});
}

/** Convert the instrumentation's nested `Map` trace into a plain, JSON-serializable object. */
function traceToObject(trace: TaintAnalysisInstrumentation['trace']): Record<string, Record<string, unknown>> {
	const result: Record<string, Record<string, unknown>> = {};
	for(const [analysis, byFile] of trace) {
		const files: Record<string, unknown> = {};
		for(const [file, info] of byFile) {
			files[file ?? '<unknown>'] = info;
		}
		result[analysis] = files;
	}
	return result;
}

function taintResultsToObject(results: Map<string, TaintInferenceResult>) {
	return Object.fromEntries(
		results.entries().map(([name, { domains, finding }]) => [name, {
			domains: domains.value === Bottom ? domains.value.description : Object.fromEntries(domains.value.entries().map(([key, domain]) => [key, domain?.toJson() ?? null])),
			finding: finding,
		}])
	);
}

/** Run all configured taint analyses on a single script and return the JSON line to write. */
async function analyzeScript(run: ScriptRun, analyzer: FlowrAnalyzer): Promise<string> {
	console.error(`Analyzing script ${run.scriptName}`);

	const instrumentation = new TaintAnalysisInstrumentation();
	const start = Date.now();
	let result: Map<string, TaintInferenceResult> | undefined = undefined;

	try {
		// drop the previous file's requests and cached results, reusing the analyzer's parser
		analyzer.reset();
		analyzer.addRequest(`${fileProtocol}${run.path}`);

		const analysis = analyzer.taint<AllPredefinedTaintAnalysisNames>();
		for(const def of allPredefinedTaintAnalysisNames) {
			analysis.addPredefined(def);
		}
		analysis.withHook(instrumentation.fnCallHook);

		result = await analysis.run();
	} catch(e) {
		console.error(`Taint inference for script ${run.scriptName} failed: ${(e as Error).message}`);
		return JSON.stringify({ script_name: run.scriptName, infer_failed: true }) + '\n';
	}

	console.error(`Finished taint inference for script ${run.scriptName}`);
	return JSON.stringify({
		script_name: run.scriptName,
		infer_time:  Date.now() - start,
		inferred:    traceToObject(instrumentation.trace),
		result:      taintResultsToObject(result),
	}) + '\n';
}

async function main(): Promise<void> {
	const datasetArg = process.argv[2];
	if(!datasetArg) {
		console.error('Usage: eval <dataset-dir>');
		process.exit(1);
	}

	const root = path.resolve(datasetArg);
	if(!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
		console.error(`Dataset directory '${root}' does not exist or is not a directory`);
		process.exit(1);
	}

	log.updateSettings(l => l.settings.minLevel = LogLevel.Fatal);

	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();

	const scripts = collectScripts(root);
	console.error(`Found ${scripts.length} R script(s) below ${root}; writing results to stdout`);

	try {
		for(const script of scripts) {
			process.stdout.write(await analyzeScript(script, analyzer));
		}
	} finally {
		analyzer.close();
	}
}

void main();
