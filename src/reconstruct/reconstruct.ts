/**
 * This module has one goal (and is to be rewritten soon to achieve that goal, as the file itself is way too long).
 * See {@link reconstructToCode}.
 * @module
 */

import { expensiveTrace, log, LogLevel } from '../util/log';
import { RoleInParent } from '../r-bridge/lang-4.x/ast/model/processing/role';
import { guard } from '../util/assert';
import type { MergeableRecord } from '../util/objects';
import type {
	NormalizedAst,
	ParentInformation,
	RNodeWithParent
} from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RComment } from '../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { RBinaryOp } from '../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RPipe } from '../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import type { RForLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-for-loop';
import type { RRepeatLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-repeat-loop';
import type { RIfThenElse } from '../r-bridge/lang-4.x/ast/model/nodes/r-if-then-else';
import type { RWhileLoop } from '../r-bridge/lang-4.x/ast/model/nodes/r-while-loop';
import type { RParameter } from '../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RFunctionCall, EmptyArgument, type RNamedFunctionCall } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RAccess } from '../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { type StatefulFoldFunctions, foldAstStateful } from '../r-bridge/lang-4.x/ast/model/processing/stateful-fold';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type AutoSelectPredicate, doNotAutoSelect } from './auto-select/auto-select-defaults';
import { Identifier } from '../dataflow/environments/identifier';
import { type InlineWarning, sourcePathOf } from './inline/source-inline-map';
import { RawRType } from '../r-bridge/lang-4.x/ast/model/type';

/**
 * Whether to inline every file into a single self-contained text: `true` inlines them, `'banner'` additionally
 * precedes each with a banner comment naming it.
 * @see {@link Selection#inlineFull}
 */
export type InlineFull = boolean | 'banner';
/**
 * Whether to splice resolvable `source()` calls: `true` splices them, `'banner'` additionally marks where each
 * spliced file begins and ends with a banner comment naming it.
 */
export type InlineSources = boolean | 'banner';

/** The banner comment that names a file where an inlining puts it, or where it ends (`end`). */
export function fileBanner(path: string | undefined, end = false): string {
	return `# ---- ${end ? 'end of ' : ''}${path ?? '<inline>'} ----`;
}

interface Selection {
	/** The set of node ids to be reconstructed. */
	nodes:             ReadonlySet<NodeId>
	/** @see {@link ReconstructRequiredInput#reconstructFiles} */
	reconstructFiles?: 'all' | number[]
	/**
	 * If set, selected `source()` calls are replaced by the (spliced) reconstruction of the sourced file, producing a
	 *  single self-contained reconstruction. Requires {@link Selection#sourceMap}; overrides {@link Selection#reconstructFiles}.
	 */
	inlineSources?:    InlineSources
	/**
	 * If set, every file is reconstructed into a single self-contained text, in flowR's loading order; files sourced
	 *  explicitly are spliced into their `source()` call instead of repeated at the top level (`'banner'` names each).
	 */
	inlineFull?:       InlineFull
	/**
	 * Maps a `source()` call node id to the index of the sourced file in `ast.ast.files`.
	 * Only used together with {@link Selection#inlineSources} or {@link Selection#inlineFull}. Build it via {@link buildSourceInlineMap}.
	 */
	sourceMap?:        ReadonlyMap<NodeId, number>
}

interface PrettyPrintLine {
	line:   string
	indent: number
}

function plain(text: string | Identifier): [PrettyPrintLine] {
	return [{ line: Array.isArray(text) ? Identifier.toString(text) : text, indent: 0 }];
}

type Code = PrettyPrintLine[];

export const reconstructLogger = log.getSubLogger({ name: 'reconstruct' });

function reconstructableSource(n: RNodeWithParent): string {
	const lexeme = RNode.lexeme(n);
	if(lexeme !== undefined) {
		return lexeme;
	}
	// only expression lists may lack a lexeme of their own, so we synthesize equivalent source from their children
	return RExpressionList.is(n) ? synthesizeExpressionListLexeme(n) : '';
}

