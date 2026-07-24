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

/** A `missing` (parser-inserted, zero-width) or `error` (un-parseable) tree-sitter node. */
export interface SyntaxErrorFinding {
	readonly kind: 'missing' | 'error'
	readonly node: SyntaxNode
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

// tree-sitter is 0-based with an exclusive end column (matching flowR), so only the 1-based start shifts
const point = (p: { readonly row: number, readonly column: number }): SourceRange => [p.row + 1, p.column + 1, p.row + 1, p.column];
const span = (n: SyntaxNode): SourceRange => [n.startPosition.row + 1, n.startPosition.column + 1, n.endPosition.row + 1, n.endPosition.column];
const isDanglingOperator = (n: SyntaxNode | null): n is SyntaxNode => !!n && !n.isNamed && OperatorToken.test(n.type);

/** The closing delimiters an unbalanced error region is missing, innermost first (skips strings/comments; `({` needs `})`). */
function bracketDeficit(text: string): string[] {
	const stack: string[] = [];
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
	return stack.reverse();
}

/** Fuzzy-complete the unfinished `%...` operator in an error region to the nearest known operator (else just close it). */
function operatorCompletion(node: SyntaxNode): { range: SourceRange, full: string } {
	const at = node.text.lastIndexOf('%');
	const fragment = /^%[A-Za-z0-9]*/.exec(node.text.slice(at))?.[0] ?? '%';
	const full = KnownOperators.find(op => op !== fragment && op.startsWith(fragment)) ?? fragment + '%';
	const column = node.startPosition.column + at;
	return { range: [node.startPosition.row + 1, column + 1, node.startPosition.row + 1, column + fragment.length], full };
}

const isMissingExpression = (f: SyntaxErrorFinding): boolean =>
	f.kind === 'missing' && !DelimiterInsert.has(f.node.type) && !KeywordInsert.has(f.node.type);

/** The built-in auto-fix patterns; append a {@link SyntaxErrorFixPattern} to add repairs. */
export const SyntaxErrorFixPatterns: SyntaxErrorFixPattern[] = [
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
		appliesTo:   f => f.kind === 'error' && bracketDeficit(f.node.text).length > 0,
		quickFix:    (f, file) => {
			const closers = bracketDeficit(f.node.text).join('');
			return { type: 'replace', loc: SourceLocation.from(point(f.node.endPosition), file), description: `Add missing closing \`${closers}\``, replacement: closers };
		}
	},
	{
		name:        'complete-operator',
		description: 'Complete an unfinished `%...%` operator to the nearest known one.',
		direction:   'add',
		appliesTo:   f => f.kind === 'error' && !f.node.text.includes('\n') && (f.node.text.match(/%/g)?.length ?? 0) % 2 === 1,
		quickFix:    (f, file) => {
			const { range, full } = operatorCompletion(f.node);
			return { type: 'replace', loc: SourceLocation.from(range, file), description: `Complete operator to \`${full}\``, replacement: full };
		}
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
function collectFindings(node: SyntaxNode, out: SyntaxErrorFinding[] = []): SyntaxErrorFinding[] {
	if(node.isMissing) {
		out.push({ kind: 'missing', node });
	} else if(node.isError) {
		out.push({ kind: 'error', node });
	} else if(node.hasError) {
		for(const child of node.children) {
			collectFindings(child, out);
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
	createSearch:        () => Q.all(),
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
				for(const finding of collectFindings(root)) {
					// a single fix per error, favouring the preferred direction (alternatives are never emitted together)
					let fix: LintQuickFix | undefined;
					let best = 2;
					for(const p of patterns) {
						const rank = p.direction === config.preferFix ? 0 : 1;
						if(rank < best && p.appliesTo(finding)) {
							fix = p.quickFix(finding, file.filePath);
							best = rank;
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
