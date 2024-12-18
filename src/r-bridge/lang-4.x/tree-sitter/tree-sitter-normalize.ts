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
import type { RComment } from '../ast/model/nodes/r-comment';
import type { RArgument } from '../ast/model/nodes/r-argument';
import { splitArrayOn } from '../../../util/arrays';
import { EmptyArgument } from '../ast/model/nodes/r-function-call';
import type { RSymbol } from '../ast/model/nodes/r-symbol';
import type { RString } from '../ast/model/nodes/r-string';
import { startAndEndsWith } from '../../../util/strings';
import type { RParameter } from '../ast/model/nodes/r-parameter';

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
		case TreeSitterType.Program: {
			const [comments, children] = splitComments(node.children);
			return {
				type:     RType.ExpressionList,
				children: children.map(convertTreeNode),
				grouping: undefined,
				lexeme:   undefined,
				info:     {
					fullRange:        undefined,
					additionalTokens: comments,
					fullLexeme:       undefined
				}
			};
		}
		case TreeSitterType.BracedExpression:
		case TreeSitterType.ParenthesizedExpression: {
			const [comments, children] = splitComments(node.children);
			const opening = children[0];
			const body = children.slice(1, -1);
			const closing = children[children.length - 1];
			return {
				type:     RType.ExpressionList,
				location: undefined,
				lexeme:   undefined,
				children: body.map(n => convertTreeNode(n)),
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
				info: { additionalTokens: comments, }
			};
		}
		case TreeSitterType.BinaryOperator: {
			const lhs = convertTreeNode(node.children[0]);
			const rhs = convertTreeNode(node.children[node.children.length - 1]);
			const [comments, [op]] = splitComments(node.children.slice(1, -1));
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
					info:         {}
				};
			} else if(op.text === '|>') {
				return {
					type:     RType.Pipe,
					location: opSource,
					lhs:      lhsAsArg,
					rhs,
					lexeme:   op.text,
					...defaultInfo
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
		case TreeSitterType.NamespaceOperator: {
			const [lhs, /* :: or ::: */, rhs] = node.children;
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
		case TreeSitterType.Identifier:
		case TreeSitterType.Return:
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
		case TreeSitterType.Call: {
			const [func, argsParentheses] = node.children;
			// tree-sitter wraps next and break in a function call, but we don't, so unwrap
			if(func.type === TreeSitterType.Next || func.type == TreeSitterType.Break) {
				return {
					...convertTreeNode(func),
					...defaultInfo
				};
			}
			const args = splitArrayOn(argsParentheses.children.slice(1, -1), x => x.type === 'comma');
			const funcRange = makeSourceRange(func);
			const call = {
				arguments: args.map(n => n.length == 0 ? EmptyArgument : convertTreeNode(n[0]) as RArgument),
				location:  funcRange,
				lexeme:    func.text,
				...defaultInfo
			};
			if(func.type === TreeSitterType.Identifier || func.type === TreeSitterType.String || func.type === TreeSitterType.NamespaceOperator) {
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
						...defaultInfo
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
			const [name, paramsParens, body] = node.children;
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
			const [func, content] = node.children;
			// bracket is now [ or [[ and argsClosing is x] or x]]
			const [bracket, ...argsClosing] = content.children;
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
			const [lhs, operator, rhs] = node.children;
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
			const name = node.children[0];
			const nameRange = makeSourceRange(name);
			let defaultValue: RNode | undefined = undefined;
			if(node.children.length == 3){
				defaultValue = convertTreeNode(node.children[2]);
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
					value:    convertTreeNode(valueNode),
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
			const range = makeSourceRange(node);
			comments.push({
				type:     RType.Comment,
				location: range,
				content:  node.text.slice(1),
				lexeme:   node.text,
				info:     {
					additionalTokens: [],
					fullLexeme:       node.text
				}
			});
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