/** rebuilds the source of a lexeme-less expression list (e.g., a `(` or `{` wrapper) so that it still parses */
function synthesizeExpressionListLexeme(n: RExpressionList<ParentInformation>): string {
	const inner = n.children
		.filter(c => !RComment.is(c))
		.map(c => reconstructableSource(c))
		.filter(c => c.length > 0)
		.join('; ');
	const start = RExpressionList.groupStart(n);
	const end = RExpressionList.groupEnd(n);
	if(start === undefined || end === undefined) {
		return inner;
	}
	return `${Identifier.toString(start.content)}${inner}${Identifier.toString(end.content)}`;
}

function codeToText(code: Code): string {
	return code.map(l => `${getIndentString(l.indent)}${l.line}`).join('\n');
}

/** the arguments synthesized for infix operands have no `fullLexeme`, so resolve through the value */
function getArgumentLexeme(n: RArgument<ParentInformation> | typeof EmptyArgument | undefined): string {
	if(n === undefined || RArgument.isEmpty(n)) {
		return '';
	}
	return n.info.fullLexeme ?? (n.value !== undefined ? reconstructableSource(n.value) : reconstructableSource(n));
}

function reconstructAsLeaf(leaf: RNodeWithParent, configuration: ReconstructionConfiguration): Code {
	return isSelected(configuration, leaf) ? foldToConst(leaf) : [];
}

function foldToConst(n: RNodeWithParent): Code {
	return plain(reconstructableSource(n));
}

function indentBy(lines: Code, indent: number): Code {
	return lines.map(({ line, indent: i }) => ({ line, indent: i + indent }));
}

function reconstructExpressionList(exprList: RExpressionList<ParentInformation>, _grouping: [Code, Code] | undefined,  expressions: readonly Code[], config: ReconstructionConfiguration): Code {
	const subExpressions = expressions.filter(e => e.length > 0);
	if(subExpressions.length === 0) {
		return isSelected(config, exprList) ? plain('{}') : [];
	} else if(subExpressions.length === 1) {
		if(!isSelected(config, exprList)) {
			return subExpressions[0];
		}
		const [fst] = subExpressions;
		const g = exprList.grouping;

		if(g && fst.length > 0) {
			const start = g[0].content;
			const end = g[1].content;
			fst[0].line = `${Identifier.toString(start)}${start === '{' ? ' ' : ''}${fst[0].line}`;
			fst[fst.length - 1].line = `${fst[fst.length - 1].line}${end === '}' ? ' ' : ''}${Identifier.toString(end)}`;
		}
		return fst;
	} else {
		const g = exprList.grouping;
		return [
			...(g ? plain(g[0].content) : plain('{')),
			...indentBy(subExpressions.flat(), 1),
			...(g ? plain(g[1].content) : plain('}'))
		];
	}
}

function isSelected(configuration: ReconstructionConfiguration, n: RNode<ParentInformation>) {
	return configuration.selection.has(n.info.id) || configuration.autoSelectIf(n, configuration.fullAst);
}

function reconstructRawBinaryOperator(lhs: PrettyPrintLine[], n: string, rhs: PrettyPrintLine[]) {
	return [  // inline pretty print
		...lhs.slice(0, lhs.length - 1),
		{ line: `${lhs[lhs.length - 1].line} ${n} ${rhs[0].line}`, indent: 0 },
		...indentBy(rhs.slice(1, rhs.length), 1)
	];
}

function reconstructUnaryOp(leaf: RNodeWithParent, operand: Code, configuration: ReconstructionConfiguration) {
	if(!configuration.selection.has(leaf.info.id) && operand.length === 0) {
		return [];
	}
	return foldToConst(leaf);
}

