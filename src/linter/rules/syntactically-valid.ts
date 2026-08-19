import {
	LintingPrettyPrintContext,
	type LintingResult,
	LintingResultCertainty,
	type LintingRule,
	LintingRuleCertainty,
	type LintQuickFix
} from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation, type SourceRange } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import type { SyntaxNode, Tree } from 'web-tree-sitter';

/** The direction a fix takes to repair an error: add text, remove text, or comment the region out. */
export type FixDirection = 'add' | 'remove' | 'comment';

export interface SyntacticallyValidResult extends LintingResult {
	readonly message: string
	readonly kind:    'missing' | 'error'
}

export interface SyntacticallyValidConfig extends MergeableRecord {
	/** Names of {@link SyntaxErrorFixPatterns|auto-fix patterns} to disable (default none). */
	readonly disabledFixes: readonly string[]
	/** Preferred {@link FixDirection}; each error gets a single fix, favouring a candidate of this direction. */
	readonly preferFix:     FixDirection
}

export interface SyntacticallyValidMetadata extends MergeableRecord {
	readonly errors:  number
	readonly fixable: number
	readonly parser:  string
}

/** One pass over an error region, blind to strings and comments. */
export interface RegionScan {
	/** The closing delimiters the region leaves open, innermost first. */
	readonly closers:   readonly string[]
	/** Offset of every `%` outside a string or comment; an odd count means an unclosed `%...%` operator. */
	readonly percentAt: readonly number[]
}

/** A `missing` (parser-inserted, zero-width) or `error` (un-parseable) tree-sitter node. */
export interface SyntaxErrorFinding {
	readonly kind: 'missing' | 'error'
	readonly node: SyntaxNode
	/** The source line the node starts on, for patterns judging a pasted line rather than a token. */
	readonly line: string
	/** The region, scanned on first use. */
	readonly scan: RegionScan
}

/** An extensible auto-fix pattern; append to {@link SyntaxErrorFixPatterns} to teach the rule new repairs. */
export interface SyntaxErrorFixPattern {
	readonly name:        string
	readonly description: string
	readonly direction:   FixDirection
	readonly appliesTo:   (finding: SyntaxErrorFinding) => boolean
	readonly quickFix:    (finding: SyntaxErrorFinding, file: string | undefined) => LintQuickFix
}

const DelimiterInsert = new Map([[')', ')'], ['}', '}'], [']', ']'], [']]', ']]'], ['"', '"'], ['\'', '\''], ['`', '`'], [',', ','], [';', ';']]);
const KeywordInsert = new Map([['in', ' in '], ['else', ' else ']]);
const OperatorToken = /^([-+*/^:~!<>=&|@$]+|<-|<<-|->|->>|\|>|%[^%]*%)$/;
const KnownOperators = ['%%', '%/%', '%*%', '%o%', '%x%', '%in%', '%>%', '%<>%', '%+%', '%||%'];
/** Typographic quotes, as a word processor or a PDF leaves behind. */
const SmartQuote = new Map([['\u201C', '"'], ['\u201D', '"'], ['\u201E', '"'], ['\u2018', '\''], ['\u2019', '\'']]);
/** Closing brackets and whitespace only, so nothing there is worth keeping. */
const OnlyClosers = /^[)\]}\s]+$/;
/** How R prefixes printed values, never how a statement begins. */
const ConsoleOutput = /^\s*\[{1,2}\d+\]{1,2}(\s|$)/;

// tree-sitter is 0-based with an exclusive end column (matching flowR), so only the 1-based start shifts
const point = (p: { readonly row: number, readonly column: number }): SourceRange => [p.row + 1, p.column + 1, p.row + 1, p.column];
const span = (n: SyntaxNode): SourceRange => [n.startPosition.row + 1, n.startPosition.column + 1, n.endPosition.row + 1, n.endPosition.column];
const isDanglingOperator = (n: SyntaxNode | null): n is SyntaxNode => !!n && !n.isNamed && OperatorToken.test(n.type);

