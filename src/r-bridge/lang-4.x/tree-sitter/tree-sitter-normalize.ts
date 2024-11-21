import type { RExpressionList } from '../ast/model/nodes/r-expression-list';
import type { SyntaxNode, Tree } from 'web-tree-sitter';
import type { RNode } from '../ast/model/model';
import { ParseError } from '../ast/parser/main/normalizer-data';
import { TreeSitterType } from './tree-sitter-types';
import { RType } from '../ast/model/type';
import type { SourceRange } from '../../../util/range';
import { removeRQuotes } from '../../retriever';
import { boolean2ts, number2ts } from '../convert-values';
import { ensureExpressionList } from '../ast/parser/main/normalize-meta';
import type { RComment } from '../ast/model/nodes/r-comment';
import type { RArgument } from '../ast/model/nodes/r-argument';
import { splitArrayOn } from '../../../util/arrays';
import { EmptyArgument } from '../ast/model/nodes/r-function-call';
import type { RSymbol } from '../ast/model/nodes/r-symbol';

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
	const defaultInfo = {
		info: {
			fullRange:        range,
			additionalTokens: [],
			fullLexeme:       node.text
		}
	};
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
		case TreeSitterType.BracedExpression:
		case TreeSitterType.ParenthesizedExpression: {
			const opening = node.children[0];
			const body = node.children.slice(1, node.children.length - 1);
			const closing = node.children[node.children.length - 1];
			return {
				type:     RType.ExpressionList,
				location: undefined,
				lexeme:   undefined,
				children: body.map(convertTreeNode),
				grouping: [
					convertTreeNode(opening) as RSymbol,
					convertTreeNode(closing) as RSymbol
				],
				...defaultInfo
			};
		}
		case TreeSitterType.BinaryOperator: {
			const lhs = convertTreeNode(node.children[0]);
			const rhs = convertTreeNode(node.children[node.children.length - 1]);
			const [comments, [op]] = splitComments(node.children.slice(1, node.children.length - 1));
			const opSource = makeSourceRange(op);
			if(op.type == 'special'){
				return {
					type:         RType.FunctionCall,
					location:     opSource,
					lexeme:       node.text,
					functionName: {
						type:      RType.Symbol,
						location:  opSource,
						lexeme:    op.text,
						content:   op.text,
						namespace: undefined,
						info:      {}
					},
					arguments: [
						{
							type:     RType.Argument,
							location: lhs.location as SourceRange,
							value:    lhs,
							name:     undefined,
							lexeme:   lhs.lexeme as string,
							info:     {}
						},
						{
							type:     RType.Argument,
							location: rhs.location as SourceRange,
							value:    rhs,
							name:     undefined,
							lexeme:   rhs.lexeme as string,
							info:     {}
						}
					],
					named:        true,
					infixSpecial: true,
					info:         {}
				};
			} else {
				return {
					type:     RType.BinaryOp,
					location: opSource,
					lhs, rhs,
					operator: op.text,
					lexeme:   op.text,
					info:     {
						fullRange:        range,
						additionalTokens: comments,
						fullLexeme:       node.text
					}
				};
			}
		}
		case TreeSitterType.UnaryOperator: {
			const [op, operand] = node.children;
			return {
				type:     RType.UnaryOp,
				operand:  convertTreeNode(operand),
				location: makeSourceRange(op),
				operator: op.text,
				lexeme:   op.text,
				...defaultInfo
			};
		}
		case '{' as TreeSitterType:
		case '}' as TreeSitterType:
		case '(' as TreeSitterType:
		case ')' as TreeSitterType:
		case TreeSitterType.Identifier:
			return {
				type:      RType.Symbol,
				location:  range,
				content:   removeRQuotes(node.text),
				lexeme:    node.text,
				namespace: undefined,
				...defaultInfo
			};
		case TreeSitterType.IfStatement: {
			const [ifNode, /* ( */, condition,/* ) */,then, /* else */, ...otherwise] = node.children;
			return {
				type:      RType.IfThenElse,
				condition: convertTreeNode(condition),
				then:      ensureExpressionList(convertTreeNode(then)),
				otherwise: otherwise.length > 0 ? ensureExpressionList(convertTreeNode(otherwise[0])) : undefined,
				location:  makeSourceRange(ifNode),
				lexeme:    ifNode.text,
				...defaultInfo
			};
		}
		case TreeSitterType.ForStatement: {
			const forNode = node.children[0]; // we follow with a (
			const variable = getNodesUntil(node.children, 'in', 2); // we follow with the "in"
			const sequence = getNodesUntil(node.children, ')', 2 + variable.length + 1); // we follow with a (
			const body = node.children[2 + variable.length + 1 + sequence.length + 1];
			const [variableComments, [variableNode]] = splitComments(variable);
			const [sequenceComments, [sequenceNode]] = splitComments(sequence);
			return {
				type:     RType.ForLoop,
				variable: convertTreeNode(variableNode) as RSymbol,
				vector:   convertTreeNode(sequenceNode),
				body:     ensureExpressionList(convertTreeNode(body)),
				location: makeSourceRange(forNode),
				lexeme:   forNode.text,
				info:     {
					fullRange:        range,
					additionalTokens: [...variableComments, ...sequenceComments],
					fullLexeme:       node.text
				}
			};
		}
		case TreeSitterType.WhileStatement: {
			const [whileNode, /* ( */, condition, /* ) */, body] = node.children;
			return {
				type:      RType.WhileLoop,
				condition: convertTreeNode(condition),
				body:      ensureExpressionList(convertTreeNode(body)),
				location:  makeSourceRange(whileNode),
				lexeme:    whileNode.text,
				...defaultInfo
			};
		}
		case TreeSitterType.RepeatStatement: {
			const [repeatNode, body] = node.children;
			return {
				type:     RType.RepeatLoop,
				body:     ensureExpressionList(convertTreeNode(body)),
				location: makeSourceRange(repeatNode),
				lexeme:   repeatNode.text,
				...defaultInfo
			};
		}
		case TreeSitterType.Float:
			return {
				type:     RType.Number,
				location: range,
				content:  number2ts(node.text),
				lexeme:   node.text,
				...defaultInfo
			};
		case TreeSitterType.True:
		case TreeSitterType.False:
			return {
				type:     RType.Logical,
				location: range,
				content:  boolean2ts(node.text),
				lexeme:   node.text,
				...defaultInfo
			};
		case TreeSitterType.Break:
		case TreeSitterType.Next:
			return {
				type:     node.type == TreeSitterType.Break ? RType.Break : RType.Next,
				location: range,
				lexeme:   node.text,
				...defaultInfo
			};
		case TreeSitterType.Subset:
		case TreeSitterType.Subset2: {
			// subset has children like a and [x]
			const [func, content] = node.children;
			// bracket is now [ or [[ and argsClosing is x] or x]]
			const [bracket, ...argsClosing] = content.children;
			const args = splitArrayOn(argsClosing.slice(0, argsClosing.length-1), x => x.type === 'comma');
			return {
				type:     RType.Access,
				operator: bracket.text as '[' | '[[',
				accessed: convertTreeNode(func),
				access:   args.map(n => n.length == 0 ? EmptyArgument : convertTreeNode(n[0]) as RArgument),
				location: makeSourceRange(bracket),
				lexeme:   bracket.text,
				...defaultInfo
			};
		}
		case TreeSitterType.ExtractOperator: {
			const [lhs, operator, rhs] = node.children;
			const rhsRange = makeSourceRange(rhs);
			return {
				type:     RType.Access,
				operator: operator.text as '$' | '@',
				accessed: convertTreeNode(lhs),
				access:   [{
					type:     RType.Argument,
					name:     undefined,
					value:    convertTreeNode(rhs),
					location: rhsRange,
					lexeme:   rhs.text,
					info:     {
						fullRange:        rhsRange,
						additionalTokens: [],
						fullLexeme:       rhs.text
					}
				}],
				location: makeSourceRange(operator),
				lexeme:   operator.text,
				...defaultInfo
			};
		}
		case TreeSitterType.Argument: {
			if(node.children.length == 1){
				const [arg] = node.children;
				return {
					type:     RType.Argument,
					name:     undefined,
					value:    convertTreeNode(arg),
					location: range,
					lexeme:   node.text,
					...defaultInfo
				};
			} else {
				const [nameNode, /* = */, valueNode] = node.children;
				return {
					type:     RType.Argument,
					name:     convertTreeNode(nameNode) as RSymbol,
					value:    convertTreeNode(valueNode),
					location: makeSourceRange(nameNode),
					lexeme:   nameNode.text,
					...defaultInfo
				};
			}

		}
		case TreeSitterType.Comment:
			return {
				type:     RType.Comment,
				location: range,
				content:  node.text.slice(1),
				lexeme:   node.text,
				...defaultInfo
			};
		default:
			throw new ParseError(`unexpected node type ${node.type}`);
	}
}

function makeSourceRange(node: SyntaxNode): SourceRange {
	return [
		// tree-sitter is 0-based but we want 1-based
		node.startPosition.row + 1, node.startPosition.column + 1,
		// tree-sitter's end position is one off from ours, so we don't add 1 here
		node.endPosition.row + 1, node.endPosition.column
	];
}

function splitComments(nodes: SyntaxNode[]): [RComment[], SyntaxNode[]] {
	const comments: RComment[] = [];
	const others: SyntaxNode[] = [];
	for(const node of nodes) {
		if(node.type === TreeSitterType.Comment) {
			comments.push(convertTreeNode(node) as RComment);
		} else {
			others.push(node);
		}
	}
	return [comments, others];
}

function getNodesUntil(nodes: SyntaxNode[], type: TreeSitterType | string, startIndex = 0): SyntaxNode[] {
	const ret = [];
	for(let i = startIndex; i < nodes.length; i++){
		if(nodes[i].type === type) {
			break;
		}
		ret.push(nodes[i]);
	}
	return ret;
}
