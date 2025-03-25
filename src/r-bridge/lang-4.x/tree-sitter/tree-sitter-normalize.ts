import type { RExpressionList } from '../ast/model/nodes/r-expression-list';
import type { SyntaxNode, Tree } from 'web-tree-sitter';
import type { RNode } from '../ast/model/model';
import { ParseError } from '../ast/parser/main/normalizer-data';
import { TreeSitterType } from './tree-sitter-types';
import { RType } from '../ast/model/type';
import type { SourceRange } from '../../../util/range';
import { removeRQuotes } from '../../retriever';
import { boolean2ts, number2ts, string2ts } from '../convert-values';
import { ensureExpressionList } from '../ast/parser/main/normalize-meta';
import type { RArgument } from '../ast/model/nodes/r-argument';
import { splitArrayOn } from '../../../util/arrays';
import { EmptyArgument } from '../ast/model/nodes/r-function-call';
import type { RSymbol } from '../ast/model/nodes/r-symbol';
import type { RString } from '../ast/model/nodes/r-string';
import { startAndEndsWith } from '../../../util/strings';
import type { RParameter } from '../ast/model/nodes/r-parameter';
import { getEngineConfig } from '../../../config';
import { log } from '../../../util/log';

type SyntaxAndRNode = [SyntaxNode, RNode];

/**
 * @param tree - The tree to normalize
 */
export function normalizeTreeSitterTreeToAst(tree: Tree): RExpressionList {
	const lax = getEngineConfig('tree-sitter')?.lax;
	if(lax) {
		makeTreeSitterLax();
	} else {
		makeTreeSitterStrict();
	}
	const root = convertTreeNode(tree.rootNode);
	if(root.type !== RType.ExpressionList) {
		throw new ParseError(`expected root to resolve to an expression list, got a ${root.type}`);
	}
	return root;
}

function nonErrorChildrenStrict(node: SyntaxNode): SyntaxNode[] {
	return node.hasError ? [] : node.children;
}

function nonErrorChildrenLax(node: SyntaxNode): SyntaxNode[] {
	return node.hasError ? node.children.filter(n => n.type !== TreeSitterType.Error) : node.children;
}

let nonErrorChildren: (node: SyntaxNode) => SyntaxNode[] = nonErrorChildrenStrict;

export function makeTreeSitterLax() {
	log.info('[Tree-Sitter] Lax parsing active');
	nonErrorChildren = nonErrorChildrenLax;
}