/** Read an error region: what it leaves open, and where its operators sit. */
function scanRegion(text: string): RegionScan {
	const stack: string[] = [];
	const percentAt: number[] = [];
	let quote: string | undefined;
	for(let i = 0; i < text.length; i++) {
		const c = text[i];
		if(quote) {
			if(c === '\\') {
				i++;
			} else if(c === quote) {
				quote = undefined;
			}
		} else if(c === '"' || c === '\'' || c === '`') {
			quote = c;
		} else if(c === '#') {
			while(i < text.length && text[i] !== '\n') {
				i++;
			}
		} else if(c === '%') {
			percentAt.push(i);
		} else if(c === '(') {
			stack.push(')');
		} else if(c === '[') {
			stack.push(text[i + 1] === '[' ? (i++, ']]') : ']');
		} else if(c === '{') {
			stack.push('}');
		} else if((c === ')' || c === '}') && stack[stack.length - 1] === c) {
			stack.pop();
		} else if(c === ']') {
			if(stack[stack.length - 1] === ']') {
				stack.pop();
			} else if(stack[stack.length - 1] === ']]') {
				stack[stack.length - 1] = ']';
			}
		}
	}
	return { closers: stack.reverse(), percentAt };
}

/** Fuzzy-complete the `%...` operator at `at` to the nearest known one (else just close it). */
function operatorCompletion(node: SyntaxNode, at: number): { range: SourceRange, full: string } {
	// R allows anything between the percents; matching letters alone read `%>` as `%` and completed it to `%%`
	const fragment = /^%[^%\s()[\]{},]*/.exec(node.text.slice(at))?.[0] ?? '%';
	const full = KnownOperators.find(op => op !== fragment && op.startsWith(fragment)) ?? fragment + '%';
	const column = node.startPosition.column + at;
	return { range: [node.startPosition.row + 1, column + 1, node.startPosition.row + 1, column + fragment.length], full };
}

const isMissingExpression = (f: SyntaxErrorFinding): boolean =>
	f.kind === 'missing' && !DelimiterInsert.has(f.node.type) && !KeywordInsert.has(f.node.type);

