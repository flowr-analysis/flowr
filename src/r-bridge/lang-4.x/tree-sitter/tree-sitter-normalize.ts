import type { SyntaxNode, Tree } from 'web-tree-sitter';
import type { RNode } from '../ast/model/model';
import { ParseError } from '../ast/parser/main/normalizer-data';
import { TreeSitterType } from './tree-sitter-types';
import { RType } from '../ast/model/type';
import { SourceRange } from '../../../util/range';
import { RNumberValue, RStringValue, RTrue } from '../convert-values';
import { ensureExpressionList } from '../ast/parser/main/normalize-meta';
import type { RArgument } from '../ast/model/nodes/r-argument';
import { splitArrayOn } from '../../../util/collections/arrays';
import { EmptyArgument } from '../ast/model/nodes/r-function-call';
import type { RSymbol } from '../ast/model/nodes/r-symbol';
import { RString } from '../ast/model/nodes/r-string';
import type { RParameter } from '../ast/model/nodes/r-parameter';
import type { RProject } from '../ast/model/nodes/r-project';
import type { ParseStepOutputSingleFile } from '../../parser';
import { parseLog } from '../ast/parser/json/parser';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RExpressionList } from '../ast/model/nodes/r-expression-list';

export interface TreeSitterInfo {
	/** id of the tree-sitter node this AST node was created from, used for traceability and linking back to tree-sitter nodes */
	tsId: number
}
type SyntaxAndRNode = [SyntaxNode, RNode<TreeSitterInfo>];

/**
 * @param tree - The tree to normalize
 * @param lax  - Whether to use lax parsing (i.e., ignore errors) or strict parsing (i.e., fail on errors)
 */
