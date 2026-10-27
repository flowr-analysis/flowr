import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import type { DependencyInfo } from './dependencies-query-format';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import { BuiltInProcName } from '../../../dataflow/environments/built-in-proc-name';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RComment } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { RLineDirective } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { queryFnProps } from '../../../dataflow/environments/query-fn-props';
import { ArgProp, CallProp } from '../../../dataflow/environments/built-in-props';
import { callOnlyQueries } from '../../../dataflow/internal/process/functions/call/built-in/built-in-ambient-state';
import { callIdentifierOf, isPlot } from './plot-objects';
import { inputVariablesAt } from './data-flow';
import { ExpectFunctionNames } from './function-info/test-functions';
import type { FunctionInfo } from './function-info/function-info';

/** the node whose value R echoes for a statement, `undefined` if the statement yields nothing visible */
function echoedValue(node: RNode<ParentInformation> | undefined, dataflow: DataflowInformation, invisible: readonly FunctionInfo[], seen: Set<NodeId> = new Set()): RNode<ParentInformation> | undefined {
	/* an assignment returns its value invisibly: `x <- 1`, `names(x) <- v` and `assign("x", 1)` print nothing */
	if(isAssignment(node, dataflow)) {
		return undefined;
	}
	switch(node?.type) {
		/* the loops hand back an invisible NULL, and the jumps never hand back anything at all */
		case undefined:
		case RType.ForLoop:
		case RType.WhileLoop:
		case RType.RepeatLoop:
		case RType.Break:
		case RType.Next:
		case RType.Comment:
		case RType.LineDirective:
			return undefined;
		case RType.FunctionCall: {
			if(callName(node, dataflow, invisible, seen) === undefined) {
				return undefined;
			}
			const handedOn = aliased(node, dataflow, invisible);
			return handedOn === undefined ? node : echoedValue(handedOn, dataflow, invisible, seen);
		}
		/* a block hands on the value of its last statement, a `( )` group that of what it holds, visibly:
		   which is what makes `(x <- 1)` print what it assigned */
		case RType.ExpressionList:
			return grouped(node) ? lastStatement(node) ?? node
				: echoedValue(lastStatement(node), dataflow, invisible, seen) ?? (node.children.length === 0 ? node : undefined);
		case RType.Pipe:
			return echoedValue(node.rhs, dataflow, invisible, seen);
		/* whichever branch runs decides; without an `else` a false condition yields an invisible NULL */
		case RType.IfThenElse:
			return echoedValue(node.then, dataflow, invisible, seen) ?? echoedValue(node.otherwise, dataflow, invisible, seen);
		/* a symbol, a constant, an access, an operator, or a function definition is printed as it stands */
		default:
			return node;
	}
}

/** the processors of assignments; the vertex of a replacement like `x$a <- 1` sits on its target `x` */
const Assigning: readonly BuiltInProcName[] = [BuiltInProcName.Assignment, BuiltInProcName.SuperAssignment, BuiltInProcName.Replacement, BuiltInProcName.TableAssignment];

function isAssignment(node: RNode<ParentInformation> | undefined, dataflow: DataflowInformation): boolean {
	const vertex = node === undefined ? undefined : dataflow.graph.getVertex(node.info.id);
	return (RBinaryOp.is(node) && RBinaryOp.getOperatorInfo(node)?.usedAs === 'assignment') || Assigning.some(p => DfgVertex.hasOrigin(vertex, p));
}

/** whether the list is a `( )` group rather than a `{ }` block, which is what makes its value visible */
function grouped(node: RExpressionList<ParentInformation>): boolean {
	return node.grouping?.[0].content === '(';
}

/**
 * The call whose result this one hands back unchanged, as its {@link ArgProp.Alias} argument states: a pipe
 * is visible exactly when the call it feeds is. `undefined` when the call answers for itself.
 */
function aliased(node: RFunctionCall<ParentInformation>, dataflow: DataflowInformation, invisible: readonly FunctionInfo[]): RNode<ParentInformation> | undefined {
	const name = callName(node, dataflow, invisible);
	const at = name === undefined ? -1 : queryFnProps(name, { environment: dataflow.environment })?.sig
		?.findIndex(([, p]) => (p & ArgProp.Alias) !== 0) ?? -1;
	const arg = at < 0 ? undefined : node.arguments[at];
	const value = typeof arg === 'object' && RArgument.is(arg) ? arg.value : undefined;
	/* only a call, a block or an assignment can make a result invisible: `return(x <- 1)` prints nothing, `return(x)` does */
	return RFunctionCall.is(value) || RExpressionList.is(value) || isAssignment(value, dataflow) ? value : undefined;
}

