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
import { DefaultValueFunctionEvaluator } from './values/functions/value-functions';

/**
 * Evaluates the given subtree using its dataflow graph and the current environment.
 *
 * TODO: this expects an expression, currently we do not handle in-expression side-effects
 */
export function evalRExpression(n: RNode<ParentInformation>, dfg: DataflowGraph, env: REnvironmentInformation): Value {
	// TODO: evaluation symbol tracker environment and only access the other environment if we do not know the value
	switch(n.type) {
		case RType.ExpressionList: {
			// TODO:  handle break return etc.
			let result: Value = Top;
			// TODO: '{' for grouping, side-effecs
			for(const child of n.children) {
				result = evalRExpression(child, dfg, env);
			}
			return result;
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
				const values = resolveValueOfVariable(n.content, env, dfg.idMap);
				if(values === undefined || values.length === 0) {
					return Top;
				}
				// TODO: map this to r value
				const allNumber = values.every(v => typeof v === 'number');
				// TODO: sets
				if(allNumber) {
					return intervalFrom(Math.min(...values), Math.max(...values));
				}
				const allString = values.every(v => typeof v === 'string');
				if(allString) {
					// TODO: this handling is not correct
					return stringFrom(values.join(''));
				}
			}
			return Top;
		}
		case RType.BinaryOp:
			return callFn(n.operator, [n.lhs, n.rhs], dfg, env) ?? Top;
		case RType.UnaryOp:
			return callFn(n.operator, [n.operand], dfg, env) ?? Top;
	}
	return Top;
}


function callFn(name: string, args: RNode<ParentInformation>[], dfg: DataflowGraph, env: REnvironmentInformation): Value | undefined {
	return DefaultValueFunctionEvaluator.callFunction(name, args.map(a =>
		/* TODO: lazy? */
		evalRExpression(a, dfg, env)
	));
}