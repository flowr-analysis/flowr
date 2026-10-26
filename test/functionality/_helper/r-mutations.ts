import { escapeRegex } from '../../../src/util/text/strings';
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
import { replProcessAnswer } from '../../../src/cli/repl/core';
import { voidFormatter } from '../../../src/util/text/ansi';

export interface MutationTarget {
	/** the program to mutate */
	readonly code:      string;
	/** where to slice, in the only form the passes can move along */
	readonly criterion: `${number}@${string}`;
	/** what {@link code} prints when it is run */
	readonly expected:  string;
	/** the names a pass gave the variables, each mapped to the one the program had before */
	readonly renames?:  Readonly<Record<string, string>>;
}

/** where a name is written down in the program being mutated, as the flowR search finds it */
export type Occurrences = (name: string) => Promise<readonly SourceRange[]>;

/** one rewrite, applied to every counterexample it fits */
export interface MutationPass {
	/** what the mutants of this pass are named after */
	readonly name:         string;
	/** the R version the rewrite needs, so a host below it explains an idle pass without a name list */
	readonly minRVersion?: string;
	/** the rewrite only moves code around or renames it, so the graphs flowR builds keep their shape */
	readonly keepsGraph?:  boolean;
	/** the rewrite adds code of its own, about which the linter may say more, but never less */
	readonly adds?:        boolean;
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
	adds:  true,
	apply: target => mapLines(target, lines => [`${MutationPrefix}a <- 1`, `${MutationPrefix}b <- ${MutationPrefix}a + 1`, ...lines], line => line + 2)
};