/** whether the value of `n` is the value of its rhs alone, i.e. the lhs may be dropped without changing the result */
function evaluatesToRhs(n: RBinaryOp<ParentInformation> | RPipe<ParentInformation>): boolean {
	if(RPipe.is(n)) {
		return false;
	}
	const info = RBinaryOp.getOperatorInfo(n);
	return info?.usedAs === 'assignment' && info.stringUsedInRAst !== RawRType.RightAssign;
}

function reconstructBinaryOp(n: RBinaryOp<ParentInformation> | RPipe<ParentInformation>, lhs: Code, rhs: Code, config: ReconstructionConfiguration): Code {
	if(lhs.length === 0 || rhs.length === 0) {
		// dropping the lhs is only sound if the operator evaluates to its rhs, otherwise we have to keep the operation
		if(isSelected(config, n) && !(rhs.length > 0 && evaluatesToRhs(n))) {
			return foldToConst(n);
		}
		return lhs.length === 0 ? rhs : lhs;
	}

	return reconstructRawBinaryOperator(lhs, RPipe.is(n) ? '|>' : n.operator, rhs);
}

function reconstructForLoop(loop: RForLoop<ParentInformation>, variable: Code, vector: Code, body: Code, config: ReconstructionConfiguration): Code {
	if(!isSelected(config, loop) && variable.length === 0 && vector.length === 0) {
		return body;
	} else if(body.length === 0 && variable.length === 0 && vector.length === 0) {
		return [];
	}
	return reconstructBodyWithHeader({ line: `for(${reconstructableSource(loop.variable)} in ${reconstructableSource(loop.vector)})`, indent: 0 }, body, ' {}');
}

function reconstructBodyWithHeader(header: PrettyPrintLine, body: Code, onEmpty: string): Code {
	if(body.length === 0) {
		return [{ line: `${header.line}${onEmpty}`, indent: header.indent }];
	} else if(body.length === 1) {
		return [
			{ line: `${header.line} ${body[0].line}`, indent: header.indent }
		];
	} else if(body[0].line === '{' && body[body.length - 1].line === '}') {
		return [
			{ line: `${header.line} {`, indent: header.indent },
			...body.slice(1, body.length - 1),
			{ line: '}', indent: header.indent }
		];
	} else {
		return [
			header,
			...indentBy(body, 1)
		];
	}
}

function reconstructRepeatLoop(loop: RRepeatLoop<ParentInformation>, body: Code, configuration: ReconstructionConfiguration): Code {
	if(!isSelected(configuration, loop)) {
		return body;
	}
	return reconstructBodyWithHeader({ line: 'repeat', indent: 0 }, body, '{}');
}

function reconstructIfThenElse(ifThenElse: RIfThenElse<ParentInformation>, condition: Code, then: Code, otherwise: Code | undefined, config: ReconstructionConfiguration): Code {
	otherwise ??= [];
	if(then.length === 0 && otherwise.length === 0) {
		if(isSelected(config, ifThenElse)) {
			return [{ line: `if(${reconstructableSource(ifThenElse.condition)}) { }`, indent: 0 }];
		} else if(condition.length > 0) {
			return condition;
		} else {
			return [];
		}
	} else if(otherwise.length === 0) {
		if(isSelected(config, ifThenElse)) {
			return reconstructBodyWithHeader(
				{ line: `if(${reconstructableSource(ifThenElse.condition)})`, indent: 0 },
				then, '{}'
			);
		} else {
			return then;
		}
	} else if(then.length === 0) {
		if(isSelected(config, ifThenElse)) {
			return reconstructBodyWithHeader(
				{ line: `if(${reconstructableSource(ifThenElse.condition)}) { } else`, indent: 0 },
				then, '{}'
			);
		} else {
			return otherwise;
		}
	} else {
		const thenRemainder = indentBy(then.slice(1), 1);
		if(thenRemainder.length > 0) {
			if(!thenRemainder[thenRemainder.length - 1].line.trim().endsWith('else')) {
				thenRemainder[thenRemainder.length - 1].line += ' else ';
			}
		}
		return [
			{ line: `if(${reconstructableSource(ifThenElse.condition)}) ${then[0].line} ${then.length === 1 ? 'else' : ''}`, indent: 0 },
			...thenRemainder,
			{ line: `${otherwise[0].line}`, indent: 0 },
			...indentBy(otherwise.splice(1), 1)
		];
	}
}

