/**
 * Metamorphic mutations for R programs. A pass rewrites a program together with the criterion pointing into it
 * and the output it is known to print. Most passes keep that output, {@link shiftCriterionValue} changes it.
 * @module
 */
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import type { KnownParser } from '../../../src/r-bridge/parser';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { FlowrAnalyzer } from '../../../src/project/flowr-analyzer';
import { Q } from '../../../src/search/flowr-search-builder';
import { RSymbol } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { SourceRange } from '../../../src/util/range';
import type { DependenciesQueryResult, DependencyInfo } from '../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import { UnnamedFunctionCallPrefix } from '../../../src/dataflow/internal/process/functions/call/unnamed-call-handling';

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
	readonly name:  string;
	/** the mutated program, or `undefined` if the pass does not apply */
	readonly apply: (target: MutationTarget, occurrencesOf: Occurrences) => Promise<MutationTarget | undefined> | MutationTarget | undefined;
}

/** prefix of the names a pass introduces; a dotted one would survive {@link RShell#clearEnvironment}'s `ls()` */
const MutationPrefix = 'mut_';

/** an assignment of one expression to a plain name */
const SimpleAssignment = /^([A-Za-z.][\w.]*) <- (.+)$/;

/** whether the line holds one whole statement, so that rewriting it cannot spill into the next one */
function isWholeStatement(line: string): boolean {
	let depth = 0;
	for(const c of line) {
		depth += '([{'.includes(c) ? 1 : ')]}'.includes(c) ? -1 : 0;
	}
	return depth === 0 && !line.includes('#')
		&& (line.match(/"/g)?.length ?? 0) % 2 === 0 && (line.match(/'/g)?.length ?? 0) % 2 === 0
		/* a trailing operator asks R for the rest of the expression on the next line */
		&& !/([-+*/^,~|&<>=!]|%[^%]*%)$/.test(line.trimEnd());
}

/** rewrites the lines of a program and moves the criterion along, unless a line spans more than its own statement */
function mapLines(target: MutationTarget, map: (lines: readonly string[]) => string[], criterionLine: (line: number) => number): MutationTarget | undefined {
	const at = SlicingCriterion.nameAt(target.criterion);
	const lines = target.code.split('\n');
	return at === undefined || !lines.every(isWholeStatement) ? undefined
		: { ...target, code: map(lines).join('\n'), criterion: `${criterionLine(at.line)}@${at.name}` };
}

/** rewrites every assignment the pass accepts; a `;` on the right holds another statement and is left alone */
function rewriteAssignments(target: MutationTarget, rewrite: (name: string, rhs: string) => string | undefined): MutationTarget | undefined {
	let changed = false;
	const mutated = mapLines(target, lines => lines.map(l => {
		const match = SimpleAssignment.exec(l);
		const rewritten = match === null || match[2].includes(';') ? undefined : rewrite(match[1], match[2]);
		changed ||= rewritten !== undefined;
		return rewritten ?? l;
	}), line => line);
	return changed ? mutated : undefined;
}

/** prepends bindings nothing reads, shifting every line the criterion may point at */
const leadingNoise: MutationPass = {
	name:  'leading noise',
	apply: target => mapLines(target, lines => [`${MutationPrefix}a <- 1`, `${MutationPrefix}b <- ${MutationPrefix}a + 1`, ...lines], line => line + 2)
};

/**
 * Appends a binding nothing reads, only where the program prints explicitly. The whole program is evaluated as
 * one expression, so an invisible assignment after a bare value would take the print of that value away.
 */
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

/** puts the first two statements on one line, so that the criterion no longer has a line of its own */
const joinFirstTwo: MutationPass = {
	name:  'first two statements joined',
	apply: target => {
		/* on the joined line the criterion would name the first of the two occurrences, which is another node */
		const at = SlicingCriterion.nameAt(target.criterion);
		return target.code.split('\n').length < 2 || at === undefined || at.line <= 2 ? undefined
			: mapLines(target, lines => [`${lines[0]}; ${lines[1]}`, ...lines.slice(2)], line => line - 1);
	}
};

/**
 * `e -> x` binds what `x <- e` binds, except where R's grammar lets the value run past the arrow. The body of a
 * `function`, `\(`, `if`, `for`, `while` and `repeat` extends as far as it can, so `function() 1 -> f` assigns
 * within the body instead of assigning the function.
 */
const OpenBody = /^(function\b|\\\(|if\b|for\b|while\b|repeat\b)/;
const rightAssign: MutationPass = {
	name:  'right assignment',
	apply: target => rewriteAssignments(target, (name, rhs) => rhs.includes('->') || OpenBody.test(rhs) ? undefined : `${rhs} -> ${name}`)
};

/** a grouping evaluates to what it wraps */
const groupedRhs: MutationPass = {
	name:  'grouped right hand side',
	apply: target => rewriteAssignments(target, (name, rhs) => `${name} <- (${rhs})`)
};

/** a block evaluates to its last expression */
const bracedRhs: MutationPass = {
	name:  'braced right hand side',
	apply: target => rewriteAssignments(target, (name, rhs) => `${name} <- { ${rhs} }`)
};

/** `assign("x", e)` binds what `x <- e` binds, the way an obfuscator hides a binding */
const assignCall: MutationPass = {
	name:  'assign call',
	apply: target => rewriteAssignments(target, (name, rhs) => `assign("${name}", ${rhs})`)
};

/** the same place may be reported by more than one search element, and rewriting it twice doubles it */
function distinctPlaces(places: readonly SourceRange[]): SourceRange[] {
	return [...new Map(places.map(p => [SourceRange.format(p), p])).values()];
}

/** rewrites the given places, back to front so that the earlier ones keep their columns */
function renameOccurrences(code: string, places: readonly SourceRange[], to: string): string {
	const lines = code.split('\n');
	for(const [line, column, , endColumn] of distinctPlaces(places).sort((a, b) => SourceRange.compare(b, a))) {
		lines[line - 1] = lines[line - 1].slice(0, column - 1) + to + lines[line - 1].slice(endColumn);
	}
	return lines.join('\n');
}

/** renames what the criterion points at, the way an obfuscator would */
const renameCriterion: MutationPass = {
	name:  'renamed criterion variable',
	apply: async(target, occurrencesOf) => {
		const at = SlicingCriterion.nameAt(target.criterion);
		if(at === undefined
			/* a criterion may name a call rather than a variable of the program (`3@print`) */
			|| !target.code.split('\n').some(l => SimpleAssignment.exec(l)?.[1] === at.name)
			/* a name a string spells out is read by `get` and its kin, which no rename of the symbols reaches */
			|| new RegExp(String.raw`(["'])[^"']*\b${at.name}\b[^"']*\1`).test(target.code)) {
			return undefined;
		}
		const places = await occurrencesOf(at.name);
		const renamed = `${MutationPrefix}v`;
		return places.length === 0 ? undefined
			: { ...target, code: renameOccurrences(target.code, places, renamed), criterion: `${at.line}@${renamed}` };
	}
};

/** these decide what to do with a literal before it is evaluated, so a `paste0` is another thing entirely */
const LiteralTakenAsWritten = /\b(library|require|quote|substitute|bquote|expression|deparse)\(\s*$/;

/** splits the first string literal, the way an obfuscator hides a name that is only known at run time */
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

/**
 * The one pass that changes the output. A slice keeps the value of the criterion, so adding one to the value it
 * is bound to adds one to what is printed. Only whole numbers are shifted, as R prints those without a format
 * change, and only where the criterion line prints the name and that name is bound once and read once.
 */
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
			code:      lines.map((l, i) => i === bindings[0].index ? `${at.name} <- (${bindings[0].rhs}) + 1` : l).join('\n'),
			criterion: target.criterion,
			expected:  `[1] ${Number(printed[1]) + 1}`
		};
	}
};

/** every pass a mutant is generated for; add to this list to check another rewrite */
export const MutationPasses: readonly MutationPass[] = [
	leadingNoise,
	trailingNoise,
	comments,
	blankLines,
	joinFirstTwo,
	rightAssign,
	groupedRhs,
	bracedRhs,
	assignCall,
	renameCriterion,
	splitString,
	shiftCriterionValue
];

/** one analysis per program and parser, as every pass and every query asks the same questions of it again */
const analyzers = new WeakMap<KnownParser, Map<string, Promise<FlowrAnalyzer>>>();
function analyzerFor(parser: KnownParser, code: string): Promise<FlowrAnalyzer> {
	const known = analyzers.get(parser) ?? new Map<string, Promise<FlowrAnalyzer>>();
	analyzers.set(parser, known);
	const analyzer = known.get(code) ?? new FlowrAnalyzerBuilder().setParser(parser).build().then(a => (a.addRequest(code), a));
	known.set(code, analyzer);
	return analyzer;
}

/** applies one pass, letting it locate what it rewrites with the flowR search */
export async function mutate(parser: KnownParser, target: MutationTarget, pass: MutationPass): Promise<MutationTarget | undefined> {
	return pass.apply(target, async name => {
		const analyzer = await analyzerFor(parser, target.code);
		/* the search reports every node of that lexeme, but only a symbol is a place where the name is written */
		return (await analyzer.runSearch(Q.var(name).build())).getElements()
			.flatMap(e => RSymbol.is(e.node) && e.node.location !== undefined ? [e.node.location] : []);
	});
}

/** what the queries say about a program, with every node id dropped, as a mutation moves those */
export type QueryObservation = Readonly<Record<string, readonly string[]>>;

function dependenciesOf(result: DependenciesQueryResult): string[] {
	return Object.entries(result).filter(([category]) => category !== '.meta')
		.flatMap(([category, found]) => (found as DependencyInfo[]).map(({ functionName, value, lexemeOfArgument }) => {
			/* an unnamed call is named by its id, which every mutation moves */
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
