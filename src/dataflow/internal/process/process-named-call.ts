import type { DataflowProcessorInformation } from '../../processor';
import type { DataflowInformation } from '../../info';
import { processNamedCall } from './functions/call/named-call-handling';
import { toUnnamedArgument, wrapArgumentsUnnamed } from './functions/call/argument/make-argument';
import { processFunctionArgument } from './functions/process-argument';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RAstNodeBase, RNode, Location } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type RNamedFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { Identifier } from '../../environments/identifier';
import type { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import type { RPipe } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-pipe';
import { guard } from '../../../util/assert';

/**
 * Helper function for {@link processNamedCall} using the given `functionName` as the name of the function.
 */
export function processAsNamedCall<OtherInfo>(
	{ info, lexeme, location }: RNode<OtherInfo & ParentInformation> & RAstNodeBase<OtherInfo> & Location,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	name: Identifier,
	args: readonly (RNode<OtherInfo & ParentInformation> | typeof EmptyArgument | undefined)[]
): DataflowInformation {
	return processNamedCall({
		type:    RType.Symbol,
		info,
		content: name,
		lexeme,
		location,
	}, wrapArgumentsUnnamed(args, data.completeAst.idMap), info.id, data);
}

type RBinaryOpOrPipe<OtherInfo> = (RBinaryOp<OtherInfo & ParentInformation> | RPipe<OtherInfo & ParentInformation>) & RAstNodeBase<OtherInfo> & Location;
/** A named, infix-special call, e.g. magrittr's `lhs %>% rhs`: normalized as a {@link RType#FunctionCall}, not as {@link RType#BinaryOp}. */
type RInfixSpecialCall<OtherInfo> = RNamedFunctionCall<OtherInfo & ParentInformation>;
/** Any node shape that forms a left-associative operator chain through its first/left operand. */
type ChainNode<OtherInfo> = RBinaryOpOrPipe<OtherInfo> | RInfixSpecialCall<OtherInfo>;

function isBinaryOpOrPipe<OtherInfo>(node: RNode<OtherInfo & ParentInformation>): node is RBinaryOpOrPipe<OtherInfo> {
	return node.type === RType.BinaryOp || node.type === RType.Pipe;
}

function isInfixSpecialCall<OtherInfo>(node: RNode<OtherInfo & ParentInformation>): node is RInfixSpecialCall<OtherInfo> {
	return node.type === RType.FunctionCall && node.named === true && node.infixSpecial === true && node.arguments.length === 2;
}

function isChainNode<OtherInfo>(node: RNode<OtherInfo & ParentInformation> | undefined): node is ChainNode<OtherInfo> {
	return node !== undefined && (isBinaryOpOrPipe(node) || isInfixSpecialCall(node));
}

/**
 * The raw (unwrapped) left operand of a chain node, used to detect whether the chain continues.
 * <p>
 * Unlike {@link RType#BinaryOp}, whose `lhs` is the raw operand, both parser backends always pre-wrap a
 * {@link RType#Pipe}'s `lhs` (and an infix-special {@link RType#FunctionCall}'s first argument) as an
 * {@link RArgument}, so those need unwrapping via `.value` first.
 */
function chainLhsRaw<OtherInfo>(node: ChainNode<OtherInfo>): RNode<OtherInfo & ParentInformation> | undefined {
	if(node.type === RType.FunctionCall) {
		const arg = node.arguments[0];
		return arg === EmptyArgument ? undefined : arg.value;
	}
	return RArgument.is(node.lhs) ? node.lhs.value : node.lhs;
}

/** The left operand of a chain node, wrapped as the {@link RArgument} that {@link processAllArguments} would process it as. */
function chainLhsArgument<OtherInfo>(node: ChainNode<OtherInfo>, idMap: DataflowProcessorInformation<OtherInfo & ParentInformation>['completeAst']['idMap']) {
	if(node.type === RType.FunctionCall) {
		const arg = node.arguments[0];
		guard(arg !== EmptyArgument, 'an infix-special call always has a non-empty first argument');
		return arg;
	}
	if(RArgument.is(node.lhs)) {
		return node.lhs;
	}
	const wrapped = toUnnamedArgument(node.lhs, idMap);
	guard(wrapped !== EmptyArgument, 'the lhs of a binary operator is never empty');
	return wrapped;
}

/**
 * Processes a single chain node (see {@link ChainNode}), recursing normally into its children. A caller folding
 * a whole chain (see {@link processChainedCall}) may pass an already-processed left operand via
 * `data.precomputedFirstArg` (keyed by `node.info.id`) to avoid recursing into it again.
 */
function processSingleChainNode<OtherInfo>(
	node: ChainNode<OtherInfo>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(node.type === RType.FunctionCall) {
		return processNamedCall(node.functionName, node.arguments, node.info.id, data);
	}
	const { info, lexeme, location, lhs, rhs } = node;
	return processNamedCall({
		type:    RType.Symbol,
		info,
		content: node.type === RType.Pipe ? lexeme : node.operator,
		lexeme,
		location,
	}, wrapArgumentsUnnamed([lhs, rhs], data.completeAst.idMap), info.id, data);
}

/**
 * Processes a {@link ChainNode}: {@link RType#BinaryOp}, {@link RType#Pipe}, and magrittr-style `%op%` calls
 * (infix-special {@link RType#FunctionCall}s) all nest on their left operand, so a long `a + b + c + ...` or
 * `a %>% f() %>% f() %>% ...` chain buries it arbitrarily deep.
 * This walks the left spine of chain nodes with an explicit loop (bounded stack usage regardless of
 * chain length), processes the innermost (leftmost) node normally, and then folds outward: each level's left
 * operand is wrapped via {@link processFunctionArgument}.
 */
export function processChainedCall<OtherInfo>(
	node: ChainNode<OtherInfo>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): DataflowInformation {
	if(!isChainNode<OtherInfo>(chainLhsRaw(node))) {
		return processSingleChainNode(node, data);
	}

	const spine: ChainNode<OtherInfo>[] = [node];
	let cur = chainLhsRaw(node) as ChainNode<OtherInfo>;
	while(true) {
		spine.push(cur);
		const next = chainLhsRaw(cur);
		if(!isChainNode<OtherInfo>(next)) {
			break;
		}
		cur = next;
	}

	// process the innermost (leftmost) node normally, then fold outward through the rest of the spine
	let result = processSingleChainNode(spine[spine.length - 1], data);
	for(let i = spine.length - 2; i >= 0; i--) {
		const level = spine[i];
		const lhsRaw = chainLhsRaw(level);
		guard(lhsRaw !== undefined, 'a chain node always has a left operand');
		const wrappedLhs = chainLhsArgument(level, data.completeAst.idMap);
		const lhsInfo = processFunctionArgument(wrappedLhs, { ...data, precomputedValue: { nodeId: lhsRaw.info.id, info: result } });
		result = processSingleChainNode(level, { ...data, precomputedFirstArg: { rootId: level.info.id, info: lhsInfo } });
	}
	return result;
}