function reconstructWhileLoop(loop: RWhileLoop<ParentInformation>, condition: Code, body: Code, configuration: ReconstructionConfiguration): Code {
	if(!isSelected(configuration, loop) && condition.length === 0) {
		return body;
	} else if(body.length === 0 && condition.length === 0) {
		return [];
	}
	return reconstructBodyWithHeader({ line: `while(${reconstructableSource(loop.condition)})`, indent: 0 }, body, ' {}');
}

function parameterSource(p: RParameter<ParentInformation>): string {
	return p.defaultValue === undefined ? reconstructableSource(p) : `${reconstructableSource(p.name)}=${reconstructableSource(p.defaultValue)}`;
}

function reconstructParameters(parameters: readonly RParameter<ParentInformation>[]): string[] {
	return parameters.map(parameterSource);
}

function isNotEmptyArgument(a: Code | typeof EmptyArgument): a is Code {
	return a !== EmptyArgument;
}

function reconstructFoldAccess(node: RAccess<ParentInformation>, accessed: Code, access: readonly (Code | typeof EmptyArgument)[]): Code {
	if(accessed.length === 0) {
		return access.filter(isNotEmptyArgument).flat();
	} else if(access.every(a => a === EmptyArgument || a.length === 0)) {
		return accessed;
	}

	return foldToConst(node);
}

function reconstructArgument(argument: RArgument<ParentInformation>, name: Code | undefined, value: Code | undefined): Code {
	if(argument.name !== undefined && name !== undefined && name.length > 0) {
		return plain(`${reconstructableSource(argument.name)}=${argument.value ? reconstructableSource(argument.value) : ''}`);
	} else {
		return value ?? [];
	}
}

function reconstructParameter(parameter: RParameter<ParentInformation>, name: Code, defaultValue: Code | undefined, configuration: ReconstructionConfiguration): Code {
	if(isSelected(configuration, parameter)) {
		return foldToConst(parameter);
	}
	if(parameter.defaultValue === undefined) {
		return name;
	}
	return name.length > 0 ? plain(parameterSource(parameter)) : defaultValue ?? [];
}

/** whether any ancestor of `n` is part of the reconstruction and hence may consume the value of `n` */
function hasSelectedAncestor(n: RNodeWithParent, config: ReconstructionConfiguration): boolean {
	const { idMap } = config.fullAst;
	for(const parent of RNode.iterateParents(n, idMap)) {
		if(isSelected(config, parent)) {
			return true;
		}
	}
	return false;
}

function isHandedToACall(definition: RFunctionDefinition<ParentInformation>): boolean {
	return definition.info.role === RoleInParent.FunctionCallArgument || definition.info.role === RoleInParent.ArgumentValue;
}

function reconstructFunctionDefinition(
	definition: RFunctionDefinition<ParentInformation>,
	functionParameters: readonly Code[],
	body: Code,
	config: ReconstructionConfiguration
): Code {
	// if a definition is not selected, we only use the body - slicing will always select the definition if it is required
	if(functionParameters.every(p => p.length === 0)) {
		const empty = body === undefined || body.length === 0;
		const selected = isSelected(config, definition);
		if(empty && selected) { // give function stub
			return plain(`${definition.lexeme}(${reconstructParameters(definition.parameters).join(', ')}) { }`);
		} else if(!selected && !hasSelectedAncestor(definition, config)) {
			return isHandedToACall(definition) ? [] : body;
		}
	}
	const parameters = reconstructParameters(definition.parameters).join(', ');
	if(body.length <= 1) {
		// 'inline'
		const bodyStr = body.length === 0 ? '{ }' : `${body[0].line}`;
		// we keep the braces in every case because I do not like no-brace functions
		return [{ line: `${definition.lexeme}(${parameters}) ${bodyStr}`, indent: 0 }];
	} else {
		// 'block'
		return [
			{ line: `${definition.lexeme}(${parameters}) ${body[0].line}`, indent: 0 },
			...body.slice(1),
		];
	}

}

