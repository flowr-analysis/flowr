import { escapeRegex } from '../../../../src/util/text/strings';
import { RString } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';
import type { DependenciesQueryResult, DependencyInfo } from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { UnnamedFunctionCallPrefix } from '../../../../src/dataflow/internal/process/functions/call/unnamed-call-handling';
import { createSlicePipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import { deterministicCountingIdGenerator } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { replProcessAnswer } from '../../../../src/cli/repl/core';
import { voidFormatter } from '../../../../src/util/text/ansi';
import { analyzerFor, MutationProgram, type MutationTarget } from './mutation-program';
import type { MutationPass } from './mutation-passes';

/** the slice of `code` for `criterion`, which is empty where the criterion resolves to nothing */
export async function slice(parser: KnownParser, { code, criterion }: MutationTarget): Promise<string> {
	const result = await createSlicePipeline(parser, { getId: deterministicCountingIdGenerator(0), context: contextFromInput(code), criterion: [criterion] }).allRemainingSteps();
	const reconstructed = result.reconstruct.code;
	return Array.isArray(reconstructed) ? reconstructed.join('\n') : reconstructed;
}

/** what is left of `code` once the removal slice of `criterion` is removed, see {@link staticRemovalSlice} */
export async function removalSlice(parser: KnownParser, { code, criterion }: MutationTarget): Promise<string> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	analyzer.addRequest(code);
	const { 'static-slice': slices } = await analyzer.query([{ type: 'static-slice', criteria: [criterion], removal: true }]);
	const left = (Object.values(slices.results)[0] as { reconstruct?: { code: string | string[] } } | undefined)?.reconstruct?.code;
	return Array.isArray(left) ? left.join('\n') : left ?? '';
}

/** applies one pass to `target`, as flowR analyzes it */
export async function mutate(parser: KnownParser, target: MutationTarget, pass: MutationPass): Promise<MutationTarget | undefined> {
	return pass.apply(await MutationProgram.of(parser, target));
}

/** `text` with every name a pass gave a variable replaced by the one the variable had before */
function unrenamed(text: string, renames: Readonly<Record<string, string>> = {}): string {
	return Object.entries(renames).map(([to, from]) => [RString.unquote(to), from] as const)
		.sort(([a], [b]) => b.length - a.length)
		.reduce((t, [to, from]) => t.replace(new RegExp(String.raw`(?<![\w.])${escapeRegex(to)}(?![\w.])`, 'g'), from), text)
		/* backticks around a syntactic name change nothing, neither in code nor in a message quoting it */
		.replace(/`([A-Za-z]|\.(?!\d))([\w.]*)`/g, '$1$2');
}

/** what the queries say about a program, with every node id dropped, as a mutation moves those */
export type QueryObservation = Readonly<Record<string, readonly string[]>>;

function dependenciesOf(result: DependenciesQueryResult): string[] {
	return Object.entries(result).filter(([category]) => category !== '.meta')
		.flatMap(([category, found]) => (found as DependencyInfo[]).map(({ functionName, value, lexemeOfArgument }) => {
			const name = String(functionName).startsWith(UnnamedFunctionCallPrefix) ? UnnamedFunctionCallPrefix : String(functionName);
			return `${category}: ${name} ${value ?? lexemeOfArgument ?? '?'}`;
		})).sort();
}

/**
 * What no {@link MutationPasses|pass} may change, which is the dependencies flowR finds and what it states
 * about the functions of the program. Renaming, regrouping or hiding a constant behind a `paste0` changes none.
 */
export async function observeQueries(parser: KnownParser, code: string, renames?: Readonly<Record<string, string>>): Promise<QueryObservation> {
	const analyzer = await analyzerFor(parser, code);
	const results = await analyzer.query([
		{ type: 'dependencies' }, { type: 'inspect-higher-order' }, { type: 'inspect-recursion' },
		{ type: 'inspect-exception' }, { type: 'inspect-fn-props' }
	]);
	return {
		dependencies: dependenciesOf(results.dependencies).map(d => unrenamed(d, renames)).sort(),
		higherOrder:  Object.values(results['inspect-higher-order'].higherOrder).map(String).sort(),
		recursive:    Object.values(results['inspect-recursion'].recursive).map(String).sort(),
		exceptions:   Object.values(results['inspect-exception'].exceptions).map(t => String(t.length)).sort(),
		roles:        Object.values(results['inspect-fn-props'].roles).map(r => JSON.stringify(Object.values(r).sort())).sort(),
		props:        Object.values(results['inspect-fn-props'].props).map(p => JSON.stringify(p)).sort()
	};
}

