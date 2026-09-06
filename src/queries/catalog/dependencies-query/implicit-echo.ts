import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { FunctionSemantics } from '../../../dataflow/fn/function-semantics';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../../../dataflow/info';
import type { DependencyInfo } from './dependencies-query-format';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RComment } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { RLineDirective } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-line-directive';
import { DfgVertex } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { queryFnProps } from '../../../dataflow/environments/query-fn-props';
import { ArgProp, CallProp, SemanticCallTag } from '../../../dataflow/environments/built-in-props';
import { ExpectFunctionNames } from './function-info/test-functions';

/** the node whose value R echoes for a statement, `undefined` if the statement yields nothing visible */
function echoedValue(node: RNode<ParentInformation> | undefined, dataflow: DataflowInformation): RNode<ParentInformation> | undefined {
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
			if(callName(node, dataflow) === undefined) {
				return undefined;
			}
			const handedOn = aliased(node, dataflow);
			return handedOn === undefined ? node : echoedValue(handedOn, dataflow);
		}
		/* a block hands on the value of its last statement, a `( )` group that of what it holds, visibly:
		   which is what makes `(x <- 1)` print what it assigned */
		case RType.ExpressionList:
			return grouped(node) ? lastStatement(node) ?? node
				: echoedValue(lastStatement(node), dataflow) ?? (node.children.length === 0 ? node : undefined);
		case RType.Pipe:
			return echoedValue(node.rhs, dataflow);
		/* whichever branch runs decides; without an `else` a false condition yields an invisible NULL */
		case RType.IfThenElse:
			return echoedValue(node.then, dataflow) ?? echoedValue(node.otherwise, dataflow);
		case RType.BinaryOp:
			return RBinaryOp.getOperatorInfo(node)?.usedAs === 'assignment' ? undefined : node;
		/* a symbol, a constant, an access, a unary operator, or a function definition is printed as it stands */
		default:
			return node;
	}
}

/** whether the list is a `( )` group rather than a `{ }` block, which is what makes its value visible */
function grouped(node: RExpressionList<ParentInformation>): boolean {
	return node.grouping?.[0].content === '(';
}

/**
 * The call whose result this one hands back unchanged, as its {@link ArgProp.Alias} argument states: a pipe
 * is visible exactly when the call it feeds is. `undefined` when the call answers for itself.
 */
function aliased(node: RFunctionCall<ParentInformation>, dataflow: DataflowInformation): RFunctionCall<ParentInformation> | undefined {
	const name = callName(node, dataflow);
	const at = name === undefined ? -1 : queryFnProps(name, { environment: dataflow.environment })?.sig
		?.findIndex(([, p]) => (p & ArgProp.Alias) !== 0) ?? -1;
	const arg = at < 0 ? undefined : node.arguments[at];
	const value = typeof arg === 'object' && RArgument.is(arg) ? arg.value : undefined;
	/* only a call of its own can be invisible where the one around it is not, a symbol says nothing new */
	return RFunctionCall.is(value) ? value : undefined;
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

/** the name the call goes by, with its package when it has one */
function qualifiedName(node: RFunctionCall<ParentInformation>, dataflow: DataflowInformation): Identifier | undefined {
	const vertex = dataflow.graph.getVertex(node.info.id);
	return DfgVertex.isFunctionCall(vertex)
		? Dataflow.qualify(node.info.id, dataflow.graph, false) ?? vertex.name : undefined;
}

/** the name of a call that reaches stdout, `undefined` if it returns invisibly, draws, or asserts */
function callName(node: RFunctionCall<ParentInformation>, dataflow: DataflowInformation): Identifier | undefined {
	const name = qualifiedName(node, dataflow);
	if(name === undefined) {
		return undefined;
	}
	const props = queryFnProps(name, { environment: dataflow.environment });
	return FunctionSemantics.call.props.hasAny(props, [CallProp.Invisible, SemanticCallTag.Graphics]) || ExpectFunctionNames.test(Identifier.getName(name))
		? undefined : name;
}

/** what to report the echo under: the called name, or the operator or lexeme producing the value */
function echoName(node: RNode<ParentInformation>, dataflow: DataflowInformation): Identifier {
	switch(node.type) {
		case RType.FunctionCall:
			return qualifiedName(node, dataflow) ?? '';
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
 * or an ordinary call reaches stdout. Calls another category already reports (a plot, a write, an assertion)
 * are left to it.
 */
export function collectImplicitEchoes(ast: NormalizedAst, dataflow: DataflowInformation, accountedFor: ReadonlySet<NodeId>, result: DependencyInfo[]): void {
	for(const file of ast.ast.files) {
		for(const statement of file.root.children) {
			const echoed = echoedValue(statement, dataflow);
			if(echoed === undefined || accountedFor.has(echoed.info.id)) {
				continue;
			}
			result.push({ nodeId: echoed.info.id, functionName: echoName(echoed, dataflow), value: 'stdout', implicit: true });
		}
	}
}