function reconstructSpecialInfixFunctionCall(args: readonly (Code | typeof EmptyArgument)[], call: RFunctionCall<ParentInformation>): Code {
	guard(args.length === 2, () => `infix special call must have exactly two arguments, got: ${args.length} (${JSON.stringify(args)})`);
	guard(call.named, `infix special call must be named, got: ${call.named}`);
	const [lhs, rhs] = args;

	if((lhs === undefined || lhs.length === 0) && (rhs === undefined || rhs.length === 0)) {
		return [];
	}
	// if rhs is undefined we still have to keep both now, but reconstruct manually :/
	if(lhs !== EmptyArgument && lhs.length > 0) {
		const lhsText = codeToText(lhs);
		if(rhs !== EmptyArgument && rhs.length > 0) {
			return plain(`${lhsText} ${Identifier.toString(call.functionName.content)} ${codeToText(rhs)}`);
		} else {
			return plain(lhsText);
		}
	}
	// only the operands' lexemes are left to go by; a `{` block has none, so keep the call as it was written
	const lhsLexeme = getArgumentLexeme(call.arguments[0]);
	const rhsLexeme = getArgumentLexeme(call.arguments[1]);
	if(lhsLexeme.length === 0 || rhsLexeme.length === 0) {
		return foldToConst(call);
	}
	return plain(`${lhsLexeme} ${Identifier.toString(call.functionName.content)} ${rhsLexeme}`);
}

/**
 * If `inlineSources` is active and this is a selected, resolvable `source()` call, returns the reconstruction to
 *  splice in its place (or the literal call at a cycle edge); `undefined` means reconstruct as usual.
 */
function tryInlineSourceCall(call: RFunctionCall<ParentInformation>, config: ReconstructionConfiguration): Code | undefined {
	const id = call.info.id;
	const targetFile = config.sourceMap?.get(id);
	if(targetFile !== undefined) {
		const visited = config.visited ?? new Set<number>([config.currentFile ?? 0]);
		const path = config.fullAst.ast.files[targetFile]?.filePath;
		if(visited.has(targetFile)) {
			// cyclic source() - keep the literal call and mark the cycle edge
			config.warnings?.push({ kind: 'cycle', callId: id, path });
			reconstructLogger.warn(`cyclic source() not inlined at node ${JSON.stringify(id)}: ${JSON.stringify(path)}`);
			const literal = foldToConst(call);
			literal.push({ line: `# [flowR] cyclic source() not inlined: ${path ?? '<unknown>'}`, indent: 0 });
			return literal;
		}
		const childConfig: ReconstructionConfiguration = {
			...config,
			visited:     visited.union(new Set([config.currentFile ?? 0, targetFile])),
			currentFile: targetFile
		};
		const spliced = stripOuterExpressionList(reconstructFileCode(config.fullAst, targetFile, childConfig));
		return config.banner ? [{ line: fileBanner(path), indent: 0 }, ...spliced, { line: fileBanner(path, true), indent: 0 }] : spliced;
	}
	// a selected source() that we could not link to a file (dynamic/missing path): keep it verbatim
	if(RFunctionCall.isNamed(call, 'source')) {
		const path = sourcePathOf(call);
		config.warnings?.push({ kind: 'unresolved', callId: id, path });
		reconstructLogger.warn(`unresolved source() not inlined at node ${JSON.stringify(id)}: ${JSON.stringify(path)}`);
	}
	return undefined;
}

function isBlock(n: RNode<ParentInformation> | undefined): boolean {
	return RExpressionList.is(n) && n.grouping?.[0].content === '{';
}

/**
 * A call handed a block, like `local({ x <- 1; y <- 2 })`, with only the statements of the block the slice selects;
 * every other argument is kept as written.
 */