export function normalizeTreeSitterTreeToAst(tree: ParseStepOutputSingleFile<Tree>[], lax?: boolean): RProject<TreeSitterInfo> {
	nonErrorChildren = lax ? nonErrorChildrenLax : nonErrorChildrenStrict;
	const files: { filePath: string | undefined, root: RExpressionList<TreeSitterInfo> }[] = [];
	for(const t of tree) {
		rejectUnsupportedPipeBind(t.parsed.rootNode);
		const root = convertTreeNode(t.parsed.rootNode);
		if(!RExpressionList.is(root)) {
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

function rejectUnsupportedPipeBind(node: SyntaxNode): void {
	if(!node.hasError) {
		return;
	} else if(node.type === TreeSitterType.Error && node.text === '>'
		&& node.previousSibling?.text === '=' && node.previousSibling.endIndex === node.startIndex) {
		throw new ParseError('the experimental pipe-bind "=>" has no production in the tree-sitter grammar flowR uses; analyze this code with the r-shell engine instead (with the "engine.r-shell.pipeBind" configuration option enabled)');
	}
	for(const child of node.children) {
		rejectUnsupportedPipeBind(child);
	}
}

function nonErrorChildrenStrict(node: SyntaxNode): SyntaxNode[] {
	return node.hasError ? [] : node.children;
}

function nonErrorChildrenLax(node: SyntaxNode): SyntaxNode[] {
	return node.hasError ? node.children.filter(n => n.type !== TreeSitterType.Error) : node.children;
}

let nonErrorChildren: (node: SyntaxNode) => SyntaxNode[] = nonErrorChildrenStrict;

function makeDefaultInfo(node: SyntaxNode, fullRange: SourceRange, fullLexeme: string) {
	return {
		info: {
			fullRange,
			adToks: [],
			fullLexeme,
			tsId:   node.id
		}
	};
}

function convertTreeNode(node: SyntaxNode | undefined): RNode<TreeSitterInfo> {
	if(!node) {
		return emptyExpressionList();
	}
	try {
		// generally, the grammar source file dictates what children a node has in what order:
		// https://github.com/r-lib/tree-sitter-r/blob/main/grammar.js
		const range = makeSourceRange(node);
		/* node.text re-assembles the subtree text on every access, so read it lazily and at most once */
		let textCache: string | undefined = undefined;
		const text = () => {
			textCache ??= node.text;
			return textCache;
		};
		let defaultInfoCache: ReturnType<typeof makeDefaultInfo> | undefined = undefined;
		const defaultInfo = () => {
			defaultInfoCache ??= makeDefaultInfo(node, range, text());
			return defaultInfoCache;
		};
		switch(node.type as TreeSitterType) {
			case TreeSitterType.Program: {
				const [comments, children] = splitCommentNodes(nonErrorChildren(node));
				const body = children.map(n => [n, convertTreeNode(n)] as SyntaxAndRNode);
				const remainingComments = linkCommentsToNextNodes(node, body, comments);
				return {
					type:     RType.ExpressionList,
					children: body.map(n => n[1]),
					grouping: undefined,
					lexeme:   undefined,
					info:     {
						adToks: remainingComments.map(c => c[1]),
						tsId:   node.id
					}
				};
			}
			case TreeSitterType.BracedExpression:
			case TreeSitterType.ParenthesizedExpression: {
				const [comments, children] = splitCommentNodes(nonErrorChildren(node));
				const opening = children[0];
				const body = children.slice(1, -1).map(n => [n, convertTreeNode(n)] as SyntaxAndRNode);
				const remainingComments = linkCommentsToNextNodes(node, body, comments);
				const closing = children[children.length - 1];
				const openText = opening.text;
				const closeText = closing.text;
				return {
					type:     RType.ExpressionList,
					location: undefined,
					lexeme:   undefined,
					children: body.map(n => n[1]),
					grouping: [
						{
							type:     RType.Symbol,
							location: makeSourceRange(opening),
							content:  RString.unquote(openText),
							lexeme:   openText,
							...defaultInfo()
						}, {
							type:     RType.Symbol,
							location: makeSourceRange(closing),
							content:  RString.unquote(closeText),
							lexeme:   closeText,
							...defaultInfo()
						}
					],
					info: {
						adToks: remainingComments.map(c => c[1]),
						tsId:   node.id
					}
				};
			}
			case TreeSitterType.BinaryOperator: {
				const children = nonErrorChildren(node);
				const lhs = convertTreeNode(children[0]);
				const rhs = convertTreeNode(children[children.length - 1]);
				const [commentsBoth, [op]] = splitCommentNodes(children.slice(1, -1));
				const comments = commentsBoth.map(c => c[1]);
				const opSource = makeSourceRange(op);
				/* every `.text` re-slices the source, so read it once */
				const opText = op.text;
				const lhsAsArg: RArgument<TreeSitterInfo> = {
					type:     RType.Argument,
					location: lhs.location as SourceRange,
					value:    lhs,
					name:     undefined,
					lexeme:   lhs.lexeme as string,
					info:     {
						tsId: lhs.info.tsId
					}
				};
				if(op.type === 'special') {
					return {
						type:         RType.FunctionCall,
						location:     opSource,
						lexeme:       text(),
						functionName: {
							type:     RType.Symbol,
							location: opSource,
							lexeme:   opText,
							content:  opText,
							info:     {
								tsId: op.id
							}
						},
						arguments: [lhsAsArg, {
							type:     RType.Argument,
							location: rhs.location as SourceRange,
							value:    rhs,
							name:     undefined,
							lexeme:   rhs.lexeme as string,
							info:     {
								tsId: rhs.info.tsId
							}
						}],
						named:        true,
						infixSpecial: true,
						info:         {
							adToks: comments,
							tsId:   node.id
						}
					};
				} else if(opText === '|>') {
					return {
						type:     RType.Pipe,
						location: opSource,
						lhs:      lhsAsArg,
						rhs,
						lexeme:   opText,
						...defaultInfo(),
						info:     {
							fullRange:  range,
							adToks:     comments,
							fullLexeme: text(),
							tsId:       node.id
						}
					};
				} else {
					return {
						type:     RType.BinaryOp,
						location: opSource,
						lhs, rhs,
						operator: opText,
						lexeme:   opText,
						info:     {
							fullRange:  range,
							adToks:     comments,
							fullLexeme: text(),
							tsId:       node.id
						}
					};
				}
			}
			case TreeSitterType.UnaryOperator: {
				const [comments, children] = splitCommentNodes(nonErrorChildren(node));
				const [op, operand] = children;
				const opText = op.text;
				return {
					type:     RType.UnaryOp,
					operand:  convertTreeNode(operand),
					location: makeSourceRange(op),
					operator: opText,
					lexeme:   opText,
					info:     {
						...defaultInfo().info,
						adToks: comments.map(c => c[1]),
					}
				};
			}
			case TreeSitterType.NamespaceOperator: {
				const [comments, children] = splitCommentNodes(nonErrorChildren(node));
				if(children.length < 3) {
					break;
				}
				const [lhs, int, rhs] = children;
				const rhsText = rhs.text;
				return {
					type:     RType.Symbol,
					location: makeSourceRange(rhs),
					content:  Identifier.make(rhsText, lhs.text, int.text === ':::'),
					lexeme:   rhsText,
					...defaultInfo(),
					info:     {
						...defaultInfo().info,
						adToks: comments.map(c => c[1]),
					}
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
					content:  RString.unquote(text()),
					lexeme:   text(),
					...defaultInfo()
				};
			case TreeSitterType.IfStatement: {
				const [comments, children] = splitCommentNodes(nonErrorChildren(node));
				const [ifNode, /* ( */, condition, /* ) */, then, /* else */, ...otherwise] = children;
				const filteredOtherwise = otherwise.filter(n => n.type !== TreeSitterType.ElseStatement);
				return {
					type:      RType.IfThenElse,
					condition: convertTreeNode(condition),
					then:      ensureExpressionList(convertTreeNode(then)),
					otherwise: filteredOtherwise.length > 0 ? ensureExpressionList(convertTreeNode(filteredOtherwise[0])) : undefined,
					location:  makeSourceRange(ifNode),
					lexeme:    ifNode.text,
					info:      {
						...defaultInfo().info,
						adToks: comments.map(c => c[1]),
					}
				};
			}
			case TreeSitterType.ForStatement: {
				const [comments, children] = splitCommentNodes(nonErrorChildren(node));
				const forNode = children[0]; // we follow with a (
				const variable = getNodesUntil(children, 'in', 2); // we follow with the "in"
				const sequence = getNodesUntil(children, ')', 2 + variable.length + 1); // we follow with a (
				const body = children[2 + variable.length + 1 + sequence.length + 1];
				const [variableComments, [variableNode]] = splitCommentNodes(variable);
				const [sequenceComments, [sequenceNode]] = splitCommentNodes(sequence);
				const variableText = variableNode.text;
				return {
					type:     RType.ForLoop,
					variable: {
						type:     RType.Symbol,
						location: makeSourceRange(variableNode),
						content:  RString.unquote(variableText),
						lexeme:   variableText,
						info:     {
							fullRange:  undefined,
							adToks:     [],
							fullLexeme: undefined,
							tsId:       variableNode.id
						}
					},
					vector:   convertTreeNode(sequenceNode),
					body:     ensureExpressionList(convertTreeNode(body)),
					location: makeSourceRange(forNode),
					lexeme:   forNode.text,
					info:     {
						fullRange:  range,
						adToks:     variableComments.concat(comments, sequenceComments).map(c => c[1]),
						fullLexeme: text(),
						tsId:       node.id
					}
				};
			}
			case TreeSitterType.WhileStatement: {
				const [comments, children] = splitCommentNodes(nonErrorChildren(node));
				const [whileNode, /* ( */, condition, /* ) */, body] = children;
				return {
					type:      RType.WhileLoop,
					condition: convertTreeNode(condition),
					body:      ensureExpressionList(convertTreeNode(body)),
					location:  makeSourceRange(whileNode),
					lexeme:    whileNode.text,
					info:      {
						...defaultInfo().info,
						adToks: comments.map(c => c[1]),
					}
				};
			}
			case TreeSitterType.RepeatStatement: {
				const [comments, [repeatNode, body]] = splitCommentNodes(nonErrorChildren(node));
				return {
					type:     RType.RepeatLoop,
					body:     ensureExpressionList(convertTreeNode(body)),
					location: makeSourceRange(repeatNode),
					lexeme:   repeatNode.text,
					info:     {
						...defaultInfo().info,
						adToks: comments.map(c => c[1]),
					}
				};
			}
			case TreeSitterType.Call: {
				const [func, argsParentheses] = nonErrorChildren(node);
				// tree-sitter wraps next and break in a function call, but we don't, so unwrap
				if(func.type === TreeSitterType.Next || func.type === TreeSitterType.Break) {
					return {
						...convertTreeNode(func),
						...defaultInfo()
					};
				}
				const rawArgs = nonErrorChildren(argsParentheses);
				const [comments, noCommentrawArgs] = splitCommentNodes(rawArgs);
				const args = splitArrayOn(noCommentrawArgs.slice(1, -1), x => x.type === 'comma');
				const funcRange = makeSourceRange(func);
				const funcText = func.text;
				const mappedArgs = args.map(n => n.length === 0 ? EmptyArgument : convertTreeNode(n[0]) as RArgument<TreeSitterInfo>);
				const call = {
					arguments: mappedArgs,
					location:  funcRange,
					lexeme:    funcText,
					...defaultInfo(),
					info:      {
						...defaultInfo().info,
						adToks: comments.map(c => c[1]),
					}
				};
				if(func.type === TreeSitterType.Identifier || func.type === TreeSitterType.String || func.type === TreeSitterType.NamespaceOperator || func.type === TreeSitterType.Return) {
					let funcNode = convertTreeNode(func) as RSymbol<TreeSitterInfo> | RString<TreeSitterInfo>;
					if(RString.is(funcNode)) {
						funcNode = {
							...funcNode,
							type:    RType.Symbol,
							content: RString.unquote(funcText)
						};
					}
					return {
						...call,
						type:         RType.FunctionCall,
						functionName: {
							...funcNode,
							info: {
								fullRange:  range,
								adToks:     [],
								fullLexeme: text(),
								tsId:       node.id
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
				const [comments, noCommentRawParams] = splitCommentNodes(paramsParens.children.slice(1, -1));

				const params = splitArrayOn(noCommentRawParams, x => x.type === 'comma');
				return {
					type:       RType.FunctionDefinition,
					parameters: params.map(n => convertTreeNode(n[0]) as RParameter<TreeSitterInfo>),
					body:       ensureExpressionList(convertTreeNode(body)),
					location:   makeSourceRange(name),
					lexeme:     name.text,
					info:       {
						...defaultInfo().info,
						adToks: comments.map(c => c[1]),
					}
				};
			}
			case TreeSitterType.String:
				return {
					type:     RType.String,
					location: range,
					content:  RStringValue.fromRLexeme(text()),
					lexeme:   text(),
					...defaultInfo()
				};
			case TreeSitterType.Float:
			case TreeSitterType.Integer:
			case TreeSitterType.Complex:
			case TreeSitterType.Inf:
			case TreeSitterType.Nan:
				return {
					type:     RType.Number,
					location: range,
					content:  RNumberValue.fromRLexeme(text()),
					lexeme:   text(),
					...defaultInfo()
				};
			case TreeSitterType.True:
			case TreeSitterType.False:
				return {
					type:     RType.Logical,
					location: range,
					content:  text() === RTrue,
					lexeme:   text(),
					...defaultInfo()
				};
			case TreeSitterType.Break:
				return {
					type:     RType.Break,
					location: range,
					lexeme:   text(),
					...defaultInfo()
				};
			case TreeSitterType.Next:
				return {
					type:     RType.Next,
					location: range,
					lexeme:   text(),
					...defaultInfo()
				};
			case TreeSitterType.Subset:
			case TreeSitterType.Subset2: {
				// subset has children like a and [x]
				const [func, content] = nonErrorChildren(node);
				// bracket is now [ or [[ and argsClosing is x] or x]]
				const [bracket, ...argsClosing] = nonErrorChildren(content);
				const [argsComments, argsNoComments] = splitCommentNodes(argsClosing.slice(0, -1));
				const args = splitArrayOn(argsNoComments, x => x.type === 'comma');
				const bracketText = bracket.text;
				return {
					type:     RType.Access,
					operator: bracketText as '[' | '[[',
					accessed: convertTreeNode(func),
					access:   args.map(n => n.length === 0 ? EmptyArgument : convertTreeNode(n[0]) as RArgument<TreeSitterInfo>),
					location: makeSourceRange(bracket),
					lexeme:   bracketText,
					info:     {
						...defaultInfo().info,
						adToks: argsComments.map(c => c[1]),
					}
				};
			}
			case TreeSitterType.ExtractOperator: {
				const [lhs, operator, rhs] = nonErrorChildren(node);
				const rhsRange = makeSourceRange(rhs);
				const rhsText = rhs?.text;
				const operatorText = operator.text;
				return {
					type:     RType.Access,
					operator: operatorText as '$' | '@',
					accessed: convertTreeNode(lhs),
					access:   [{
						type:     RType.Argument,
						name:     undefined,
						value:    convertTreeNode(rhs),
						location: rhsRange,
						lexeme:   rhsText,
						info:     {
							fullRange:  rhsRange,
							adToks:     [],
							fullLexeme: rhsText,
							tsId:       rhs?.id
						}
					}],
					location: makeSourceRange(operator),
					lexeme:   operatorText,
					...defaultInfo()
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
				const nameText = name.text;
				return {
					type: RType.Parameter,
					name: {
						type:     RType.Symbol,
						location: nameRange,
						content:  Identifier.getName(Identifier.make(nameText)),
						lexeme:   nameText,
						info:     {
							fullRange:  range,
							adToks:     [],
							fullLexeme: nameText,
							tsId:       name.id
						}
					},
					special:  nameText === '...',
					defaultValue,
					location: nameRange,
					lexeme:   nameText,
					info:     {
						fullRange:  range,
						adToks:     [],
						fullLexeme: nameText,
						tsId:       name.id
					}
				};
			}
			case TreeSitterType.Argument: {
				const [commentChildren, children] = splitCommentNodes(nonErrorChildren(node));
				if(children.length === 1) {
					const [arg] = children;
					return {
						type:     RType.Argument,
						name:     undefined,
						value:    convertTreeNode(arg),
						location: range,
						lexeme:   text(),
						info:     {
							...defaultInfo().info,
							adToks: commentChildren.map(c => c[1]),
						}
					};
				} else {
					const [nameNode, /* = */, valueNode] = children;
					let name = convertTreeNode(nameNode) as RString<TreeSitterInfo> | RSymbol<TreeSitterInfo, string>;

					// unescape argument names
					if(RString.is(name)) {
						name = {
							...name,
							type:    RType.Symbol,
							content: name.content.str
						};
					} else {
						name.content = RString.unquote(name.content);
					}
					const nameRange = makeSourceRange(nameNode);
					const nameLexeme = nameNode.text;

					return {
						type:     RType.Argument,
						name,
						value:    valueNode ? convertTreeNode(valueNode) : undefined,
						location: nameRange,
						lexeme:   nameLexeme,
						info:     {
							fullRange:  nameRange,
							adToks:     commentChildren.map(c => c[1]),
							fullLexeme: nameLexeme,
							tsId:       nameNode.id
						}
					};
				}
			}
			case TreeSitterType.Comment:
				return {
					type:     RType.Comment,
					location: range,
					lexeme:   text(),
					...defaultInfo()
				};
			case TreeSitterType.Error:
				return emptyExpressionList(defaultInfo().info);
		}
	} catch{
		parseLog.error(`[Tree-Sitter] Failed to convert node of type ${node.type} at ${JSON.stringify(makeSourceRange(node))}`);
	}
	return emptyExpressionList();
}

function emptyExpressionList(info: RExpressionList<TreeSitterInfo>['info'] = { fullRange: undefined, adToks: [], tsId: -1 }): RExpressionList<TreeSitterInfo> {
	return { type: RType.ExpressionList, location: undefined, lexeme: undefined, children: [], grouping: undefined, info };
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

function splitCommentNodes(nodes: readonly SyntaxNode[]): [comments: SyntaxAndRNode[], others: SyntaxNode[]] {
	const comments: SyntaxAndRNode[] = [];
	const others: SyntaxNode[] = [];
	for(const node of nodes) {
		if(node.type === TreeSitterType.Comment) {
			const commentText = node.text;
			comments.push([node, {
				type:     RType.Comment,
				location: makeSourceRange(node),
				lexeme:   commentText,
				info:     {
					adToks:     [],
					fullLexeme: commentText,
					tsId:       node.id
				}
			}]);
		} else {
			others.push(node);
		}
	}
	return [comments, others];
}

function linkCommentsToNextNodes(parent: SyntaxNode, nodes: readonly SyntaxAndRNode[], comments: SyntaxAndRNode[]): SyntaxAndRNode[] {
	if(comments.length === 0 || nodes.length === 0) {
		return comments;
	}
	const nodeById = new Map(nodes.map(([s, n]) => [s.id, n]));
	/* one pass over the siblings, walking them per comment is quadratic in long scripts */
	const siblings = parent.children;
	const indexOf = new Map(siblings.map((s, i) => [s.id, i]));
	const nextNonComment: (SyntaxNode | undefined)[] = [];
	for(let i = siblings.length - 2; i >= 0; i--) {
		nextNonComment[i] = siblings[i + 1].type === TreeSitterType.Comment ? nextNonComment[i + 1] : siblings[i + 1];
	}
	for(const [commentSyntaxNode, commentNode] of comments) {
		const i = indexOf.get(commentSyntaxNode.id) ?? -1;
		const prev = siblings[i - 1];
		// if there is a sibling on the same line, we link the comment to that node
		const sibling = prev?.endIndex === commentSyntaxNode.startIndex ? prev : nextNonComment[i];
		// if there is no valid sibling, we just link the comment to the first node (see normalize-expressions.ts)
		const node = (sibling && nodeById.get(sibling.id)) ?? nodes[0][1];
		(node.info.adToks ??= []).push(commentNode);
	}
	return [];
}

function getNodesUntil(nodes: SyntaxNode[], type: TreeSitterType | string, startIndex = 0): SyntaxNode[] {
	const ret = [];
	for(let i = startIndex; i < nodes.length; i++) {
		if(nodes[i].type === type) {
			break;
		}
		ret.push(nodes[i]);
	}
	return ret;
}
