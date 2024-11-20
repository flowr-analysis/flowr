import type { RExpressionList } from '../ast/model/nodes/r-expression-list';
import type { SyntaxNode, Tree } from 'web-tree-sitter';
import type { RNode } from '../ast/model/model';
import { ParseError } from '../ast/parser/main/normalizer-data';
import { TreeSitterType } from './tree-sitter-types';
import { RType } from '../ast/model/type';
import type { SourceRange } from '../../../util/range';
import { removeRQuotes } from '../../retriever';
import type { RSymbol } from '../ast/model/nodes/r-symbol';
import { number2ts } from '../convert-values';

export function normalizeTreeSitterTreeToAst(tree: Tree): RExpressionList {
	const originalRoot = tree.rootNode;
	if(originalRoot.type !== TreeSitterType.Program || originalRoot.childCount !== 1) {
		throw new ParseError(`expected root to be ${TreeSitterType.Program} with one child, yet received ${originalRoot.type}`);
	}
	return convertTreeNode(originalRoot) as RExpressionList;
}

function convertTreeNode(node: SyntaxNode): RNode {
	const range = makeSourceRange(node);
	switch(node.type as TreeSitterType) {
		case TreeSitterType.Program:
			if(node.childCount !== 1) {
				throw new ParseError(`expected ${TreeSitterType.Program} to have one child, yet received ${node.childCount}`);
			}
			return {
				type:     RType.ExpressionList,
				children: [convertTreeNode(node.firstChild as SyntaxNode)],
				grouping: undefined,
				lexeme:   undefined,
				info:     {
					fullRange:        undefined,
					// TODO parse delimiters here? (see normalize-root)
					additionalTokens: [],
					fullLexeme:       undefined
				}
			};
		case TreeSitterType.BinaryOp: {
			const [lhs, op, rhs] = node.children;
			return {
				type:     RType.BinaryOp,
				location: range,
				lhs:      convertTreeNode(lhs),
				rhs:      convertTreeNode(rhs),
				operator: op.text,
				lexeme:   op.text,
				info:     {
					fullRange:        range,
					additionalTokens: [],
					fullLexeme:       node.text
				}
			};
		}
		case TreeSitterType.Identifier:
			return {
				type:      RType.Symbol,
				content:   removeRQuotes(node.text),
				lexeme:    node.text,
				location:  range,
				namespace: undefined,
			} as RSymbol;
		case TreeSitterType.Float:
			return {
				type:     RType.Number,
				content:  number2ts(node.text),
				location: range,
				lexeme:   node.text,
				info:     {
					fullRange:        range,
					additionalTokens: [],
					fullLexeme:       node.text
				}
			};
		default:
			throw new ParseError(`unexpected node type ${node.type}`);
	}
}

function makeSourceRange(node: SyntaxNode): SourceRange {
	return [
		// tree-sitter is 0-based but we want 1-based
		node.startPosition.row + 1, node.startPosition.column + 1,
		node.endPosition.row + 1, node.endPosition.column + 1
	];
}