/** The built-in auto-fix patterns; append a {@link SyntaxErrorFixPattern} to add repairs. */
export const SyntaxErrorFixPatterns: SyntaxErrorFixPattern[] = [
	// first, because it judges the whole line: `[1] 1 2 3` errors on both `[` and `]`, and repairing those as
	// brackets balances output text into the program instead of dropping it
	{
		name:        'comment-out-console-output',
		description: 'Comment out a line of pasted R console output, which is missing its `#`.',
		direction:   'comment',
		appliesTo:   f => f.kind === 'error' && ConsoleOutput.test(f.line),
		quickFix:    (f, file) => ({
			type:        'replace',
			loc:         SourceLocation.from(point({ row: f.node.startPosition.row, column: 0 }), file),
			description: 'Comment out the pasted console output',
			replacement: '# '
		})
	},
	{
		name:        'insert-missing-token',
		description: 'Insert a delimiter, quote, or keyword the parser expected but did not find.',
		direction:   'add',
		appliesTo:   f => f.kind === 'missing' && (DelimiterInsert.has(f.node.type) || KeywordInsert.has(f.node.type)),
		quickFix:    (f, file) => ({
			type:        'replace',
			loc:         SourceLocation.from(point(f.node.startPosition), file),
			description: `Insert missing \`${f.node.type}\``,
			replacement: DelimiterInsert.get(f.node.type) ?? KeywordInsert.get(f.node.type) as string
		})
	},
	{
		name:        'remove-dangling-operator',
		description: 'Drop a dangling operator whose operand the parser found missing.',
		direction:   'remove',
		appliesTo:   f => isMissingExpression(f) && isDanglingOperator(f.node.previousSibling),
		quickFix:    (f, file) => ({ type: 'remove', loc: SourceLocation.from(span(f.node.previousSibling as SyntaxNode), file), description: `Remove the dangling \`${(f.node.previousSibling as SyntaxNode).type}\`` })
	},
	{
		name:        'insert-operand-placeholder',
		description: 'Insert a `NULL` placeholder for a missing operand or body.',
		direction:   'add',
		appliesTo:   isMissingExpression,
		quickFix:    (f, file) => ({ type: 'replace', loc: SourceLocation.from(point(f.node.startPosition), file), description: 'Insert placeholder `NULL`', replacement: ' NULL' })
	},
	{
		name:        'balance-brackets',
		description: 'Close an unbalanced region by appending the brackets that were left open.',
		direction:   'add',
		appliesTo:   f => f.kind === 'error' && f.scan.closers.length > 0,
		quickFix:    (f, file) => {
			const closers = f.scan.closers.join('');
			return { type: 'replace', loc: SourceLocation.from(point(f.node.endPosition), file), description: `Add missing closing \`${closers}\``, replacement: closers };
		}
	},
	{
		name:        'complete-operator',
		description: 'Complete an unfinished `%...%` operator to the nearest known one.',
		direction:   'add',
		// single-line only: the completion derives its column from the offset within the region
		appliesTo:   f => f.kind === 'error' && !f.node.text.includes('\n') && f.scan.percentAt.length % 2 === 1,
		quickFix:    (f, file) => {
			const { range, full } = operatorCompletion(f.node, f.scan.percentAt.at(-1) as number);
			return { type: 'replace', loc: SourceLocation.from(range, file), description: `Complete operator to \`${full}\``, replacement: full };
		}
	},
	{
		name:        'replace-smart-quote',
		description: 'Turn a typographic quote back into the straight quote R can read.',
		direction:   'add',
		appliesTo:   f => f.kind === 'error' && SmartQuote.has(f.node.text),
		quickFix:    (f, file) => ({
			type:        'replace',
			loc:         SourceLocation.from(span(f.node), file),
			description: 'Replace the typographic quote with a straight one',
			replacement: SmartQuote.get(f.node.text) as string
		})
	},
	{
		name:        'remove-repl-prompt',
		description: 'Drop a `>` prompt copied in front of a line taken from the R console.',
		direction:   'remove',
		// must open the line: `a > b` parses, and a leading `>=` is a different token
		appliesTo:   f => f.kind === 'error' && f.node.text === '>'
			&& f.line.slice(0, f.node.startPosition.column).trim() === '',
		quickFix: (f, file) => ({ type: 'remove', loc: SourceLocation.from(span(f.node), file), description: 'Remove the copied `>` prompt' })
	},
	{
		name:        'remove-stray-closer',
		description: 'Drop closing brackets that close nothing, as a partial copy leaves behind.',
		direction:   'remove',
		// the `]` of `[1]` is a closer too, but there the line goes, not the bracket
		appliesTo:   f => f.kind === 'error' && OnlyClosers.test(f.node.text) && !ConsoleOutput.test(f.line),
		quickFix:    (f, file) => ({ type: 'remove', loc: SourceLocation.from(span(f.node), file), description: `Remove the stray \`${f.node.text.replace(/\s+/g, '')}\`` })
	},
	{
		name:        'comment-out',
		description: 'Comment out an un-parseable region so the rest of the file still parses.',
		direction:   'comment',
		appliesTo:   f => f.kind === 'error' && !f.node.text.includes('\n'),
		quickFix:    (f, file) => ({ type: 'replace', loc: SourceLocation.from(span(f.node), file), description: 'Comment out the offending code', replacement: '# ' + f.node.text })
	}
];