const trailingNoise: MutationPass = {
	name:  'trailing noise',
	adds:  true,
	apply: target => /^(print|invisible|cat)\(/.test(target.code.split('\n').at(-1) ?? '') ?
		mapLines(target, lines => [...lines, `${MutationPrefix}c <- 2`], line => line) : undefined
};

const comments: MutationPass = {
	name:       'interleaved comments',
	keepsGraph: true,
	apply:      target => mapLines(target, lines => lines.flatMap(l => [`# ${MutationPrefix}note`, l]), line => line * 2)
};

const blankLines: MutationPass = {
	name:       'interleaved blank lines',
	keepsGraph: true,
	apply:      target => mapLines(target, lines => lines.flatMap(l => ['', l]), line => line * 2)
};

const joinFirstTwo: MutationPass = {
	name:       'first two statements joined',
	keepsGraph: true,
	apply:      target => {
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

function renameAll(code: string, edits: readonly (readonly [SourceRange, string])[]): string {
	const lines = code.split('\n');
	for(const [[line, column, , endColumn], to] of [...edits].sort(([a], [b]) => SourceRange.compare(b, a))) {
		lines[line - 1] = lines[line - 1].slice(0, column - 1) + to + lines[line - 1].slice(endColumn);
	}
	return lines.join('\n');
}

function renameOccurrences(code: string, places: readonly SourceRange[], to: string): string {
	return renameAll(code, distinctPlaces(places).map(p => [p, to] as const));
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
		: { ...target, code: renameOccurrences(target.code, places, to), criterion: `${at.line}@${to}`, renames: { [to]: at.name } };
}

const renameCriterion: MutationPass = {
	name:       'renamed criterion variable',
	keepsGraph: true,
	apply:      (target, occurrencesOf) => renameCriterionTo(target, occurrencesOf, `${MutationPrefix}v`)
};

const renameCriterionNonSyntactic: MutationPass = {
	name:  'non-syntactic criterion name',
	apply: (target, occurrencesOf) => renameCriterionTo(target, occurrencesOf, `\`${MutationPrefix}non syntactic\``)
};

const LiteralTakenAsWritten = /\b(library|require|quote|substitute|bquote|expression|deparse)\(\s*([\w.]+\s*=\s*)?$/;

const splitString: MutationPass = {
	name:  'split string literal',
	apply: target => {
		const literal = replaceableLiteral(target.code, v => v.length > 1);
		if(literal === undefined) {
			return undefined;
		}
		const value = literal[0].slice(1, -1);
		return { ...target, code: replaceLiteral(target, literal, `paste0("${value.slice(0, 1)}", "${value.slice(1)}")`) };
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
	name:       'trailing comments',
	keepsGraph: true,
	apply:      target => mapLines(target, lines => lines.map(l => l.trim() === '' ? l : `${l} # ${MutationPrefix}note`), line => line)
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
	name:       'semicolon-separated statements',
	keepsGraph: true,
	apply:      target => {
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

/** the first string literal a pass may replace by an expression of the same value */
function replaceableLiteral(code: string, fits: (value: string) => boolean = () => true): RegExpMatchArray | undefined {
	/* an escape is skipped over so the next literal starts where R starts it, but a literal holding one is left alone */
	return [...code.matchAll(/"(?:[^"\\\n]|\\.)*"/g)].find(m => !m[0].includes('\\') && fits(m[0].slice(1, -1)) && !LiteralTakenAsWritten.test(code.slice(0, m.index)));
}

function replaceLiteral(target: MutationTarget, literal: RegExpMatchArray, by: string): string {
	return target.code.slice(0, literal.index) + by + target.code.slice((literal.index ?? 0) + literal[0].length);
}

const hoistString: MutationPass = {
	name:  'string literal hoisted into a variable',
	adds:  true,
	apply: target => {
		const literal = replaceableLiteral(target.code);
		return literal === undefined ? undefined
			: mapLines({ ...target, code: replaceLiteral(target, literal, `${MutationPrefix}s`) }, lines => [`${MutationPrefix}s <- ${literal[0]}`, ...lines], line => line + 1);
	}
};

const sprintfString: MutationPass = {
	name:  'string literal formatted by sprintf',
	apply: target => {
		const literal = replaceableLiteral(target.code);
		return literal === undefined ? undefined : { ...target, code: replaceLiteral(target, literal, `sprintf("%s", ${literal[0]})`) };
	}
};

const filePathString: MutationPass = {
	name:  'path literal built by file.path',
	apply: target => {
		const literal = replaceableLiteral(target.code, v => /^[^/]+(\/[^/]+)+$/.test(v));
		return literal === undefined ? undefined
			: { ...target, code: replaceLiteral(target, literal, `file.path(${literal[0].slice(1, -1).split('/').map(p => `"${p}"`).join(', ')})`) };
	}
};

/* rewriting a call with do.call forces its arguments first and moves where it is called from */
const ArgumentsTakenLazily = /<<-|\bsubstitute\(|\bmissing\(|match\.call|sys\.call|sys\.function|parent\.frame|eval\.parent|\bdeparse\(|\bquote\(|on\.exit/;
const CalledAsWritten: ReadonlySet<string> = new Set([
	'library', 'require', 'requireNamespace', 'quote', 'bquote', 'substitute', 'expression', 'function', 'local', 'eval', 'evalq',
	'tryCatch', 'try', 'withCallingHandlers', 'suppressWarnings', 'suppressMessages', 'invisible', 'with', 'within', 'subset', 'transform',
	'switch', 'missing', 'on.exit', 'Recall', 'UseMethod', 'NextMethod', 'standardGeneric', 'environment', 'sys.call', 'match.arg',
	'data', 'system.time', 'force', 'delayedAssign', 'makeActiveBinding', 'setRefClass', 'new', 'ls', 'rm', 'exists', 'get', 'get0', 'mget', 'assign'
]);

const doCall: MutationPass = {
	name:  'call made by do.call',
	apply: target => ArgumentsTakenLazily.test(target.code) ? undefined : rewriteAssignments(target, (name, rhs) => {
		const call = soleCall(rhs);
		if(call === undefined || CalledAsWritten.has(call.name) || /(^|[^\w.])function\s*\(|\\\(|\.\.\./.test(call.args)) {
			return undefined;
		}
		return `${name} <- do.call(${call.name}, list(${splitTopLevelArgs(call.args).join(', ')}))`;
	})
};

const guardedByIf: MutationPass = {
	name:  'every statement guarded by if(TRUE)',
	apply: target => {
		let changed = false;
		const mutated = mapLines(target, lines => lines.map(l => {
			const guard = l.trim() !== '' && !l.includes(';') && !/^(if|else|for|while|repeat|function)\b/.test(l.trim());
			changed ||= guard;
			return guard ? `if(TRUE) ${l}` : l;
		}), line => line);
		return changed ? mutated : undefined;
	}
};

/* inside `local` an assignment binds in a fresh frame, which these see as different from the global one */
const SeesTheFrame = /<<-|parent\.frame|sys\.|environment\(|globalenv|\.GlobalEnv|assign\(|eval\.parent|makeActiveBinding|list2env|\bls\(|\brm\(|exists\(|\bget0?\(|mget\(|setRefClass|search\(|attach\(|source\(|sys\.source|\bload\(|\bdata\(/;

const wholeProgramLocal: MutationPass = {
	name:  'whole program in local',
	apply: target => !SeesTheFrame.test(target.code) && target.code.split('\n').slice(0, -1).every(l => PrintsNothing.test(l)) ?
		mapLines(target, lines => ['local({', ...lines, '})'], line => line + 1) : undefined
};

interface Token {
	readonly kind:   'name' | 'number' | 'string' | 'other';
	readonly text:   string;
	readonly line:   number;
	readonly column: number;
	readonly index:  number;
}

const TokenPatterns: readonly (readonly [Token['kind'], RegExp])[] = [
	['number', /(?:0[xX][\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[Li]?/y],
	['name', /(?:[A-Za-z]|\.(?!\d))[\w.]*/y],
	['other', /<<-|->>|<-|->|\|>|::|[=!<>]=|&&|\|\||%[^%\n]*%|\S/y]
];

/** the tokens of `code`, comments left out and every literal kept whole, with where each one starts */
function tokensOf(code: string): Token[] {
	const tokens: Token[] = [];
	let line = 1;
	let lineStart = 0;
	for(let i = 0; i < code.length;) {
		const c = code[i];
		if(c === '\n') {
			line++;
			lineStart = ++i;
			continue;
		} else if(/\s/.test(c)) {
			i++;
			continue;
		} else if(c === '#') {
			while(i < code.length && code[i] !== '\n') {
				i++;
			}
			continue;
		}
		let end = i + 1;
		let kind: Token['kind'] = 'other';
		if(c === '"' || c === '\'' || c === '`') {
			while(end < code.length && code[end] !== c) {
				end += code[end] === '\\' ? 2 : 1;
			}
			end++;
			kind = c === '`' ? 'name' : 'string';
		} else {
			for(const [k, pattern] of TokenPatterns) {
				pattern.lastIndex = i;
				const m = pattern.exec(code);
				if(m !== null) {
					end = i + m[0].length;
					kind = k;
					break;
				}
			}
		}
		const text = code.slice(i, end);
		tokens.push({ kind, text, line, column: i - lineStart + 1, index: i });
		const breaks = text.split('\n').length - 1;
		if(breaks > 0) {
			line += breaks;
			lineStart = i + text.lastIndexOf('\n') + 1;
		}
		i = end;
	}
	return tokens;
}

/** the positions in `tokens` that are formal parameters of a function header */
function formalsOf(tokens: readonly Token[]): Set<number> {
	const formals = new Set<number>();
	tokens.forEach((t, i) => {
		if(!(t.text === 'function' || t.text === '\\') || tokens[i + 1]?.text !== '(') {
			return;
		}
		let depth = 0;
		for(let j = i + 1; j < tokens.length; j++) {
			const text = tokens[j].text;
			depth += '([{'.includes(text) ? 1 : ')]}'.includes(text) ? -1 : 0;
			if(depth === 0) {
				return;
			} else if(depth === 1 && tokens[j].kind === 'name' && (tokens[j - 1].text === '(' || tokens[j - 1].text === ',')) {
				formals.add(j);
			}
		}
	});
	return formals;
}

/* a program using any of these may read a name as data, so renaming the binding would change what it finds */
const ReadsNamesAsData = /\b(get0?|mget|exists|assign|rm|ls|eval|evalq|as\.name|as\.symbol|match\.fun|do\.call|environment|sys\.[\w.]+|parent\.(frame|env)|list2env|makeActiveBinding|delayedAssign|substitute|deparse|quote|bquote|body|formals|args|match\.arg|match\.call|missing|with|within|subset|transform|attach|library|require|requireNamespace|loadNamespace|setRefClass|new|Recall|UseMethod|NextMethod|setClass|setGeneric|setMethod|data|load|save|source|sys\.source|aes)\s*\(|[~`@]/;

/**
 * The names a program binds that every reference reaches under the same spelling: never an argument name, a
 * `$` or `@` access, a package, a string or a name an attached package exports, as a renaming must leave those be.
 */
function renameableNames(tokens: readonly Token[]): string[] {
	const formals = formalsOf(tokens);
	const bound = new Set<string>();
	const unsafe = new Set<string>();
	tokens.forEach((t, i) => {
		if(t.kind === 'string') {
			for(const word of t.text.match(/[A-Za-z.][\w.]*/g) ?? []) {
				unsafe.add(word);
			}
		}
		if(t.kind !== 'name') {
			return;
		}
		const before = tokens[i - 1]?.text;
		const after = tokens[i + 1]?.text;
		if(before === '$' || before === '@' || before === '::' || after === '::' || (after === '=' && !formals.has(i)) || t.text.startsWith('..')) {
			unsafe.add(t.text);
		} else if(formals.has(i) || after === '<-' || after === '<<-' || before === '->' || before === '->>'
			|| (tokens[i - 2]?.text === 'for' && before === '(' && after === 'in')) {
			bound.add(t.text);
		}
	});
	/* a dotted name may be an S3 method, which dispatch finds by its spelling */
	return [...bound].filter(n => !unsafe.has(n) && !n.includes('.') && baseRExportOwner(n) === undefined && !/^(T|F|function|if|else|for|while|repeat|in|next|break|TRUE|FALSE|NULL|NA|Inf|NaN)$/.test(n));
}

async function renameConsistently(target: MutationTarget, occurrencesOf: Occurrences, fresh: (index: number) => string): Promise<MutationTarget | undefined> {
	const at = SlicingCriterion.nameAt(target.criterion);
	if(at === undefined || ReadsNamesAsData.test(target.code)) {
		return undefined;
	}
	const tokens = tokensOf(target.code);
	const edits: (readonly [SourceRange, string])[] = [];
	const renames: Record<string, string> = {};
	for(const name of renameableNames(tokens)) {
		const written = tokens.filter(t => t.kind === 'name' && t.text === name).map(t => `${t.line}.${t.column}`).sort();
		const places = distinctPlaces(await occurrencesOf(name));
		/* the search and the spelling have to agree on every occurrence, or one of them sees something the other does not */
		if(places.map(([l, c]) => `${l}.${c}`).sort().join() !== written.join()) {
			continue;
		}
		const to = fresh(Object.keys(renames).length + 1);
		renames[to] = name;
		edits.push(...places.map(p => [p, to] as const));
	}
	if(edits.length === 0) {
		return undefined;
	}
	const renamed = Object.entries(renames).find(([, from]) => from === at.name)?.[0];
	return { ...target, code: renameAll(target.code, edits), criterion: `${at.line}@${renamed ?? at.name}`, renames };
}

const isomorphicRenaming: MutationPass = {
	name:       'every variable renamed',
	keepsGraph: true,
	apply:      (target, occurrencesOf) => renameConsistently(target, occurrencesOf, i => `${MutationPrefix}r${i}`)
};

const isomorphicRenamingNonSyntactic: MutationPass = {
	name:  'every variable renamed to a non-syntactic name',
	apply: (target, occurrencesOf) => renameConsistently(target, occurrencesOf, i => `\`${MutationPrefix}r ${i}\``)
};

/** calls whose result depends on nothing but their arguments and that change nothing, so two of them may trade places */
const PureCalls: ReadonlySet<string> = new Set([
	'c', 'list', 'rep', 'seq', 'seq_len', 'seq_along', 'numeric', 'character', 'logical', 'integer', 'paste', 'paste0', 'sum', 'length',
	'nchar', 'toupper', 'tolower', 'file.path', 'new.env', 'data.frame', 'matrix', 'factor', 'as.character', 'as.numeric', 'as.integer',
	'unlist', 'rev', 'sort', 'max', 'min', 'mean', 'abs', 'sqrt', 'round', 'setNames', 'identity', 'tempdir', 'names', 'sprintf'
]);

function isPureRhs(rhs: string): boolean {
	if(/^(function\b|\\\()/.test(rhs)) {
		return true;
	}
	const tokens = tokensOf(rhs);
	return tokens.every((t, i) => !['<-', '<<-', '->', '->>', '=', '|>', '$', '[', '[[', '@'].includes(t.text) && t.text !== 'function'
		&& (t.kind !== 'name' || tokens[i + 1]?.text !== '(' || PureCalls.has(t.text)));
}

const swapIndependent: MutationPass = {
	name:  'independent statements swapped',
	apply: target => {
		const at = SlicingCriterion.nameAt(target.criterion);
		const lines = target.code.split('\n');
		if(at === undefined) {
			return undefined;
		}
		for(let i = 0; i + 1 < at.line - 1; i++) {
			const [a, b] = [SimpleAssignment.exec(lines[i]), SimpleAssignment.exec(lines[i + 1])];
			if(a === null || b === null || a[1] === b[1] || lines[i].includes(';') || lines[i + 1].includes(';') || !isPureRhs(a[2]) || !isPureRhs(b[2])) {
				continue;
			}
			const reads = (rhs: string, name: string) => tokensOf(rhs).some(t => t.text === name);
			if(reads(a[2], b[1]) || reads(b[2], a[1])) {
				continue;
			}
			return mapLines(target, ls => ls.map((l, k) => k === i ? ls[i + 1] : k === i + 1 ? ls[i] : l), line => line);
		}
		return undefined;
	}
};

const deadStore: MutationPass = {
	name:  'dead assignment to the criterion variable',
	adds:  true,
	apply: target => {
		const at = SlicingCriterion.nameAt(target.criterion);
		return at === undefined || !target.code.split('\n').some(l => SimpleAssignment.exec(l)?.[1] === at.name) ? undefined
			: mapLines(target, lines => lines.flatMap((l, i) => i === at.line - 1 ? [`if(FALSE) ${at.name} <- NULL`, l] : [l]), line => line + 1);
	}
};

/** a condition whose value is a single logical, so that negating it swaps the branches and nothing else */
const LogicalCondition = /[<>]=?|[!=]=|&&|\|\||%in%|\bis\.[\w.]+\(|^\s*!|^\s*(TRUE|FALSE)\s*$/;

/** the prefix before the keyword of a header and its condition, if the condition is a single logical */
function conditionOf(header: string, keyword: 'if' | 'while'): readonly [string, string] | undefined {
	const m = new RegExp(String.raw`^(.*?)\b${keyword}\s*\((.*)\)$`, 's').exec(header);
	return m !== null && LogicalCondition.test(m[2]) && !/<-|<<-|->/.test(m[2]) ? [m[1], m[2]] : undefined;
}

/** whether a `;` outside of any bracket ends the construct early, so what follows it is no part of its body */
function hasTopLevelSemicolon(text: string): boolean {
	return bodyEnd(text, 0) < text.length && text[bodyEnd(text, 0)] === ';';
}

const braced = (body: string): string => body.startsWith('{') ? body : `{ ${body} }`;

const ifElseSwapped: MutationPass = {
	name:  'if and else swapped under a negated condition',
	apply: target => {
		if(ReadsCodeAsWritten.test(target.code)) {
			return undefined;
		}
		let changed = false;
		const mutated = mapLines(target, lines => lines.map(l => {
			const head = controlHead(l);
			const split = head?.keyword === 'if' && !hasTopLevelSemicolon(head.rest) ? topLevelElseSplit(head.rest.trim()) : undefined;
			const condition = head && split ? conditionOf(head.header, 'if') : undefined;
			if(split === undefined || condition === undefined || split[0].trim() === '' || split[1].trim() === '') {
				return l;
			}
			changed = true;
			return `${condition[0]}if(!(${condition[1]})) ${braced(split[1].trim())} else ${braced(split[0].trim())}`;
		}), line => line);
		return changed ? mutated : undefined;
	}
};

const whileAsRepeat: MutationPass = {
	name:  'while loop as a repeat loop',
	apply: target => {
		let changed = false;
		const mutated = mapLines(target, lines => lines.map(l => {
			const head = controlHead(l);
			const condition = head?.keyword === 'while' && head.header.startsWith('while') ? conditionOf(head.header, 'while') : undefined;
			const body = head?.rest.trim();
			if(condition === undefined || !body || hasTopLevelSemicolon(body)) {
				return l;
			}
			changed = true;
			return `repeat { if(!(${condition[1]})) break; ${body} }`;
		}), line => line);
		return changed ? mutated : undefined;
	}
};

/* a sequence that is never empty, as a for loop over an empty one leaves its variable NULL */
const ForHead = /^for\(([A-Za-z.][\w.]*) in (\d+:\d+)\)$/;

const forAsWhile: MutationPass = {
	name:  'for loop as a while loop',
	adds:  true,
	apply: target => {
		let changed = false;
		const mutated = mapLines(target, lines => lines.map(l => {
			const head = controlHead(l);
			const m = head?.keyword === 'for' ? ForHead.exec(head.header) : null;
			const body = head?.rest.trim();
			if(m === null || !body || hasTopLevelSemicolon(body)) {
				return l;
			}
			changed = true;
			return `${MutationPrefix}seq <- ${m[2]}; ${MutationPrefix}k <- 0L; while(${MutationPrefix}k < length(${MutationPrefix}seq)) { ${MutationPrefix}k <- ${MutationPrefix}k + 1L; ${m[1]} <- ${MutationPrefix}seq[[${MutationPrefix}k]]; ${body} }`;
		}), line => line);
		return changed ? mutated : undefined;
	}
};

/* these name their result after how an argument is written, which a wrapper around the argument changes */
const DeparsesArguments: ReadonlySet<string> = new Set([
	'data.frame', 'cbind', 'rbind', 'table', 'aes', 'ggplot', 'plot', 'hist', 'boxplot', 'barplot', 'lines', 'points', 'curve', 'xtabs', 'list'
]);

const identityArgument: MutationPass = {
	name:  'argument passed through identity',
	apply: target => ArgumentsTakenLazily.test(target.code) ? undefined : rewriteAssignments(target, (name, rhs) => {
		const call = soleCall(rhs);
		if(call === undefined || CalledAsWritten.has(call.name) || DeparsesArguments.has(call.name)) {
			return undefined;
		}
		const args = splitTopLevelArgs(call.args);
		const at = args.findIndex(a => /^[A-Za-z.][\w.]*$/.test(a) && !a.startsWith('..'));
		return at < 0 ? undefined : `${name} <- ${call.name}(${args.map((a, i) => i === at ? `identity(${a})` : a).join(', ')})`;
	})
};

/** where the body of a function written without braces ends, at the end of its line or the bracket enclosing it */
function bodyEnd(text: string, start: number): number {
	let depth = 0;
	let quote: string | undefined;
	for(let i = start; i < text.length; i++) {
		const c = text[i];
		if(quote !== undefined) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
			continue;
		} else if(c === '"' || c === '\'' || c === '`') {
			quote = c;
		} else if('([{'.includes(c)) {
			depth++;
		} else if(')]}'.includes(c)) {
			if(--depth < 0) {
				return i;
			}
		} else if(depth === 0 && (c === ',' || c === ';' || c === '\n' || c === '#')) {
			return i;
		}
	}
	return text.length;
}

const explicitReturn: MutationPass = {
	name:  'function result made an explicit return',
	apply: target => {
		if(ReadsCodeAsWritten.test(target.code)) {
			return undefined;
		}
		const heads = tokensOf(target.code).flatMap((t, i, all) => (t.text === 'function' || t.text === '\\') && all[i + 1]?.text === '(' ? [all[i + 1].index] : []);
		let code = target.code;
		for(const open of heads.reverse()) {
			const close = findMatchingBracket(code, open);
			const start = close === undefined ? -1 : code.slice(close + 1).search(/\S/) + close + 1;
			if(close === undefined || start <= close || code[start] === '{') {
				continue;
			}
			const end = bodyEnd(code, start);
			const body = code.slice(start, end).trimEnd();
			if(body === '' || body.startsWith('return(')) {
				continue;
			}
			code = `${code.slice(0, start)}return(${body})${code.slice(start + body.length)}`;
		}
		return code === target.code ? undefined : { ...target, code };
	}
};

const pipeAsCall: MutationPass = {
	name:  'pipe rewritten as a nested call',
	apply: target => {
		let changed = false;
		const mutated = mapLines(target, lines => lines.map(l => {
			const m = /^([A-Za-z.][\w.]* <- )?(.+?) \|> ([A-Za-z.][\w.]*)\((.*)\)$/.exec(l);
			/* the pipe binds tighter than any operator, so only a primary on its left is the whole first argument */
			const primary = /^([A-Za-z.][\w.]*|"[^"\\]*"|'[^'\\]*'|\d+(\.\d+)?L?)$/.test(m?.[2] ?? '') || soleCall(m?.[2] ?? '') !== undefined;
			if(m === null || !primary || m[4].includes('|>') || /\b_\b/.test(m[4]) || soleCall(`${m[3]}(${m[4]})`) === undefined) {
				return l;
			}
			changed = true;
			return `${m[1] ?? ''}${m[3]}(${[m[2], ...splitTopLevelArgs(m[4])].join(', ')})`;
		}), line => line);
		return changed ? mutated : undefined;
	}
};

const singleQuoted: MutationPass = {
	name:  'string literals in single quotes',
	apply: target => {
		const literals = tokensOf(target.code).filter(t => t.kind === 'string' && t.text.startsWith('"') && !/['\\]/.test(t.text));
		let code = target.code;
		for(const t of literals.reverse()) {
			code = `${code.slice(0, t.index)}'${t.text.slice(1, -1)}'${code.slice(t.index + t.text.length)}`;
		}
		return literals.length === 0 ? undefined : { ...target, code };
	}
};

const scientificNumbers: MutationPass = {
	name:  'numbers in scientific notation',
	apply: target => {
		if(ReadsCodeAsWritten.test(target.code) || target.code.includes('~')) {
			return undefined;
		}
		const numbers = tokensOf(target.code).filter(t => t.kind === 'number' && /^\d+$/.test(t.text));
		let code = target.code;
		for(const t of numbers.reverse()) {
			code = `${code.slice(0, t.index + t.text.length)}e0${code.slice(t.index + t.text.length)}`;
		}
		return numbers.length === 0 ? undefined : { ...target, code };
	}
};

const assignmentContinued: MutationPass = {
	name:       'assignment continued on the next line',
	keepsGraph: true,
	apply:      target => {
		const at = SlicingCriterion.nameAt(target.criterion);
		const lines = target.code.split('\n');
		const splits = lines.map((l, i) => i < (at?.line ?? 0) - 1 && SimpleAssignment.test(l) && !l.includes(';'));
		return !splits.some(Boolean) ? undefined : mapLines(target,
			ls => ls.flatMap((l, i) => {
				const m = splits[i] ? SimpleAssignment.exec(l) : null;
				return m === null ? [l] : [`${m[1]} <-`, `  ${m[2]}`];
			}),
			line => line + splits.slice(0, line - 1).filter(Boolean).length);
	}
};

const irregularWhitespace: MutationPass = {
	name:       'irregular whitespace around assignments',
	keepsGraph: true,
	apply:      target => rewriteAssignments(target, (name, rhs) => `${name}\t<-   ${rhs}`)
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
	nestedCallToPipe,
	hoistString,
	sprintfString,
	filePathString,
	doCall,
	guardedByIf,
	wholeProgramLocal,
	isomorphicRenaming,
	isomorphicRenamingNonSyntactic,
	swapIndependent,
	deadStore,
	ifElseSwapped,
	whileAsRepeat,
	forAsWhile,
	identityArgument,
	explicitReturn,
	pipeAsCall,
	singleQuoted,
	scientificNumbers,
	assignmentContinued,
	irregularWhitespace
];

const analyzers = new WeakMap<KnownParser, Map<string, Promise<FlowrAnalyzer>>>();
function analyzerFor(parser: KnownParser, code: string): Promise<FlowrAnalyzer> {
	const known = analyzers.get(parser) ?? new Map<string, Promise<FlowrAnalyzer>>();
	analyzers.set(parser, known);
	const analyzer = known.get(code) ?? new FlowrAnalyzerBuilder()
		.setParser(parser).build().then(a => (a.addRequest(code), a));
	known.set(code, analyzer);
	return analyzer;
}

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

/** applies one pass, letting it locate what it rewrites with the flowR search */
export async function mutate(parser: KnownParser, target: MutationTarget, pass: MutationPass): Promise<MutationTarget | undefined> {
	return pass.apply(target, async name => {
		const analyzer = await analyzerFor(parser, target.code);
		return (await analyzer.runSearch(Q.var(name).build())).getElements()
			.flatMap(e => RSymbol.is(e.node) && e.node.location !== undefined ? [e.node.location] : []);
	});
}

/** `text` with every name a pass gave a variable replaced by the one the variable had before */
function unrenamed(text: string, renames: Readonly<Record<string, string>> = {}): string {
	return Object.entries(renames).flatMap(([to, from]) => to.startsWith('`') ? [[to, from], [to.slice(1, -1), from]] : [[to, from]])
		.sort(([a], [b]) => b.length - a.length)
		.reduce((t, [to, from]) => t.replace(new RegExp(String.raw`(?<![\w.])${escapeRegex(to)}(?![\w.])`, 'g'), from), text);
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
		dependencies: dependenciesOf(results.dependencies).map(d => unrenamed(d, renames)),
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

/** the names as the program had them before the pass, and no position, as a pass moves those */
function neutralized(lines: readonly string[], renames: Readonly<Record<string, string>> = {}): string[] {
	return lines.map(l => unrenamed(l, renames).replace(/\b\d+\.\d+(?:-\d+(?:\.\d+)?)?\b/g, '').replace(/\(node \d+\)|\{-?\d+@[^{}]*\}/g, ''));
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
			findings.push(`${rule} ${certainty}: ${line.trim()}`);
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
		graphs.push(command.split(' ')[0], ...await replLines(parser, `${command} ${code}`));
	}
	return {
		slice:        slice.join('\n'),
		dependencies: neutralized(await replLines(parser, `:query @dependencies ${code}`), target.renames),
		linter:       linterFindings(neutralized(await replLines(parser, `:query @linter ${code}`), target.renames)),
		graphs:       neutralized(graphs, target.renames).map(l => l.replace(/\s+/g, ''))
	};
}
