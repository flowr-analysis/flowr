import type { NormalizerData } from '../../normalizer-data';
import { normalizeSingleNode } from './normalize-single-node';
import { parseLog } from '../../../json/parser';
import { getWithTokenType } from '../../normalize-meta';
import { expensiveTrace, log } from '../../../../../../../util/log';
import { guard } from '../../../../../../../util/assert';
import { jsonReplacer } from '../../../../../../../util/json';
import type { RDelimiter } from '../../../../model/nodes/info/r-delimiter';
import type { RNode } from '../../../../model/model';
import { tryNormalizeUnary } from '../operators/normalize-unary';
import { tryNormalizeRepeat } from '../loops/normalize-repeat';
import { tryNormalizeBinary } from '../operators/normalize-binary';
import { tryNormalizeFor } from '../loops/normalize-for';
import { tryNormalizeSymbol } from '../values/normalize-symbol';
import { tryNormalizeIfThen } from '../control/normalize-if-then';
import { tryNormalizeWhile } from '../loops/normalize-while';
import { tryNormalizeIfThenElse } from '../control/normalize-if-then-else';
import { RawRType, RType } from '../../../../model/type';
import type { RComment } from '../../../../model/nodes/r-comment';
import { normalizeComment } from '../other/normalize-comment';
import type { RExpressionList } from '../../../../model/nodes/r-expression-list';
import type { JsonEntry, NamedJsonEntry } from '../../../json/format';

function normalizeMappedWithoutSemicolonBasedOnType(mappedWithName: readonly NamedJsonEntry[] | undefined, data: NormalizerData): (RNode | RDelimiter)[] {
	let result: RNode | RDelimiter | undefined = undefined;
	switch(mappedWithName?.length) {
		case 1:
			result = normalizeSingleNode(data, mappedWithName[0]);
			break;
		case 2:
			result = tryNormalizeUnary(data, mappedWithName as [NamedJsonEntry, NamedJsonEntry])
				?? tryNormalizeRepeat(data, mappedWithName as [NamedJsonEntry, NamedJsonEntry]);
			break;
		case 3:
			result = tryNormalizeBinary(data, mappedWithName as [NamedJsonEntry, NamedJsonEntry, NamedJsonEntry])
				?? tryNormalizeFor(data, mappedWithName as [NamedJsonEntry, NamedJsonEntry, NamedJsonEntry])
				?? tryNormalizeSymbol(data, mappedWithName);
			break;
		case 5:
			result = tryNormalizeIfThen(data, mappedWithName as [NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry])
				?? tryNormalizeWhile(data, mappedWithName as [NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry]);
			break;
		case 7:
			result = tryNormalizeIfThenElse(data, mappedWithName as [NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry, NamedJsonEntry]);
			break;
	}

	// otherwise perform default parsing
	return result !== undefined ? [result] : parseNodesWithUnknownType(data, mappedWithName);
}

interface HandledExpressionList {
	segments: readonly NamedJsonEntry[][]
	comments: readonly NamedJsonEntry[]
	braces:   undefined | [start: NamedJsonEntry, end: NamedJsonEntry]
}

/**
 * Split a token collection into comments tokens and "other" tokens
 */
export function splitComments(tokens: readonly NamedJsonEntry[]) {
	const comments = [];
	const others = [];
	for(const elem of tokens) {
		if(elem.name === RawRType.Comment) {
			comments.push(elem);
		} else {
			others.push(elem);
		}
	}
	return { comments, others };
}


function splitExprs(tokens: readonly NamedJsonEntry[]) {
	let last = 0, i = 0;
	let lastExpr = false;
	const segments: NamedJsonEntry[][] = [];
	for(const token of tokens) {
		if(token.name === RawRType.Semicolon) {
			segments.push(tokens.slice(last, i));
			lastExpr = false;
			last = i + 1;
		} else {
			const thisExpr = token.name === RawRType.Expression || token.name === RawRType.ExprOfAssignOrHelp || token.name === RawRType.LegacyEqualAssign;
			if(thisExpr && lastExpr) {
				if(i > last) {
					segments.push(tokens.slice(last, i));
				}
				segments.push([tokens[i]]);
				last = i + 1;
			}
			lastExpr = thisExpr;
		}
		i++;
	}
	if(last < tokens.length) {
		segments.push(tokens.slice(last, tokens.length));
	}
	return segments;
}

/**
 * Handles semicolons within _and_ braces at the start and end of the expression
 * @param raw - The tokens to split
 */