/** Collect the outermost `missing`/`error` nodes, pruning subtrees the parser reports as clean. */
function finding(kind: 'missing' | 'error', node: SyntaxNode, lines: readonly string[]): SyntaxErrorFinding {
	let scan: RegionScan | undefined;
	return {
		kind, node,
		line: lines[node.startPosition.row] ?? '',
		// on demand and once: a `missing` node has no text, and two patterns want the same scan
		get scan() {
			return scan ??= scanRegion(node.text);
		}
	};
}

function collectFindings(node: SyntaxNode, lines: readonly string[], out: SyntaxErrorFinding[] = []): SyntaxErrorFinding[] {
	if(node.isMissing) {
		out.push(finding('missing', node, lines));
	} else if(node.isError) {
		out.push(finding('error', node, lines));
	} else if(node.hasError) {
		for(const child of node.children) {
			collectFindings(child, lines, out);
		}
	}
	return out;
}

function describe(finding: SyntaxErrorFinding): string {
	if(finding.kind === 'missing') {
		return `Missing \`${finding.node.type}\``;
	}
	const text = finding.node.text.replace(/\s+/g, ' ').trim();
	return `Unexpected \`${text.length > 30 ? text.slice(0, 27) + '...' : text}\``;
}

export const SYNTACTICALLY_VALID = {
	// reads the parse tree, not the normalized AST, so `Q.all()` would enumerate every node for nothing
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, data): Promise<{ results: SyntacticallyValidResult[], '.meta': SyntacticallyValidMetadata }> => {
		const parser = data.parserInformation().name;
		const results: SyntacticallyValidResult[] = [];
		// only tree-sitter recovers from syntax errors; a hard parser aborts before the linter ever runs
		if(parser === 'tree-sitter') {
			const patterns = SyntaxErrorFixPatterns.filter(p => !config.disabledFixes.includes(p.name));
			for(const file of (await data.parse()).files) {
				const root = (file.parsed as Tree).rootNode;
				if(!root.hasError) {
					continue;
				}
				// the root spans the file verbatim, so its rows index these lines
				const lines = root.text.split('\n');
				for(const finding of collectFindings(root, lines)) {
					// a single fix per error, favouring the preferred direction (alternatives are never emitted together)
					let fix: LintQuickFix | undefined;
					let best = 2;
					for(const p of patterns) {
						const rank = p.direction === config.preferFix ? 0 : 1;
						if(rank < best && p.appliesTo(finding)) {
							fix = p.quickFix(finding, file.filePath);
							best = rank;
							if(best === 0) {
								break;
							}
						}
					}
					results.push({
						certainty:  LintingResultCertainty.Certain,
						kind:       finding.kind,
						involvedId: undefined,
						loc:        SourceLocation.from(span(finding.node), file.filePath),
						message:    describe(finding),
						quickFix:   fix ? [fix] : undefined
					});
				}
			}
		}
		return { results, '.meta': { parser, errors: results.length, fixable: results.filter(r => r.quickFix !== undefined).length } };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: SyntacticallyValidResult) => `${result.message} at ${SourceLocation.format(result.loc)}`,
		[LintingPrettyPrintContext.Full]:  (result: SyntacticallyValidResult) => `Syntax error (${result.kind}): ${result.message} at ${SourceLocation.format(result.loc)}`
	},
	info: {
		name:            'Syntactically Valid',
		description:     'Checks whether the code is free of syntax errors, using the configured (error-tolerant) parser, and offers extensible quick-fixes to repair them.',
		tags:            [LintingRuleTag.Bug, LintingRuleTag.Robustness, LintingRuleTag.QuickFix],
		// tree-sitter reports real syntax errors precisely, but a strict parse may collapse a region into fewer findings
		certainty:       LintingRuleCertainty.BestEffort,
		// only meaningful under tree-sitter, so opt-in rather than part of the default set
		activeByDefault: false,
		defaultConfig:   {
			disabledFixes: [],
			preferFix:     'remove'
		}
	}
} as const satisfies LintingRule<SyntacticallyValidResult, SyntacticallyValidMetadata, SyntacticallyValidConfig>;