/** what the REPL answers about a program, written so that a pass that keeps the meaning keeps the answer */
export interface ReplObservation {
	/** the code the REPL prints as the slice for the criterion */
	readonly slice:        string;
	/** the dependencies as the REPL lists them */
	readonly dependencies: readonly string[];
	/** every linter finding, by rule and certainty */
	readonly linter:       readonly string[];
	/** the value of the criterion and the graphs, which only a {@link MutationPass#keepsGraph|pass keeping the graph} must not change */
	readonly graphs:       readonly string[];
}

const replAnalyzers = new WeakMap<KnownParser, Promise<FlowrAnalyzer>>();

/** what the REPL prints for `line`, without the timings that change from one run to the next */
async function replLines(parser: KnownParser, line: string): Promise<string[]> {
	const analyzer = replAnalyzers.get(parser) ?? new FlowrAnalyzerBuilder().setParser(parser).build();
	replAnalyzers.set(parser, analyzer);
	const out: string[] = [];
	const collect = (m: string) => out.push(...m.split('\n'));
	await replProcessAnswer(await analyzer, { formatter: voidFormatter, allowClipboard: false, stdout: collect, stderr: collect }, line, false);
	return out.filter(l => !l.startsWith('All queries together required')).map(l => l.replace(/\s*\(\d+\W?ms\)/g, '').trimEnd());
}

/**
 * The names as the program had them before the pass, and no position, as a pass moves those; mermaid's `#95;` escapes
 * are undone first so a name reads as written.
 */
function neutralized(lines: readonly string[], renames: Readonly<Record<string, string>> = {}): string[] {
	return lines.map(l => unrenamed(l.replace(/#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code))), renames).replace(/\b\d+\.\d+(?:-\d+(?:\.\d+)?)?\b/g, '').replace(/\(node [^)]*\)|\{-?\d+@[^{}]*\}/g, ''));
}

function linterFindings(lines: readonly string[]): string[] {
	const findings: string[] = [];
	let rule = '';
	let certainty = '';
	for(const line of lines) {
		const header = /^\s*╰ .* \(([\w-]+)\):$/.exec(line);
		const level = /^\s*╰ (certain|uncertain):$/.exec(line);
		if(header !== null) {
			rule = header[1];
		} else if(level !== null) {
			certainty = level[1];
		} else if(/^\s*╰ /.test(line) && !line.includes('Metadata') && !line.includes('no findings')) {
			/* what a finding says, not the ids and positions it names, which a pass moves */
			findings.push(`${rule} ${certainty}: ${line.trim().replace(/\d+/g, '#')}`);
		}
	}
	return findings.sort();
}

/** asks the REPL about `target` the way a reader would, with the program inlined into the command */
export async function observeRepl(parser: KnownParser, target: MutationTarget): Promise<ReplObservation> {
	const code = JSON.stringify(target.code);
	const slice = await replLines(parser, `:query @static-slice (${target.criterion}) ${code}`);
	const graphs = [];
	for(const command of [`:query @resolve-value (${target.criterion})`, ':dataflow', ':normalize', ':cfg']) {
		/* the excerpt titling a function body may span lines and is cut at a fixed length, which a renaming moves */
		const printed = (await replLines(parser, `${command} ${code}`)).join('\n').replace(/(?<=-body \[")body of [\s\S]*?(?="\])/g, '');
		graphs.push(command.split(' ')[0], ...printed.split('\n'));
	}
	return {
		slice:        slice.join('\n'),
		/* which dependency is listed first follows which call the values were found through first, which is no part of the answer */
		dependencies: neutralized(await replLines(parser, `:query @dependencies ${code}`), target.renames).sort(),
		linter:       linterFindings(neutralized(await replLines(parser, `:query @linter ${code}`), target.renames)),
		graphs:       neutralized(graphs, target.renames).map(l => l.replace(/\s+/g, ''))
	};
}