/** the last statement of a block, which is what its value comes from */
function lastStatement<Info>(node: RExpressionList<Info>): RNode<Info> | undefined {
	for(let i = node.children.length - 1; i >= 0; i--) {
		const child = node.children[i];
		if(!RComment.is(child) && !RLineDirective.is(child)) {
			return child;
		}
	}
	return undefined;
}

/**
 * The name of the call if its result is visible, `undefined` if it hands it back invisibly. A call that reaches
 * functions of the program is visible exactly when one of their exits yields a visible value, by the same rules as a
 * statement of the top level, whatever a built-in of that name would do; only otherwise its built-in props decide.
 */
function callName(node: RFunctionCall<ParentInformation>, dataflow: DataflowInformation, invisible: readonly FunctionInfo[], seen: Set<NodeId> = new Set()): Identifier | undefined {
	const name = callIdentifierOf(node, dataflow);
	if(name === undefined || ExpectFunctionNames.test(Identifier.getName(name)) || isInvisible(name, invisible)) {
		return undefined;
	}
	const idMap = dataflow.graph.idMap;
	const callees = [...Dataflow.calleesOf(dataflow.graph, node.info.id)];
	if(callees.length > 0 && idMap !== undefined) {
		/* a recursive call is as visible as the call that started it, which the others decide */
		if(seen.has(node.info.id)) {
			return undefined;
		}
		seen.add(node.info.id);
		return callees.some(definition => definition.exitPoints.some(exit => echoedValue(idMap.get(exit.nodeId), dataflow, invisible, seen) !== undefined)) ? name : undefined;
	}
	const props = queryFnProps(name, { environment: dataflow.environment });
	/* a setter hands back the previous state invisibly, but queried, the state is what it returns */
	const hidden = FunctionSemantics.call.props.hasAny(props, [CallProp.Invisible]) && !callOnlyQueries(name, node.arguments, dataflow.environment);
	return hidden ? undefined : name;
}

/** whether the call is to one of the functions stated to return invisibly, unless its package says it is another one */
function isInvisible(name: Identifier, invisible: readonly FunctionInfo[]): boolean {
	const fn = Identifier.getName(name);
	const ns = Identifier.getNamespace(name);
	return invisible.some(f => f.name === fn && (f.package === undefined || ns === undefined || f.package === ns));
}

/** what to report the echo under: the called name, or the operator or lexeme producing the value */
function echoName(node: RNode<ParentInformation>, dataflow: DataflowInformation): Identifier {
	switch(node.type) {
		/* a call without a name, like `o$bump()`, is named by the code it calls, `o$bump`, as its id changes with any edit */
		case RType.FunctionCall:
			return node.named ? callIdentifierOf(node, dataflow) ?? '' : RNode.lexeme(node.calledFunction) ?? '';
		case RType.BinaryOp:
		case RType.UnaryOp:
		case RType.Access:
			return node.operator;
		case RType.FunctionDefinition:
			return 'function';
		case RType.ExpressionList:
			return grouped(node) ? '(' : '{';
		default:
			return RNode.lexeme(node) ?? '';
	}
}

/**
 * Collects what the top level of the analyzed code prints on its own (as {@link DependencyInfo#implicit}
 * outputs), given that it is echoed at all
 * (`project.assumeImplicitEcho`). A statement is only an output if its value is visible: an assignment, a loop,
 * and every {@link CallProp.Invisible} call hand back their result invisibly, while a bare symbol, a constant,
 * or an ordinary call reaches stdout, unless it is one of the `invisible` dependency functions (which hold even for a
 * package that is not loaded). Calls already reported as outputs are not repeated, and a printed plot draws instead
 * (a lone ggplot component is no plot and is printed).
 */
export function collectImplicitEchoes(ast: NormalizedAst, dataflow: DataflowInformation, accountedFor: ReadonlySet<NodeId>, invisible: readonly FunctionInfo[], result: DependencyInfo[]): void {
	for(const file of ast.ast.files) {
		for(const statement of file.root.children) {
			const echoed = echoedValue(statement, dataflow, invisible);
			if(echoed === undefined || accountedFor.has(echoed.info.id) || isPlot(echoed, dataflow)) {
				continue;
			}
			const inputs = inputVariablesAt(dataflow, ast, echoed.info.id);
			result.push({ nodeId: echoed.info.id, functionName: echoName(echoed, dataflow), value: 'stdout', implicit: true, inputVariables: inputs.length > 0 ? inputs : undefined });
		}
	}
}