function handleExpressionList(raw: readonly NamedJsonEntry[]): HandledExpressionList {
	if(raw.length === 0) {
		return { segments: [], comments: [], braces: undefined };
	}
	const { comments, others: tokens } = splitComments(raw);
	const first = tokens[0]?.name;
	if(first === RawRType.BraceLeft) {
		const endType = tokens[tokens.length - 1].name;
		guard(endType === RawRType.BraceRight, () => `expected a brace at the end of the expression list as well, but ${endType} :: ${JSON.stringify(tokens[tokens.length - 1], jsonReplacer)}`);
		return {
			segments: [tokens.slice(1, tokens.length - 1)],
			comments,
			braces:   [tokens[0], tokens[tokens.length - 1]]
		};
	} else if(first === RawRType.ParenLeft) {
		const endType = tokens[tokens.length - 1].name;
		guard(endType === RawRType.ParenRight, () => `expected a parenthesis at the end of the expression list as well, but ${endType} :: ${JSON.stringify(tokens[tokens.length - 1], jsonReplacer)}`);
		return {
			segments: [tokens.slice(1, tokens.length - 1)],
			comments,
			braces:   [tokens[0], tokens[tokens.length - 1]]
		};
	} else {
		return { segments: splitExprs(tokens), comments, braces: undefined };
	}
}


function processBraces([start, end]: [start: NamedJsonEntry, end: NamedJsonEntry], processed: readonly RNode[], comments: RComment[], data: NormalizerData): RExpressionList {
	const [newStart, newEnd] = [tryNormalizeSymbol(data, [start]), tryNormalizeSymbol(data, [end])];
	guard(newStart !== undefined && newEnd !== undefined, () => `expected both start and end to be symbols, but ${JSON.stringify(start, jsonReplacer)} :: ${JSON.stringify(end, jsonReplacer)}`);
	return {
		type:     RType.ExpressionList,
		children: processed,
		grouping: [newStart, newEnd],
		lexeme:   undefined,
		location: undefined,
		info:     {
			additionalTokens: comments,
		}
	};
}

/**
 * Normalizes a list of expressions, handling semicolons and braces
 */
export function normalizeExpressions(
	data: NormalizerData,
	tokens: readonly JsonEntry[] | readonly NamedJsonEntry[]
): (RNode | RDelimiter)[] {
	if(tokens.length === 0) {
		parseLog.warn('no children received, skipping');
		return [];
	}

	let mappedWithName = tokens[0].name ? tokens as readonly NamedJsonEntry[] : getWithTokenType(tokens as JsonEntry[]);

	expensiveTrace(log, () => `[parseBasedOnType] names: [${mappedWithName.map(({ name }) => name).join(', ')}]`);

	let parsedComments: RComment[] = [];

	if(mappedWithName.length > 1) {
		// iterate over types, find all semicolons, and segment the tokens based on them.
		// we could potentially optimize as not all expr may have semicolons but not for now
		const { segments, braces, comments } = handleExpressionList(mappedWithName);
		parsedComments = comments.map(c => normalizeComment(data, c.content));

		if(segments.length > 1 || braces) {
			const processed = segments.flatMap(s => normalizeExpressions(data, s)) as RNode[];
			guard(!processed.some(x => (x as RNode | RDelimiter).type === RType.Delimiter), () => `expected no delimiter tokens in ${JSON.stringify(processed)}`);
			if(braces) {
				return [processBraces(braces, processed, parsedComments, data)];
			} else if(processed.length > 0) {
				if(parsedComments) {
					processed[0].info.additionalTokens ??= [];
					processed[0].info.additionalTokens.push(...parsedComments);
				}
				return processed;
			} else {
				return parsedComments;
			}
		}

		/*
		 * if splitOnSemicolon.length === 1, we can continue with the normal parsing, but we may have had a trailing semicolon, with this, it is removed as well.
		 * splitOnSemicolon.length === 0 is not possible, as we would have had an empty array before, split does not add elements.
		 */
		mappedWithName = segments[0];
	}


	return [...parsedComments, ...normalizeMappedWithoutSemicolonBasedOnType(mappedWithName, data)];
}

/**
 * Parses nodes when their type is unknown
 */
export function parseNodesWithUnknownType(data: NormalizerData, mappedWithName: readonly NamedJsonEntry[] | undefined): (RNode | RDelimiter)[] {
	const parsedNodes: (RNode | RDelimiter)[] = [];
	// used to indicate the new root node of this set of nodes
	for(const elem of mappedWithName ?? []) {
		const retrieved = normalizeSingleNode(data, elem);
		parsedNodes.push(retrieved);
	}
	return parsedNodes;
}