function reconstructCallOfBlock(call: RNamedFunctionCall<ParentInformation>, args: readonly (Code | typeof EmptyArgument)[], config: ReconstructionConfiguration): Code | undefined {
	const blocks = call.arguments.filter(a => a !== EmptyArgument && isBlock(a.value)).map(a => (a as RArgument<ParentInformation>).value as RExpressionList<ParentInformation>);
	/* a block the slice keeps whole stays as it is written */
	if(blocks.every(b => b.children.every(c => isSelected(config, c)))) {
		return undefined;
	}
	const parts = call.arguments.map((a, i): Code => {
		if(a === EmptyArgument) {
			return plain('');
		} else if(!isBlock(a.value)) {
			const value = a.value === undefined ? '' : reconstructableSource(a.value);
			return plain(a.name === undefined ? value : `${RNode.ownLexeme(a.name) ?? ''} = ${value}`);
		}
		const block = args[i];
		const body = block === EmptyArgument || block.length === 0 ? plain('{}') : block;
		return a.name === undefined ? body : [{ ...body[0], line: `${RNode.ownLexeme(a.name) ?? ''} = ${body[0].line}` }, ...body.slice(1)];
	});
	const lines: PrettyPrintLine[] = [{ line: `${RNode.ownLexeme(call.functionName) ?? reconstructableSource(call.functionName)}(`, indent: 0 }];
	parts.forEach((part, i) => {
		const last = lines[lines.length - 1];
		last.line += (i > 0 ? ', ' : '') + part[0].line;
		lines.push(...part.slice(1));
	});
	lines[lines.length - 1].line += ')';
	return lines;
}

function reconstructFunctionCall(
	call: RFunctionCall<ParentInformation>,
	functionName: Code,
	args: readonly (Code | typeof EmptyArgument)[],
	configuration: ReconstructionConfiguration
): Code {
	const selected = isSelected(configuration, call);
	if(configuration.inlineSources && selected) {
		const inlined = tryInlineSourceCall(call, configuration);
		if(inlined !== undefined) {
			return inlined;
		}
	}
	if(!selected) {
		const f = args.filter(a => a !== EmptyArgument && a.length !== 0) as Code[];
		if(f.length === 0) {
			return [];
		} else if(f.length === 1) {
			return f[0];
		}
	}

	if(call.infixSpecial === true) {
		return reconstructSpecialInfixFunctionCall(args, call);
	}
	if(call.named && selected) {
		return reconstructCallOfBlock(call, args, configuration) ?? foldToConst(call);
	}
	if(functionName.length === 0 && args.every(a => a === undefined || a.length === 0)) {
		return [];
	}

	if(args.length === 0) {
		guard(functionName.length > 0, `without args, we need the function name to be present! got: ${JSON.stringify(functionName)}`);
		const last = functionName[functionName.length - 1];
		if(!call.named && !last.line.endsWith(')')) {
			functionName[0].line = `(${functionName[0].line}`;
			last.line += ')';
		}

		// add empty call braces if not present
		last.line += '()';
		return functionName;
	} else {
		return foldToConst(call);
	}
}

/** Options to use with {@link reconstructToCode}. */
interface ReconstructionConfiguration<Info = ParentInformation> extends MergeableRecord {
	selection:      ReadonlySet<NodeId>
	fullAst:        NormalizedAst<Info>
	/** if true, this will force the ast part to be reconstructed, this can be used, for example, to force include `library` statements */
	autoSelectIf:   AutoSelectPredicate
	/** @see {@link Selection#inlineSources} */
	inlineSources?: boolean
	/** whether each spliced file is marked by banner comments, see {@link InlineSources} */
	banner?:        boolean
	/** @see {@link Selection#sourceMap} */
	sourceMap?:     ReadonlyMap<NodeId, number>
	/** the set of file indices currently being inlined on the active path (used to break cyclic `source()` inlining) */
	visited?:       ReadonlySet<number>
	/** the index of the file that is currently being reconstructed (0 = main file) */
	currentFile?:   number
	/** collects the warnings raised while inlining `source()` calls (shared by reference across the recursion) */
	warnings?:      InlineWarning[]
}