export function makeTreeSitterStrict() {
	log.info('[Tree-Sitter] Strict parsing active');
	nonErrorChildren = nonErrorChildrenStrict;
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
		case TreeSitterType.Program: {
			const [comments, children] = splitComments(nonErrorChildren(node));
			const body = children.map(n => [n, convertTreeNode(n)] as SyntaxAndRNode);
			const remainingComments = linkCommentsToNextNodes(body, comments);
			return {
				type:     RType.ExpressionList,
				children: body.map(n => n[1]),
				grouping: undefined,
				lexeme:   undefined,
				info:     {
					additionalTokens: remainingComments.map(c => c[1])
				}
			};
		}
		case TreeSitterType.BracedExpression:
		case TreeSitterType.ParenthesizedExpression: {
			const [comments, children] = splitComments(nonErrorChildren(node));
			const opening = children[0];
			const body = children.slice(1, -1).map(n => [n, convertTreeNode(n)] as SyntaxAndRNode);
			const remainingComments = linkCommentsToNextNodes(body, comments);
			const closing = children[children.length - 1];
			return {
				type:     RType.ExpressionList,
				location: undefined,
				lexeme:   undefined,
				children: body.map(n => n[1]),
				grouping: [
					{
						type:      RType.Symbol,
						location:  makeSourceRange(opening),
						content:   removeRQuotes(opening.text),
						lexeme:    opening.text,
						namespace: undefined,
						...defaultInfo
					}, {
						type:      RType.Symbol,
						location:  makeSourceRange(closing),
						content:   removeRQuotes(closing.text),
						lexeme:    closing.text,
						namespace: undefined,
						...defaultInfo
					}
				],
				info: {
					additionalTokens: remainingComments.map(c => c[1])
				}
			};
		}
		case TreeSitterType.BinaryOperator: {
			const children = nonErrorChildren(node);
			const lhs = convertTreeNode(children[0]);
			const rhs = convertTreeNode(children[children.length - 1]);
			const [commentsBoth, [op]] = splitComments(children.slice(1, -1));
			const comments = commentsBoth.map(c => c[1]);
			const opSource = makeSourceRange(op);
			const lhsAsArg: RArgument = {
				type:     RType.Argument,
				location: lhs.location as SourceRange,
				value:    lhs,
				name:     undefined,
				lexeme:   lhs.lexeme as string,
				info:     {}
			};
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
					arguments: [lhsAsArg, {
						type:     RType.Argument,
						location: rhs.location as SourceRange,
						value:    rhs,
						name:     undefined,
						lexeme:   rhs.lexeme as string,
						info:     {}
					}],
					named:        true,
					infixSpecial: true,
					info:         {
						additionalTokens: comments
					}
				};
			} else if(op.text === '|>') {
				return {
					type:     RType.Pipe,
					location: opSource,
					lhs:      lhsAsArg,
					rhs,
					lexeme:   op.text,
					...defaultInfo,
					info:     {
						fullRange:        range,
						additionalTokens: comments,
						fullLexeme:       node.text
					}
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
			const [op, operand] = nonErrorChildren(node);
			return {
				type:     RType.UnaryOp,
				operand:  convertTreeNode(operand),
				location: makeSourceRange(op),
				operator: op.text,
				lexeme:   op.text,
				...defaultInfo
			};
		}
		case TreeSitterType.NamespaceOperator: {
			const [lhs, /* :: or ::: */, rhs] = nonErrorChildren(node);
			return {
				type:      RType.Symbol,
				location:  makeSourceRange(rhs),
				content:   rhs.text,
				lexeme:    rhs.text,
				namespace: lhs.text,
				...defaultInfo
			};
		}
		case '(' as TreeSitterType:
		case ')' as TreeSitterType:
		case TreeSitterType.Na:
		case TreeSitterType.Null:
		case TreeSitterType.Dots:
		case TreeSitterType.DotDotI:
		case TreeSitterType.Identifier:
		case TreeSitterType.Return:
			return {
				type:      RType.Symbol,
				location:  range,
				content:   startAndEndsWith(node.text, '`') ? node.text.slice(1, -1) : removeRQuotes(node.text),
				lexeme:    node.text,
				namespace: undefined,
				...defaultInfo
			};
		case TreeSitterType.IfStatement: {
			const [ifNode, /* ( */, condition,/* ) */,then, /* else */, ...otherwise] = nonErrorChildren(node);
			const filteredOtherwise = otherwise.filter(n => n.type !== TreeSitterType.ElseStatement);
			return {
				type:      RType.IfThenElse,
				condition: convertTreeNode(condition),
				then:      ensureExpressionList(convertTreeNode(then)),
				otherwise: filteredOtherwise.length > 0 ? ensureExpressionList(convertTreeNode(filteredOtherwise[0])) : undefined,
				location:  makeSourceRange(ifNode),
				lexeme:    ifNode.text,
				...defaultInfo
			};
		}
		case TreeSitterType.ForStatement: {
			const children = nonErrorChildren(node);
			const forNode = children[0]; // we follow with a (
			const variable = getNodesUntil(children, 'in', 2); // we follow with the "in"
			const sequence = getNodesUntil(children, ')', 2 + variable.length + 1); // we follow with a (
			const body = children[2 + variable.length + 1 + sequence.length + 1];
			const [variableComments, [variableNode]] = splitComments(variable);
			const [sequenceComments, [sequenceNode]] = splitComments(sequence);
			return {
				type:     RType.ForLoop,
				variable: {
					type:      RType.Symbol,
					location:  makeSourceRange(variableNode),
					content:   removeRQuotes(variableNode.text),
					lexeme:    variableNode.text,
					namespace: undefined,
					info:      {
						fullRange:        undefined,
						additionalTokens: [],
						fullLexeme:       undefined
					}
				},
				vector:   convertTreeNode(sequenceNode),
				body:     ensureExpressionList(convertTreeNode(body)),
				location: makeSourceRange(forNode),
				lexeme:   forNode.text,
				info:     {
					fullRange:        range,
					additionalTokens: [...variableComments, ...sequenceComments].map(c => c[1]),
					fullLexeme:       node.text
				}
			};
		}
		case TreeSitterType.WhileStatement: {
			const [whileNode, /* ( */, condition, /* ) */, body] = nonErrorChildren(node);
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
			const [repeatNode, body] = nonErrorChildren(node);
			return {
				type:     RType.RepeatLoop,
				body:     ensureExpressionList(convertTreeNode(body)),
				location: makeSourceRange(repeatNode),
				lexeme:   repeatNode.text,
				...defaultInfo
			};
		}
		case TreeSitterType.Call: {
			const [func, argsParentheses] = nonErrorChildren(node);
			// tree-sitter wraps next and break in a function call, but we don't, so unwrap
			if(func.type === TreeSitterType.Next || func.type == TreeSitterType.Break) {
				return {
					...convertTreeNode(func),
					...defaultInfo
				};
			}
			const args = splitArrayOn(nonErrorChildren(argsParentheses).slice(1, -1), x => x.type === 'comma');
			const funcRange = makeSourceRange(func);
			const call = {
				arguments: args.map(n => n.length == 0 ? EmptyArgument : convertTreeNode(n[0]) as RArgument),
				location:  funcRange,
				lexeme:    func.text,
				...defaultInfo
			};
			if(func.type === TreeSitterType.Identifier || func.type === TreeSitterType.String || func.type === TreeSitterType.NamespaceOperator || func.type === TreeSitterType.Return) {
				let funcNode = convertTreeNode(func) as RSymbol | RString;
				if(funcNode.type === RType.String) {
					funcNode = {
						...funcNode,
						type:      RType.Symbol,
						namespace: undefined,
						content:   removeRQuotes(func.text)
					};
				}
				return {
					...call,
					type:         RType.FunctionCall,
					functionName: {
						...funcNode,
						info: {
							fullRange:        range,
							additionalTokens: [],
							fullLexeme:       node.text
						}
					},
					named: true
				};
			} else {
				return {
					...call,
					type:           RType.FunctionCall,
					calledFunction: convertTreeNode(func),
					named:          undefined
				};
			}
		}
		case TreeSitterType.FunctionDefinition: {
			const [name, paramsParens, body] = nonErrorChildren(node);
			const params = splitArrayOn(paramsParens.children.slice(1, -1), x => x.type === 'comma');
			return {
				type:       RType.FunctionDefinition,
				parameters: params.map(n => convertTreeNode(n[0]) as RParameter),
				body:       ensureExpressionList(convertTreeNode(body)),
				location:   makeSourceRange(name),
				lexeme:     name.text,
				...defaultInfo
			};
		}
		case TreeSitterType.String:
			return {
				type:     RType.String,
				location: range,
				content:  string2ts(node.text),
				lexeme:   node.text,
				...defaultInfo
			};
		case TreeSitterType.Float:
		case TreeSitterType.Integer:
		case TreeSitterType.Complex:
		case TreeSitterType.Inf:
		case TreeSitterType.Nan:
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
			const [func, content] = nonErrorChildren(node);
			// bracket is now [ or [[ and argsClosing is x] or x]]
			const [bracket, ...argsClosing] = nonErrorChildren(content);
			const args = splitArrayOn(argsClosing.slice(0, -1), x => x.type === 'comma');
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
			const [lhs, operator, rhs] = nonErrorChildren(node);
			const rhsRange = makeSourceRange(rhs);
			return {
				type:     RType.Access,
				operator: operator.text as '$' | '@',
				accessed: convertTreeNode(lhs),
				access:   [{
					type:  RType.Argument,
					name:  undefined,
					value: {
						...convertTreeNode(rhs),
						...defaultInfo
					},
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
		case TreeSitterType.Parameter: {
			const children = nonErrorChildren(node);
			const name = children[0];
			const nameRange = makeSourceRange(name);
			let defaultValue: RNode | undefined = undefined;
			if(children.length == 3){
				defaultValue = convertTreeNode(children[2]);
			}
			return {
				type: RType.Parameter,
				name: {
					type:      RType.Symbol,
					location:  nameRange,
					namespace: undefined,
					content:   name.text,
					lexeme:    name.text,
					info:      {
						fullRange:        range,
						additionalTokens: [],
						fullLexeme:       name.text
					}
				},
				special:  name.text === '...',
				defaultValue,
				location: nameRange,
				lexeme:   name.text,
				info:     {
					fullRange:        range,
					additionalTokens: [],
					fullLexeme:       name.text
				}
			};
		}
		case TreeSitterType.Argument: {
			const children = nonErrorChildren(node);
			if(children.length == 1){
				const [arg] = children;
				return {
					type:     RType.Argument,
					name:     undefined,
					value:    convertTreeNode(arg),
					location: range,
					lexeme:   node.text,
					...defaultInfo
				};
			} else {
				const [nameNode, /* = */, valueNode] = children;
				let name = convertTreeNode(nameNode) as RString | RSymbol;
				// unescape argument names
				if(name.type === RType.String){
					name = {
						...name,
						type:      RType.Symbol,
						content:   name.content.str,
						namespace: undefined
					};
				} else if(startAndEndsWith(name.content, '`')){
					name.content = name.content.slice(1, -1);
				}
				const nameRange = makeSourceRange(nameNode);
				return {
					type:     RType.Argument,
					name:     name,
					value:    valueNode ? convertTreeNode(valueNode) : undefined,
					location: nameRange,
					lexeme:   nameNode.text,
					info:     {
						fullRange:        nameRange,
						additionalTokens: [],
						fullLexeme:       nameNode.text
					}
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
		case TreeSitterType.Error:
			return {
				type:     RType.ExpressionList,
				location: undefined,
				lexeme:   undefined,
				children: [],
				grouping: undefined,
				info:     defaultInfo
			};
		default:
			throw new ParseError(`unexpected node type ${node.type} at ${JSON.stringify(range)}`);
	}
}

function makeSourceRange(node: SyntaxNode): SourceRange {
	if(node.startPosition && node.endPosition) {
		return [
			// tree-sitter is 0-based but we want 1-based
			node.startPosition.row + 1, node.startPosition.column + 1,
			// tree-sitter's end position is one off from ours, so we don't add 1 here
			node.endPosition.row + 1, node.endPosition.column
		];
	} else {
		return [
			(node.startPosition?.row ?? -2) + 1, (node.startPosition?.column ?? -2) + 1,
			// tree-sitter's end position is one off from ours, so we don't add 1 here
			(node.endPosition?.row ?? -2) + 1, node.endPosition?.column ?? -1
		];
	}
}

function splitComments(nodes: SyntaxNode[]): [SyntaxAndRNode[], SyntaxNode[]] {
	const comments: SyntaxAndRNode[] = [];
	const others: SyntaxNode[] = [];
	for(const node of nodes) {
		if(node.type === TreeSitterType.Comment) {
			comments.push([node, {
				type:     RType.Comment,
				location: makeSourceRange(node),
				content:  node.text.slice(1),
				lexeme:   node.text,
				info:     {
					additionalTokens: [],
					fullLexeme:       node.text
				}
			}]);
		} else {
			others.push(node);
		}
	}
	return [comments, others];
}

function linkCommentsToNextNodes(nodes: SyntaxAndRNode[], comments: SyntaxAndRNode[]): SyntaxAndRNode[] {
	const remain: SyntaxAndRNode[] = [];
	for(const [commentSyntaxNode, commentNode] of comments) {
		let sibling: SyntaxNode | null;
		if(commentSyntaxNode.previousSibling?.endIndex === commentSyntaxNode.startIndex) {
			// if there is a sibling on the same line, we link the comment to that node
			sibling = commentSyntaxNode.previousSibling;
		} else {
			sibling = commentSyntaxNode.nextSibling;
			while(sibling && sibling.type === TreeSitterType.Comment) {
				sibling = sibling.nextSibling;
			}
		}
		// if there is no valid sibling, we just link the comment to the first node (see normalize-expressions.ts)
		const [, node] = (sibling ? nodes.find(([s]) => s.equals(sibling)) : undefined) ?? nodes[0] ?? [];
		if(node) {
			node.info.additionalTokens ??= [];
			node.info.additionalTokens.push(commentNode);
		} else {
			remain.push([commentSyntaxNode, commentNode]);
		}
	}
	return remain;
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
