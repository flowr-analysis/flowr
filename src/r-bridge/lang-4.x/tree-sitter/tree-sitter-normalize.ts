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
	const root = convertTreeNode(tree.rootNode);
	if(root.type !== RType.ExpressionList) {
		throw new ParseError(`expected root to resolve to an expression list, got a ${root.type}`);
	}
	return root;
}

function convertTreeNode(node: SyntaxNode): RNode {
	// generally, the grammar source file dictates what children a node has in what order:
	// https://github.com/r-lib/tree-sitter-r/blob/main/grammar.js
	const range = makeSourceRange(node);
	switch(node.type as TreeSitterType) {
		case TreeSitterType.Program:
			return {
				type:     RType.ExpressionList,
				children: node.children.map(convertTreeNode),
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
		case TreeSitterType.IfStatement: {
			// "if", (, condition, ), if true, "else", if false (optional),
			const [,, condition,,truePath, ...falsePath] = node.children;
			return {
				type: RType.IfThenElse,

			};
		}
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
