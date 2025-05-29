import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { DataflowGraph } from '../graph/graph';
import type { REnvironmentInformation } from '../environments/environment';
import type { Value } from './values/r-value';
import { Top } from './values/r-value';
import { intervalFrom } from './values/intervals/interval-constants';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { stringFrom } from './values/string/string-constants';
import { liftLogical } from './values/logical/logical-constants';
import { VertexType } from '../graph/vertex';
import { resolveValueOfVariable } from '../environments/resolve-by-name';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { DefaultValueFunctionEvaluator } from './values/functions/functions-value';
import { log } from '../../util/log';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { Missing } from './values/missing/missing-constants';
import { valuesFromTsValuesAsSet } from './values/general';
import { ValueVectorTop } from './values/vectors/vector-constants';

export const ValueEvalLog = log.getSubLogger({
	name: 'value-eval'
});

/**
 * Evaluates the given subtree using its dataflow graph and the current environment.
 *
 * TODO: this expects an expression, currently we do not handle in-expression side-effects
 * TODO: a function with unknown side effects should make everything top
 */
export function evalRExpression(n: RNode<ParentInformation> | typeof EmptyArgument | undefined, dfg: DataflowGraph, env: REnvironmentInformation): Value {
	if(n === undefined || n === EmptyArgument) {
		return Missing;
	}
	ValueEvalLog.silly('Eval' + n.type + ' (' + n.lexeme + ')');
	// TODO: evaluation symbol tracker environment and only access the other environment if we do not know the value
	switch(n.type) {
		case RType.ExpressionList:
			if(n.grouping) {
				return callFn(n.grouping[0].lexeme, n.children, dfg, env) ?? Top;
			} else {
				return callFn('{', n.children, dfg, env) ?? Top;
			}
		case RType.Number:
			return intervalFrom(n.content, n.content);
		case RType.String:
			return stringFrom(n.content);
		case RType.Logical:
			return liftLogical(n.content);
		case RType.Symbol: {
			const t = dfg.getVertex(n.info.id);
			if(t?.tag === VertexType.Use) {
				return valuesFromTsValuesAsSet(resolveValueOfVariable(n.content, env, dfg.idMap));
			}
			return ValueVectorTop;
		}
		case RType.BinaryOp:
			return callFn(n.operator, [n.lhs, n.rhs], dfg, env) ?? Top;
		case RType.UnaryOp:
			return callFn(n.operator, [n.operand], dfg, env) ?? Top;
		case RType.FunctionCall:
			// TODO: ap function arguments accordingly
			if(n.named) {
				return callFn(n.functionName.lexeme, n.arguments, dfg, env) ?? Top;
			} else {
				ValueEvalLog.silly('Anonymous function call');
				return Top;
			}
		case RType.Argument:
			return evalRExpression(n.value, dfg, env);
	}
	ValueEvalLog.silly('No handler for ' + n.type);
	return Top;
}


function callFn(name: string, args: readonly (RNode<ParentInformation> | typeof EmptyArgument)[], dfg: DataflowGraph, env: REnvironmentInformation): Value | undefined {
	// TODO: check if not overriden etc.
	return DefaultValueFunctionEvaluator.callFunction(name, args.map(a =>
		/* TODO: lazy? */
		[a === EmptyArgument ? undefined : a.name as string | undefined, evalRExpression(a, dfg, env)]
	));
}