import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import { Q } from '../../../src/search/flowr-search-builder';
import { RSymbol } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { SourceRange } from '../../../src/util/range';
import type { DependenciesQueryResult, DependencyInfo } from '../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { UnnamedFunctionCallPrefix } from '../../../src/dataflow/internal/process/functions/call/unnamed-call-handling';
import { AttachedBasePackageSet, baseRExportOwner } from '../../../src/util/r-base-packages';
import { MIN_VERSION_LAMBDA } from '../../../src/r-bridge/lang-4.x/ast/model/versions';
import { RPipe } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import semver from 'semver/preload';
import { createSlicePipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

export interface MutationTarget {
	/** the program to mutate */
	readonly code:      string;
	/** where to slice, in the only form the passes can move along */
	readonly criterion: `${number}@${string}`;
	/** what {@link code} prints when it is run */
	readonly expected:  string;
}

/** where a name is written down in the program being mutated, as the flowR search finds it */
export type Occurrences = (name: string) => Promise<readonly SourceRange[]>;

/** one rewrite, applied to every counterexample it fits */
export interface MutationPass {
	/** what the mutants of this pass are named after */
	readonly name:         string;
	/** the R version the rewrite needs, so a host below it explains an idle pass without a name list */
	readonly minRVersion?: string;
	/** the mutated program, or `undefined` if the pass does not apply */
	readonly apply:        (target: MutationTarget, occurrencesOf: Occurrences) => Promise<MutationTarget | undefined> | MutationTarget | undefined;
}

function rVersionAtLeast(version: string): boolean {
	return !!globalThis.rVersion && semver.satisfies(globalThis.rVersion, `>=${version}`);
}

/** whether the host R meets what the pass declares, so that an idle pass is idle for the program and not the host */
export function passIsAvailable(pass: MutationPass): boolean {
	return pass.minRVersion === undefined || rVersionAtLeast(pass.minRVersion);
}

const PipeVersion = RPipe.availableFromRVersion().toString();

const MutationPrefix = 'mut_';

const SimpleAssignment = /^([A-Za-z.][\w.]*) <- (.+)$/;

const OpenHeadKeyword = /(^|[^\w.])(if|for|while|function|\\)\s*$/;

function endsWithOpenHead(line: string): boolean {
	const trimmed = line.trimEnd();
	if(/(^|[^\w.])(repeat|else)$/.test(trimmed)) {
		return true;
	} else if(!trimmed.endsWith(')')) {
		return false;
	}
	let depth = 0;
	for(let i = trimmed.length - 1; i >= 0; i--) {
		depth += trimmed[i] === ')' ? 1 : trimmed[i] === '(' ? -1 : 0;
		if(depth === 0) {
			return OpenHeadKeyword.test(trimmed.slice(0, i));
		}
	}
	return false;
}

function isWholeStatement(line: string): boolean {
	let depth = 0;
	for(const c of line) {
		depth += '([{'.includes(c) ? 1 : ')]}'.includes(c) ? -1 : 0;
	}
	return depth === 0 && !line.includes('#') && !endsWithOpenHead(line)
		&& (line.match(/"/g)?.length ?? 0) % 2 === 0 && (line.match(/'/g)?.length ?? 0) % 2 === 0
		&& !/([-+*/^,~|&<>=!:]|%[^%]*%)$/.test(line.trimEnd());
}

function mapLines(target: MutationTarget, map: (lines: readonly string[]) => string[], criterionLine: (line: number) => number): MutationTarget | undefined {
	const at = SlicingCriterion.nameAt(target.criterion);
	const lines = target.code.split('\n');
	return at === undefined || !lines.every(isWholeStatement) ? undefined
		: { ...target, code: map(lines).join('\n'), criterion: `${criterionLine(at.line)}@${at.name}` };
}

function rewriteAssignments(target: MutationTarget, rewrite: (name: string, rhs: string, line: number) => string | undefined): MutationTarget | undefined {
	let changed = false;
	const mutated = mapLines(target, lines => lines.map((l, index) => {
		const match = SimpleAssignment.exec(l);
		const rewritten = match === null || match[2].includes(';') ? undefined : rewrite(match[1], match[2], index + 1);
		changed ||= rewritten !== undefined;
		return rewritten ?? l;
	}), line => line);
	return changed ? mutated : undefined;
}

const leadingNoise: MutationPass = {
	name:  'leading noise',
	apply: target => mapLines(target, lines => [`${MutationPrefix}a <- 1`, `${MutationPrefix}b <- ${MutationPrefix}a + 1`, ...lines], line => line + 2)
};

const trailingNoise: MutationPass = {
	name:  'trailing noise',
	apply: target => /^(print|invisible|cat)\(/.test(target.code.split('\n').at(-1) ?? '') ?
		mapLines(target, lines => [...lines, `${MutationPrefix}c <- 2`], line => line) : undefined
};

const comments: MutationPass = {
	name:  'interleaved comments',
	apply: target => mapLines(target, lines => lines.flatMap(l => [`# ${MutationPrefix}note`, l]), line => line * 2)
};

const blankLines: MutationPass = {
	name:  'interleaved blank lines',
	apply: target => mapLines(target, lines => lines.flatMap(l => ['', l]), line => line * 2)
};

const joinFirstTwo: MutationPass = {
	name:  'first two statements joined',
	apply: target => {
		const at = SlicingCriterion.nameAt(target.criterion);
		const lines = target.code.split('\n');
		return lines.length < 2 || at === undefined || at.line <= 2 || lines[0].trim() === '' || lines[1].trim() === '' ? undefined
			: mapLines(target, ls => [`${ls[0]}; ${ls[1]}`, ...ls.slice(2)], line => line - 1);
	}
};

const OpenBody = /^(function\b|\\\(|if\b|for\b|while\b|repeat\b)/;
const rightAssign: MutationPass = {
	name:  'right assignment',
	apply: target => rewriteAssignments(target, (name, rhs) => rhs.includes('->') || OpenBody.test(rhs) ? undefined : `${rhs} -> ${name}`)
};

const groupedRhs: MutationPass = {
	name:  'grouped right hand side',
	apply: target => rewriteAssignments(target, (name, rhs) => `${name} <- (${rhs})`)
};

const bracedRhs: MutationPass = {
	name:  'braced right hand side',
	apply: target => rewriteAssignments(target, (name, rhs) => `${name} <- { ${rhs} }`)
};

function matchingCloseParen(text: string, open: number): number {
	let depth = 0;
	let quote: string | undefined;
	for(let i = open; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
			continue;
		} else if(c === '"' || c === '\'') {
			quote = c;
		} else if(c === '(') {
			depth++;
		} else if(c === ')') {
			depth--;
			if(depth === 0) {
				return i;
			}
		}
	}
	return -1;
}

function soleCall(text: string): { name: string, args: string } | undefined {
	const head = /^([A-Za-z.][\w.]*)\(/.exec(text);
	if(head === null) {
		return undefined;
	}
	const close = matchingCloseParen(text, head[1].length);
	return close === text.length - 1 ? { name: head[1], args: text.slice(head[1].length + 1, close) } : undefined;
}

function splitTopLevelArgs(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | undefined;
	let start = 0;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
			continue;
		} else if(c === '"' || c === '\'') {
			quote = c;
		} else if('([{'.includes(c)) {
			depth++;
		} else if(')]}'.includes(c)) {
			depth--;
		} else if(c === ',' && depth === 0) {
			parts.push(text.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(text.slice(start));
	return parts.map(p => p.trim()).filter(p => p !== '');
}

const nestedCallToPipe: MutationPass = {
	name:        'nested call rewritten as a pipe',
	minRVersion: PipeVersion,
	apply:       target => !rVersionAtLeast(PipeVersion)
		? undefined
		: rewriteAssignments(target, (name, rhs) => {
			const outer = soleCall(rhs);
			if(outer === undefined) {
				return undefined;
			}
			const inner = soleCall(outer.args);
			if(inner === undefined) {
				return undefined;
			}
			const [piped, ...rest] = splitTopLevelArgs(inner.args);
			return piped === undefined ? undefined : `${name} <- ${piped} |> ${inner.name}(${rest.join(', ')}) |> ${outer.name}()`;
		})
};

const assignCall: MutationPass = {
	name:  'assign call',
	apply: target => {
		const criterionLine = SlicingCriterion.nameAt(target.criterion)?.line;
		return rewriteAssignments(target, (name, rhs, line) => line === criterionLine ? undefined : `assign("${name}", ${rhs})`);
	}
};

const equalsAssign: MutationPass = {
	name:  'equals assignment',
	apply: target => rewriteAssignments(target, (name, rhs) => `${name} = ${rhs}`)
};

function shadowsAttachedBase(name: string): boolean {
	const owner = baseRExportOwner(name);
	return owner !== undefined && AttachedBasePackageSet.has(owner);
}

const superAssign: MutationPass = {
	name:  'top level super assignment',
	apply: target => rewriteAssignments(target, (name, rhs) => shadowsAttachedBase(name) ? undefined : `${name} <<- ${rhs}`)
};

function distinctPlaces(places: readonly SourceRange[]): SourceRange[] {
	return [...new Map(places.map(p => [SourceRange.format(p), p])).values()];
}

function renameOccurrences(code: string, places: readonly SourceRange[], to: string): string {
	const lines = code.split('\n');
	for(const [line, column, , endColumn] of distinctPlaces(places).sort((a, b) => SourceRange.compare(b, a))) {
		lines[line - 1] = lines[line - 1].slice(0, column - 1) + to + lines[line - 1].slice(endColumn);
	}
	return lines.join('\n');
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function renameCriterionTo(target: MutationTarget, occurrencesOf: Occurrences, to: string): Promise<MutationTarget | undefined> {
	const at = SlicingCriterion.nameAt(target.criterion);
	if(at === undefined
		|| !target.code.split('\n').some(l => SimpleAssignment.exec(l)?.[1] === at.name)
		|| new RegExp(String.raw`(["'])[^"']*(?<![\w.])${escapeRegex(at.name)}(?![\w.])[^"']*\1`).test(target.code)) {
		return undefined;
	}
	const places = await occurrencesOf(at.name);
	return places.length === 0 ? undefined
		: { ...target, code: renameOccurrences(target.code, places, to), criterion: `${at.line}@${to}` };
}

const renameCriterion: MutationPass = {
	name:  'renamed criterion variable',
	apply: (target, occurrencesOf) => renameCriterionTo(target, occurrencesOf, `${MutationPrefix}v`)
};

const renameCriterionNonSyntactic: MutationPass = {
	name:  'non-syntactic criterion name',
	apply: (target, occurrencesOf) => renameCriterionTo(target, occurrencesOf, `\`${MutationPrefix}non syntactic\``)
};

const LiteralTakenAsWritten = /\b(library|require|quote|substitute|bquote|expression|deparse)\(\s*([\w.]+\s*=\s*)?$/;

const splitString: MutationPass = {
	name:  'split string literal',
	apply: target => {
		const literal = [...target.code.matchAll(/"[^"\\\n]*"/g)]
			.find(m => m[0].length > 3 && !LiteralTakenAsWritten.test(target.code.slice(0, m.index)));
		if(literal === undefined) {
			return undefined;
		}
		const value = literal[0].slice(1, -1);
		const split = `paste0("${value.slice(0, 1)}", "${value.slice(1)}")`;
		return { ...target, code: target.code.slice(0, literal.index) + split + target.code.slice(literal.index + literal[0].length) };
	}
};

const shiftCriterionValue: MutationPass = {
	name:  'criterion value shifted by one',
	apply: async(target, occurrencesOf) => {
		const at = SlicingCriterion.nameAt(target.criterion);
		const printed = /^\[1] (-?\d+)$/.exec(target.expected);
		const lines = target.code.split('\n');
		if(at === undefined || printed === null || lines[at.line - 1] !== `print(${at.name})`) {
			return undefined;
		}
		const bindings = lines.flatMap((line, index) => {
			const match = SimpleAssignment.exec(line);
			return match?.[1] === at.name ? [{ index, rhs: match[2] }] : [];
		});
		if(bindings.length !== 1 || distinctPlaces(await occurrencesOf(at.name)).length !== 2) {
			return undefined;
		}
		return {
			...target,
			code:     lines.map((l, i) => i === bindings[0].index ? `${at.name} <- (${bindings[0].rhs}) + 1` : l).join('\n'),
			expected: `[1] ${Number(printed[1]) + 1}`
		};
	}
};

const trailingComments: MutationPass = {
	name:  'trailing comments',
	apply: target => mapLines(target, lines => lines.map(l => l.trim() === '' ? l : `${l} # ${MutationPrefix}note`), line => line)
};

const statementBlocks: MutationPass = {
	name:  'every statement in a block',
	apply: target => {
		let changed = false;
		const mutated = mapLines(target, lines => lines.map(l => {
			const wrap = l.trim() !== '' && !l.includes(';');
			changed ||= wrap;
			return wrap ? `{ ${l} }` : l;
		}), line => line);
		return changed ? mutated : undefined;
	}
};

const PrintsNothing = /^([A-Za-z.][\w.]* (<-|=) |print\(|cat\(|invisible\(|library\(|require\(|for\(|while\()/;

const wholeProgramBlock: MutationPass = {
	name:  'whole program in a block',
	apply: target => target.code.split('\n').slice(0, -1).every(l => PrintsNothing.test(l)) ?
		mapLines(target, lines => ['{', ...lines, '}'], line => line + 1) : undefined
};

const semicolonJoined: MutationPass = {
	name:  'semicolon-separated statements',
	apply: target => {
		const at = SlicingCriterion.nameAt(target.criterion);
		const lines = target.code.split('\n');
		if(at === undefined || !lines.every(isWholeStatement)) {
			return undefined;
		}
		const before = lines.slice(0, at.line - 1).filter(l => l.trim() !== '');
		const after = lines.slice(at.line).filter(l => l.trim() !== '');
		if(before.length < 2 && after.length < 2) {
			return undefined;
		}
		const merged = [
			...(before.length > 0 ? [before.join('; ')] : []),
			lines[at.line - 1],
			...(after.length > 0 ? [after.join('; ')] : [])
		];
		return { ...target, code: merged.join('\n'), criterion: `${before.length > 0 ? 2 : 1}@${at.name}` };
	}
};

const BracketClose: Readonly<Record<string, string>> = { '(': ')', '{': '}' };
function findMatchingBracket(text: string, open: number): number | undefined {
	const closeChar = BracketClose[text[open]];
	let depth = 0;
	let quote: string | undefined;
	for(let i = open; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
			continue;
		}
		if(c === '"' || c === '\'') {
			quote = c;
		} else if(c === text[open]) {
			depth++;
		} else if(c === closeChar) {
			depth--;
			if(depth === 0) {
				return i;
			}
		}
	}
	return undefined;
}

const ControlHeader = /^([A-Za-z.][\w.]* (<-|=) )?(if|for|while|function|\\)\s*\(/;
interface ControlHead {
	readonly keyword: 'if' | 'for' | 'while' | 'function' | '\\';
	readonly header:  string;
	readonly rest:    string;
}
function controlHead(line: string): ControlHead | undefined {
	const m = ControlHeader.exec(line);
	if(m === null) {
		return undefined;
	}
	const close = findMatchingBracket(line, m[0].length - 1);
	return close === undefined ? undefined : { keyword: m[3] as ControlHead['keyword'], header: line.slice(0, close + 1), rest: line.slice(close + 1) };
}

function topLevelElseSplit(text: string): readonly [string, string] | undefined {
	let depth = 0;
	let quote: string | undefined;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
			continue;
		}
		if(c === '"' || c === '\'') {
			quote = c;
		} else if('([{'.includes(c)) {
			depth++;
		} else if(')]}'.includes(c)) {
			depth--;
		} else if(depth === 0 && i > 0 && /\s/.test(text[i - 1]) && /^else\b/.test(text.slice(i))) {
			return [text.slice(0, i), text.slice(i + 4)];
		}
	}
	return undefined;
}

function addBraces(line: string): string | undefined {
	const head = controlHead(line);
	if(head === undefined) {
		return undefined;
	}
	const rest = head.rest.trim();
	if(rest === '' || rest.startsWith('{')) {
		return undefined;
	}
	if(head.keyword === 'if') {
		const split = topLevelElseSplit(rest);
		if(split !== undefined) {
			const ifBody = split[0].trim();
			const elseBody = split[1].trim();
			return ifBody === '' || elseBody === '' || ifBody.startsWith('{') || elseBody.startsWith('{') ? undefined
				: `${head.header} { ${ifBody} } else { ${elseBody} }`;
		}
	}
	return `${head.header} { ${rest} }`;
}

const ReadsCodeAsWritten = /\b(body|deparse|substitute|quote|bquote|args|match\.call)\s*\(/;

const bracesAdded: MutationPass = {
	name:  'braces added to a construct body',
	apply: target => {
		if(ReadsCodeAsWritten.test(target.code)) {
			return undefined;
		}
		let changed = false;
		const mutated = mapLines(target, lines => lines.map(l => {
			const rewritten = addBraces(l);
			changed ||= rewritten !== undefined;
			return rewritten ?? l;
		}), line => line);
		return changed ? mutated : undefined;
	}
};

const lambdaShorthand: MutationPass = {
	name:        'lambda shorthand',
	minRVersion: MIN_VERSION_LAMBDA,
	apply:       target => !rVersionAtLeast(MIN_VERSION_LAMBDA) || !/\bfunction\s*\(/.test(target.code)
		? undefined
		: { ...target, code: target.code.replace(/\bfunction\s*\(/g, '\\(') }
};

/** every pass a mutant is generated for; add to this list to check another rewrite */
export const MutationPasses: readonly MutationPass[] = [
	leadingNoise,
	trailingNoise,
	comments,
	trailingComments,
	blankLines,
	joinFirstTwo,
	statementBlocks,
	wholeProgramBlock,
	rightAssign,
	groupedRhs,
	bracedRhs,
	assignCall,
	equalsAssign,
	superAssign,
	renameCriterion,
	renameCriterionNonSyntactic,
	splitString,
	shiftCriterionValue,
	semicolonJoined,
	bracesAdded,
	lambdaShorthand,
	nestedCallToPipe
];

const analyzers = new WeakMap<KnownParser, Map<string, Promise<FlowrAnalyzer>>>();
function analyzerFor(parser: KnownParser, code: string): Promise<FlowrAnalyzer> {
	const known = analyzers.get(parser) ?? new Map<string, Promise<FlowrAnalyzer>>();
	analyzers.set(parser, known);
	const analyzer = known.get(code) ?? new FlowrAnalyzerBuilder().setParser(parser).build().then(a => (a.addRequest(code), a));
	known.set(code, analyzer);
	return analyzer;
}

/** the slice of `code` for `criterion`, which is empty where the criterion resolves to nothing */
export async function slice(parser: KnownParser, { code, criterion }: MutationTarget): Promise<string> {
	const result = await createSlicePipeline(parser, { getId: deterministicCountingIdGenerator(0), context: contextFromInput(code), criterion: [criterion] }).allRemainingSteps();
	const reconstructed = result.reconstruct.code;
	return Array.isArray(reconstructed) ? reconstructed.join('\n') : reconstructed;
}

/** applies one pass, letting it locate what it rewrites with the flowR search */
export async function mutate(parser: KnownParser, target: MutationTarget, pass: MutationPass): Promise<MutationTarget | undefined> {
	return pass.apply(target, async name => {
		const analyzer = await analyzerFor(parser, target.code);
		return (await analyzer.runSearch(Q.var(name).build())).getElements()
			.flatMap(e => RSymbol.is(e.node) && e.node.location !== undefined ? [e.node.location] : []);
	});
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
export async function observeQueries(parser: KnownParser, code: string): Promise<QueryObservation> {
	const analyzer = await analyzerFor(parser, code);
	const results = await analyzer.query([
		{ type: 'dependencies' }, { type: 'inspect-higher-order' }, { type: 'inspect-recursion' },
		{ type: 'inspect-exception' }, { type: 'inspect-fn-props' }
	]);
	return {
		dependencies: dependenciesOf(results.dependencies),
		higherOrder:  Object.values(results['inspect-higher-order'].higherOrder).map(String).sort(),
		recursive:    Object.values(results['inspect-recursion'].recursive).map(String).sort(),
		exceptions:   Object.values(results['inspect-exception'].exceptions).map(t => String(t.length)).sort(),
		roles:        Object.values(results['inspect-fn-props'].roles).map(r => JSON.stringify(Object.values(r).sort())).sort(),
		props:        Object.values(results['inspect-fn-props'].props).map(p => JSON.stringify(p)).sort()
	};
}