/** The fold functions used to reconstruct the ast in {@link reconstructToCode}. */
const reconstructAstFolds: StatefulFoldFunctions<ParentInformation, ReconstructionConfiguration, Code> = {
	// we just pass down the state information so everyone has them
	down:         (_n, c) => c,
	foldNumber:   reconstructAsLeaf,
	foldString:   reconstructAsLeaf,
	foldLogical:  reconstructAsLeaf,
	foldSymbol:   reconstructAsLeaf,
	foldAccess:   reconstructFoldAccess,
	foldBinaryOp: reconstructBinaryOp,
	foldPipe:     reconstructBinaryOp,
	foldUnaryOp:  reconstructUnaryOp,
	other:        {
		foldComment:       reconstructAsLeaf,
		foldLineDirective: reconstructAsLeaf
	},
	loop: {
		foldFor:    reconstructForLoop,
		foldRepeat: reconstructRepeatLoop,
		foldWhile:  reconstructWhileLoop,
		foldBreak:  reconstructAsLeaf,
		foldNext:   reconstructAsLeaf
	},
	foldIfThenElse: reconstructIfThenElse,
	foldExprList:   reconstructExpressionList,
	functions:      {
		foldFunctionDefinition: reconstructFunctionDefinition,
		foldFunctionCall:       reconstructFunctionCall,
		foldParameter:          reconstructParameter,
		foldArgument:           reconstructArgument
	}
};

function getIndentString(indent: number): string {
	return ' '.repeat(indent * 4);
}

function prettyPrintCodeToString(code: Code, lf = '\n'): string {
	return code.map(({ line, indent }) => `${getIndentString(indent)}${line}`).join(lf);
}

export interface ReconstructionResult {
	/** Returns the reconstructed code as string or array of code reconstructions (corresponding to the desired file indices in the {@link Selection}) */
	code:                  string | string[]
	/** number of lines that contain nodes that triggered the `autoSelectIf` predicate {@link reconstructToCode} */
	linesWithAutoSelected: number
	/** warnings raised while inlining `source()` calls (only set when {@link Selection#inlineSources} is active) */
	inlineWarnings?:       InlineWarning[]
	/**
	 * The reconstructed files, in loading order, each with the path it came from (absent for inline code); `code` holds the same parts joined into one string.
	 * Not set by the inlinings, whose whole purpose is to produce one self-contained text.
	 */
	files?:                readonly { path: string | undefined, code: string }[]
}

/** Removes a redundant outer `{ }` block (de-indenting its content) if present. */
function stripOuterExpressionList(result: Code): Code {
	if(result.length > 1 && result[0].line === '{' && result[result.length - 1].line === '}') {
		return indentBy(result.slice(1, result.length - 1), -1);
	}
	return result;
}

function removeOuterExpressionListIfApplicable(result: Code): string  {
	return prettyPrintCodeToString(stripOuterExpressionList(result));
}

/** Folds a single file of the project into {@link Code}, reused by the top-level reconstruction and the `source()` inlining recursion. */
function reconstructFileCode(ast: NormalizedAst, fileIndex: number, config: ReconstructionConfiguration): Code {
	if(reconstructLogger.settings.minLevel <= LogLevel.Trace) {
		reconstructLogger.trace(`reconstructing file index ${fileIndex} with root id ${ast.ast.files[fileIndex].root.info.id}`);
	}
	return foldAstStateful(ast.ast.files[fileIndex].root, config, reconstructAstFolds);
}

