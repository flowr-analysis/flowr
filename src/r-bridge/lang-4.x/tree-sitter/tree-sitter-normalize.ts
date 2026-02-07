import type { SyntaxNode, Tree } from 'web-tree-sitter';
import type { RNode } from '../ast/model/model';
import { ParseError } from '../ast/parser/main/normalizer-data';
import { TreeSitterType } from './tree-sitter-types';
import { RType } from '../ast/model/type';
import { SourceRange } from '../../../util/range';
import { removeRQuotes } from '../../retriever';
import { number2ts, RTrue, string2ts } from '../convert-values';
import { ensureExpressionList } from '../ast/parser/main/normalize-meta';
import type { RArgument } from '../ast/model/nodes/r-argument';
import { splitArrayOn } from '../../../util/collections/arrays';
import { EmptyArgument } from '../ast/model/nodes/r-function-call';
import type { RSymbol } from '../ast/model/nodes/r-symbol';
import type { RString } from '../ast/model/nodes/r-string';
import { startAndEndsWith } from '../../../util/text/strings';
import type { RParameter } from '../ast/model/nodes/r-parameter';
import { log } from '../../../util/log';
import type { RProject } from '../ast/model/nodes/r-project';
import type { ParseStepOutputSingleFile } from '../../parser';
import { parseLog } from '../ast/parser/json/parser';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { RExpressionList } from '../ast/model/nodes/r-expression-list';

export interface TreeSitterInfo {
	treeSitterId: number
}
type SyntaxAndRNode = [SyntaxNode, RNode<TreeSitterInfo>];

/**
 * @param tree - The tree to normalize
 * @param lax - Whether to use lax parsing (i.e., ignore errors) or strict parsing (i.e., fail on errors)
 */
export function normalizeTreeSitterTreeToAst(tree: ParseStepOutputSingleFile<Tree>[], lax?: boolean): RProject<TreeSitterInfo> {
	if(lax) {
		makeTreeSitterLax();
	} else {
		makeTreeSitterStrict();
	}
	const files: { filePath: string | undefined, root: RExpressionList<TreeSitterInfo> }[] = [];
	for(const t of tree) {
		const root = convertTreeNode(t.parsed.rootNode);
		if(root.type !== RType.ExpressionList) {
			throw new ParseError(`expected root to resolve to an expression list, got a ${root.type}`);
		}
		files.push({
			filePath: t.filePath,
			root:     root
		});
	}

	return {
		type: RType.Project,
		files
	};
}

function nonErrorChildrenStrict(node: SyntaxNode): SyntaxNode[] {
	return node.hasError ? [] : node.children;
}

function nonErrorChildrenLax(node: SyntaxNode): SyntaxNode[] {
	return node.hasError ? node.children.filter(n => n.type !== TreeSitterType.Error) : node.children;
}

let nonErrorChildren: (node: SyntaxNode) => SyntaxNode[] = nonErrorChildrenStrict;

/**
 * Globally switch to lax parsing mode for tree-sitter normalization
 * @see {@link makeTreeSitterStrict}
 */
export function makeTreeSitterLax() {
	log.info('[Tree-Sitter] Lax parsing active');
	nonErrorChildren = nonErrorChildrenLax;
}

/**
 * Globally switch to strict parsing mode for tree-sitter normalization
 * @see {@link makeTreeSitterLax}
 */
export function makeTreeSitterStrict() {
	log.info('[Tree-Sitter] Strict parsing active');
	nonErrorChildren = nonErrorChildrenStrict;
}