export function reconstructToCode(ast: NormalizedAst, selection: Selection & ({ inlineSources: true } | { inlineFull: true } | { reconstructFiles?: [number] | undefined }), autoSelectIf?: AutoSelectPredicate): ReconstructionResult & { code: string };
export function reconstructToCode(ast: NormalizedAst, selection: Selection, autoSelectIf?: AutoSelectPredicate): ReconstructionResult;
/**
 * Reconstructs parts of a normalized R ast into R code on an expression basis; `selection` gives the node ids to reconstruct (probably identified by the slicer), `autoSelectIf` can force additional ones.
 * @returns the reconstructed code, plus the number of lines for which `autoSelectIf` triggered.
 */
export function reconstructToCode(ast: NormalizedAst, selection: Selection, autoSelectIf: AutoSelectPredicate = doNotAutoSelect): ReconstructionResult {
	if(reconstructLogger.settings.minLevel <= LogLevel.Trace) {
		reconstructLogger.trace(`reconstruct ast with ids: ${JSON.stringify([...selection.nodes])} for files: ${JSON.stringify(selection.reconstructFiles)}`);
	}

	// we use a wrapper to count the number of lines for which the autoSelectIf predicate triggered
	const linesWithAutoSelected = new Set<number>();
	const autoSelectIfWrapper = (node: RNode<ParentInformation>) => {
		const result = autoSelectIf(node, ast);
		if(result && node.location) {
			for(let i = node.location[0]; i <= node.location[2]; i++) {
				linesWithAutoSelected.add(i);
			}
		}
		return result;
	};

	// both inlinings splice every resolvable `source()` in place, overriding `reconstructFiles`: `inlineSources`
	// emits the main file alone, `inlineFull` every file flowR loads, minus the ones already spliced into a call.
	if(selection.inlineFull || selection.inlineSources) {
		const warnings: InlineWarning[] = [];
		const sourceMap = selection.sourceMap ?? new Map<NodeId, number>();
		const splicedIn = new Set<number>(sourceMap.values());
		const roots = ast.ast.files.map((_, i) => i).filter(i => !splicedIn.has(i));
		/* the program starts in the first file no other one sources, wherever flowR happened to load it */
		const indices = selection.inlineFull ? roots : [roots[0] ?? 0];
		const parts: string[] = [];
		for(const i of indices) {
			const code = removeOuterExpressionListIfApplicable(reconstructFileCode(ast, i, {
				selection:     selection.nodes,
				autoSelectIf:  autoSelectIfWrapper,
				fullAst:       ast,
				inlineSources: true,
				banner:        selection.inlineFull === 'banner' || selection.inlineSources === 'banner',
				sourceMap,
				visited:       new Set<number>([i]),
				currentFile:   i,
				warnings
			}));
			if(code.length > 0) {
				parts.push(selection.inlineFull === 'banner' ? `${fileBanner(ast.ast.files[i].filePath)}\n${code}` : code);
			}
		}
		return {
			code:                  parts.join('\n'),
			linesWithAutoSelected: linesWithAutoSelected.size,
			inlineWarnings:        warnings
		};
	}

	const indices = selection.reconstructFiles === 'all' ? ast.ast.files.map((_, i) => i) : (selection.reconstructFiles ?? [0]);
	guard(
		indices.every(i => i >= 0 && i < ast.ast.files.length),
		`reconstructToCode: reconstructFiles contains invalid file indices: ${JSON.stringify(indices)} for ast with ${ast.ast.files.length} files`
	);

	const results: string[] = [];
	for(const i of indices) {
		results.push(
			removeOuterExpressionListIfApplicable(reconstructFileCode(ast, i, {
				selection: selection.nodes, autoSelectIf: autoSelectIfWrapper, fullAst: ast, currentFile: i
			}))
		);
	}

	expensiveTrace(reconstructLogger, () => `reconstructed ast before string conversion: ${JSON.stringify(results)}`);

	return {
		code:                  indices.length === 1 ? results[0] : results,
		files:                 indices.map((i, k) => ({ path: ast.ast.files[i].filePath, code: results[k] })),
		linesWithAutoSelected: linesWithAutoSelected.size
	};
}