function convertTreeNode(node: SyntaxNode | undefined): RNode<TreeSitterInfo> {
	if(!node) {
		return {
			type:     RType.ExpressionList,
			location: undefined,
			lexeme:   undefined,
			children: [],
			grouping: undefined,
			info:     {
				fullRange:    undefined,
				adToks:       [],
				treeSitterId: -1,
			}
		} as RNode<TreeSitterInfo>;
	}
	try {
		// generally, the grammar source file dictates what children a node has in what order:
		// https://github.com/r-lib/tree-sitter-r/blob/main/grammar.js
		const range = makeSourceRange(node);
		const defaultInfo = {
			info: {
				fullRange:    range,
				adToks:       [],
				fullLexeme:   node.text,
				treeSitterId: node.id
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
						adToks:       remainingComments.map(c => c[1]),
						treeSitterId: node.id
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
							type:     RType.Symbol,
							location: makeSourceRange(opening),
							content:  removeRQuotes(opening.text),
							lexeme:   opening.text,
							...defaultInfo
						}, {
							type:     RType.Symbol,
							location: makeSourceRange(closing),
							content:  removeRQuotes(closing.text),
							lexeme:   closing.text,
							...defaultInfo
						}
					],
					info: {
						adToks:       remainingComments.map(c => c[1]),
						treeSitterId: node.id
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
				const lhsAsArg: RArgument<TreeSitterInfo> = {
					type:     RType.Argument,
					location: lhs.location as SourceRange,
					value:    lhs,
					name:     undefined,
					lexeme:   lhs.lexeme as string,
					info:     {
						treeSitterId: lhs.info.treeSitterId
					}
				};
				if(op.type === 'special') {
					return {
						type:         RType.FunctionCall,
						location:     opSource,
						lexeme:       node.text,
						functionName: {
							type:     RType.Symbol,
							location: opSource,
							lexeme:   op.text,
							content:  op.text,
							info:     {
								treeSitterId: op.id
							}
						},
						arguments: [lhsAsArg, {
							type:     RType.Argument,
							location: rhs.location as SourceRange,
							value:    rhs,
							name:     undefined,
							lexeme:   rhs.lexeme as string,
							info:     {
								treeSitterId: rhs.info.treeSitterId
							}
						}],
						named:        true,
						infixSpecial: true,
						info:         {
							adToks:       comments,
							treeSitterId: node.id
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
							fullRange:    range,
							adToks:       comments,
							fullLexeme:   node.text,
							treeSitterId: node.id
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
							fullRange:    range,
							adToks:       comments,
							fullLexeme:   node.text,
							treeSitterId: node.id
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
				const [lhs, int, rhs] = nonErrorChildren(node);
				return {
					type:     RType.Symbol,
					location: makeSourceRange(rhs),
					content:  Identifier.make(rhs.text, lhs.text, int.text === ':::' ),
					lexeme:   rhs.text,
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
					type:     RType.Symbol,
					location: range,
					content:  startAndEndsWith(node.text, '`') ? node.text.slice(1, -1) : removeRQuotes(node.text),
					lexeme:   node.text,
					...defaultInfo
				};
			case TreeSitterType.IfStatement: {
				const [ifNode, /* ( */, condition, /* ) */, then, /* else */, ...otherwise] = nonErrorChildren(node);
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
						type:     RType.Symbol,
						location: makeSourceRange(variableNode),
						content:  removeRQuotes(variableNode.text),
						lexeme:   variableNode.text,
						info:     {
							fullRange:    undefined,
							adToks:       [],
							fullLexeme:   undefined,
							treeSitterId: variableNode.id
						}
					},
					vector:   convertTreeNode(sequenceNode),
					body:     ensureExpressionList(convertTreeNode(body)),
					location: makeSourceRange(forNode),
					lexeme:   forNode.text,
					info:     {
						fullRange:    range,
						adToks:       variableComments.concat(sequenceComments).map(c => c[1]),
						fullLexeme:   node.text,
						treeSitterId: node.id
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
				if(func.type === TreeSitterType.Next || func.type === TreeSitterType.Break) {
					return {
						...convertTreeNode(func),
						...defaultInfo
					};
				}
				const rawArgs = nonErrorChildren(argsParentheses);
				const [comments, noCommentrawArgs] = splitComments(rawArgs);
				const args = splitArrayOn(noCommentrawArgs.slice(1, -1), x => x.type === 'comma');
				const funcRange = makeSourceRange(func);
				const mappedArgs = args.map(n => n.length === 0 ? EmptyArgument : convertTreeNode(n[0]) as RArgument<TreeSitterInfo>);
				const call = {
					arguments: mappedArgs,
					location:  funcRange,
					lexeme:    func.text,
					...defaultInfo,
					info:      {
						...defaultInfo.info,
						adToks: comments.map(c => c[1]),
					}
				};
				if(func.type === TreeSitterType.Identifier || func.type === TreeSitterType.String || func.type === TreeSitterType.NamespaceOperator || func.type === TreeSitterType.Return) {
					let funcNode = convertTreeNode(func) as RSymbol<TreeSitterInfo> | RString<TreeSitterInfo>;
					if(funcNode.type === RType.String) {
						funcNode = {
							...funcNode,
							type:    RType.Symbol,
							content: removeRQuotes(func.text)
						};
					}
					return {
						...call,
						type:         RType.FunctionCall,
						functionName: {
							...funcNode,
							info: {
								fullRange:    range,
								adToks:       [],
								fullLexeme:   node.text,
								treeSitterId: node.id
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
				const [comments, noCommentRawParams] = splitComments(paramsParens.children.slice(1, -1));

				const params = splitArrayOn(noCommentRawParams, x => x.type === 'comma');
				return {
					type:       RType.FunctionDefinition,
					parameters: params.map(n => convertTreeNode(n[0]) as RParameter<TreeSitterInfo>),
					body:       ensureExpressionList(convertTreeNode(body)),
					location:   makeSourceRange(name),
					lexeme:     name.text,
					info:       {
						...defaultInfo.info,
						adToks: comments.map(c => c[1]),
					}
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
					content:  node.text === RTrue,
					lexeme:   node.text,
					...defaultInfo
				};
			case TreeSitterType.Break:
				return {
					type:     RType.Break,
					location: range,
					lexeme:   node.text,
					...defaultInfo
				};
			case TreeSitterType.Next:
				return {
					type:     RType.Next,
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
					access:   args.map(n => n.length === 0 ? EmptyArgument : convertTreeNode(n[0]) as RArgument<TreeSitterInfo>),
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
						lexeme:   rhs?.text,
						info:     {
							fullRange:    rhsRange,
							adToks:       [],
							fullLexeme:   rhs?.text,
							treeSitterId: rhs?.id
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
				let defaultValue: RNode<TreeSitterInfo> | undefined = undefined;
				if(children.length === 3) {
					defaultValue = convertTreeNode(children[2]);
				}
				return {
					type: RType.Parameter,
					name: {
						type:     RType.Symbol,
						location: nameRange,
						content:  name.text,
						lexeme:   name.text,
						info:     {
							fullRange:    range,
							adToks:       [],
							fullLexeme:   name.text,
							treeSitterId: name.id
						}
					},
					special:  name.text === '...',
					defaultValue,
					location: nameRange,
					lexeme:   name.text,
					info:     {
						fullRange:    range,
						adToks:       [],
						fullLexeme:   name.text,
						treeSitterId: name.id
					}
				};
			}
			case TreeSitterType.Argument: {
				const children = nonErrorChildren(node);
				if(children.length === 1) {
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
					let name = convertTreeNode(nameNode) as RString<TreeSitterInfo> | RSymbol<TreeSitterInfo, string>;

					// unescape argument names
					if(name.type === RType.String) {
						name = {
							...name,
							type:    RType.Symbol,
							content: name.content.str
						};
					} else if(startAndEndsWith(name.content, '`')) {
						name.content = name.content.slice(1, -1);
					}
					const nameRange = makeSourceRange(nameNode);

					return {
						type:     RType.Argument,
						name,
						value:    valueNode ? convertTreeNode(valueNode) : undefined,
						location: nameRange,
						lexeme:   nameNode.text,
						info:     {
							fullRange:    nameRange,
							adToks:       [],
							fullLexeme:   nameNode.text,
							treeSitterId: nameNode.id
						}
					};
				}
			}
			case TreeSitterType.Comment:
				return {
					type:     RType.Comment,
					location: range,
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
					...defaultInfo
				};
		}
	} catch{
		parseLog.error(`[Tree-Sitter] Failed to convert node of type ${node.type} at ${JSON.stringify(makeSourceRange(node))}`);
	}
	return {
		type:     RType.ExpressionList,
		location: undefined,
		lexeme:   undefined,
		children: [],
		grouping: undefined,
		info:     {
			fullRange:    undefined,
			adToks:       [],
			treeSitterId: -1,
		}
	} as RNode<TreeSitterInfo>;
}

function makeSourceRange(node: SyntaxNode | undefined): SourceRange {
	if(!node) {
		return SourceRange.invalid();
	}
	const s = node.startPosition;
	const e = node.endPosition;
	return [
		// tree-sitter is 0-based but we want 1-based
		(s?.row ?? -2) + 1, (s?.column ?? -2) + 1,
		// tree-sitter's end position is one off from ours, so we don't add 1 here
		(e?.row ?? -2) + 1, e?.column ?? -1
	];
}

function splitComments(nodes: readonly SyntaxNode[]): [SyntaxAndRNode[], SyntaxNode[]] {
	const comments: SyntaxAndRNode[] = [];
	const others: SyntaxNode[] = [];
	for(const node of nodes) {
		if(node.type === TreeSitterType.Comment) {
			comments.push([node, {
				type:     RType.Comment,
				location: makeSourceRange(node),
				lexeme:   node.text,
				info:     {
					adToks:       [],
					fullLexeme:   node.text,
					treeSitterId: node.id
				}
			}]);
		} else {
			others.push(node);
		}
	}
	return [comments, others];
}

function findFirstNonCommentSibling(snode: SyntaxNode): SyntaxNode | null {
	const cursor = snode.parent?.walk();
	if(!cursor) {
		return null;
	}
	cursor.gotoFirstChild();
	while(cursor.nodeId !== snode.id && cursor.gotoNextSibling()) {
		/* skip */
	}
	cursor.gotoNextSibling();
	while(cursor.nodeType === TreeSitterType.Comment && cursor.gotoNextSibling()) {
		/* skip */
	}
	const cur = cursor.currentNode;
	cursor.delete();
	return cur;
}

function linkCommentsToNextNodes(nodes: SyntaxAndRNode[], comments: SyntaxAndRNode[]): SyntaxAndRNode[] {
	const remain: SyntaxAndRNode[] = [];
	for(const [commentSyntaxNode, commentNode] of comments) {
		let sibling: SyntaxNode | null;
		const prev = commentSyntaxNode.previousSibling;
		if(prev?.endIndex === commentSyntaxNode.startIndex) {
			// if there is a sibling on the same line, we link the comment to that node
			sibling = prev;
		} else {
			sibling = findFirstNonCommentSibling(commentSyntaxNode);
		}
		// if there is no valid sibling, we just link the comment to the first node (see normalize-expressions.ts)
		const [, node] = (sibling ? nodes.find(([s]) => s.id === sibling.id) : undefined) ?? nodes[0] ?? [];
		if(node) {
			node.info.adToks ??= [];
			node.info.adToks.push(commentNode);
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
