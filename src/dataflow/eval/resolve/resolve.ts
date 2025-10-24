import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNumberValue } from '../../../r-bridge/lang-4.x/convert-values';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import { builtInId, isBuiltIn } from '../../environments/built-in';
import type { REnvironmentInformation } from '../../environments/environment';
import type { DataflowGraph } from '../../graph/graph';
import { getOriginInDfg, OriginType } from '../../origin/dfg-get-origin';
import { intervalFrom } from '../values/intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import type { Lift, Value, ValueInterval, ValueNumber, ValueVector } from '../values/r-value';
import { Top } from '../values/r-value';
import { stringFrom } from '../values/string/string-constants';
import { flattenVectorElements, vectorFrom } from '../values/vectors/vector-constants';
import type { ResolveInfo } from './alias-tracking';
import { resolveIdToValue } from './alias-tracking';
import type { VariableResolve } from '../../../config';
import { liftScalar } from '../values/scalar/scalar-consatnts';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';


/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function converts an RNode to its Value, but also recursively resolves
 * aliases and vectors (in case of a vector).
 *
 * @param a       - Ast node to resolve
 * @param resolve - Variable resolve mode
 * @param env     - Environment to use
 * @param graph   - Dataflow Graph to use
 * @param map     - Idmap of Dataflow Graph
 * @returns resolved value or top/bottom
 */
export function resolveNode(resolve: VariableResolve, a: RNodeWithParent, env?: REnvironmentInformation, graph?: DataflowGraph, map?: AstIdMap): Value {
	return OnlineValueResolver.resolve({ resolve, operator: a, environment: env, graph, idMap: map });
}

interface FunctionResolve {
	resolve:      VariableResolve,
	operator:     RNodeWithParent,
	environment?: REnvironmentInformation,
	graph?:       DataflowGraph,
	idMap?:       AstIdMap
}

export type BuiltInEvalHandler = (r: FunctionResolve) => Value;


export class OnlineValueResolver {
	private initialResolve: FunctionResolve;
	private alreadyQueried: Set<NodeId> = new Set<NodeId>();

	private BuiltInEvalHandlerMapper = {
		'built-in:c': (r: FunctionResolve) => this.resolveAsVector(r),
		'built-in::': (r: FunctionResolve) => this.resolveAsSeq(r),
		'built-in:+': (r: FunctionResolve) => this.resolveAsPlus(r),
		'built-in:-': (r: FunctionResolve) => this.resolveAsMinus(r)
	} as Record<string, BuiltInEvalHandler>;

	private constructor(
		resolve: FunctionResolve
	) {
		this.initialResolve = resolve;
	}

	public static resolve(res: FunctionResolve): Value {
		return new OnlineValueResolver(res).run();
	}

	private resolveIdToValue(n: NodeId | RNodeWithParent | undefined, res: ResolveInfo): Value {
		if(n === undefined) {
			return Top;
		}
		const id = typeof n === 'object' ? n.info.id : n;
		if(this.alreadyQueried.has(id)) {
			return Top;
		}
		this.alreadyQueried.add(id);
		return resolveIdToValue(n, res);
	}

	private run(): Value {
		const { operator, graph } = this.initialResolve;
		if(operator.type === RType.String) {
			return stringFrom(operator.content.str);
		} else if(operator.type === RType.Number) {
			return intervalFrom(operator.content.num, operator.content.num);
		} else if(operator.type === RType.Logical) {
			return operator.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
		} else if(operator.type === RType.FunctionDefinition) {
			return { type: 'function-definition' };
		} else if((operator.type === RType.FunctionCall || operator.type === RType.BinaryOp || operator.type === RType.UnaryOp) && graph) {
			const origin = getOriginInDfg(graph, operator.info.id)?.[0];
			if(origin === undefined || origin.type !== OriginType.BuiltInFunctionOrigin) {
				return Top;
			}
			let builtInName;

			if(isBuiltIn(origin.proc)) {
				builtInName = origin.proc;
			} else if(operator.type === RType.FunctionCall && operator.named) {
				builtInName = builtInId(operator.functionName.content);
			} else if(operator.type === RType.BinaryOp || operator.type === RType.UnaryOp) {
				builtInName = builtInId(operator.operator);
			} else {
				return Top;
			}
			if(Object.hasOwn(this.BuiltInEvalHandlerMapper, builtInName)) {
				const handler = this.BuiltInEvalHandlerMapper[builtInName as keyof typeof this.BuiltInEvalHandlerMapper];
				return handler(this.initialResolve);
			}
		}
		return Top;
	}

	/** Generic resolver for binary functions */
	private resolveBinaryFunction<R>({ resolve, operator, environment, graph, idMap }: FunctionResolve, red: (l: Value, r: Value) => R): R | typeof Top {
		return this.resolveUnaryOrBinaryFunction({ resolve, operator, environment, graph, idMap },
			() => Top,
			(l, r) => red(l, r)
		);
	}

	/** Generic resolver for unary or binary functions */
	private resolveUnaryOrBinaryFunction<R>({ resolve, operator, environment, graph, idMap }: FunctionResolve, redUnary: (arg: Value) => R | typeof Top, redBinary: (l: Value, r: Value) => R | typeof Top): R | typeof Top {
		let arg: NodeId | RNodeWithParent | undefined;
		let otherArg: NodeId | RNodeWithParent | undefined;
		if(graph) {
			const vertex = graph.getVertex(operator.info.id);
			if(vertex !== undefined && vertex.tag === 'function-call') {
				const args = vertex.args;
				if(args.length === 1 && args[0] !== EmptyArgument) {
					arg = args[0].nodeId;
				} else if(args.length === 2 && args[0] !== EmptyArgument && args[1] !== EmptyArgument) {
					arg = args[0].nodeId;
					otherArg = args[1].nodeId;
				}
			}
		}
		if(arg === undefined) {
			if(operator.type === RType.UnaryOp) {
				arg = operator.operand;
			} else if(operator.type === RType.BinaryOp || operator.type === RType.Pipe) {
				arg = operator.lhs;
				otherArg = operator.rhs;
			} else if(operator.type === RType.FunctionCall) {
				arg = operator.arguments[0] !== EmptyArgument ? operator.arguments[0].value : undefined;
				otherArg = operator.arguments[1] !== EmptyArgument ? operator.arguments[1].value : undefined;
			}
		}
		if(arg === undefined) {
			return Top;
		}
		const resolveInfo = { environment, graph, idMap, full: true, resolve };
		const argValue = this.resolveIdToValue(arg, resolveInfo);
		if(otherArg === undefined) {
			return redUnary(argValue);
		}
		const otherArgValue = this.resolveIdToValue(otherArg, resolveInfo);
		return redBinary(argValue, otherArgValue);
	}

	/** Generic resolver for unary functions */
	private resolveUnaryFunction<R>({ resolve, operator, environment, graph, idMap }: FunctionResolve, red: (arg: Value) => R): R | typeof Top {
		return this.resolveUnaryOrBinaryFunction({ resolve, operator, environment, graph, idMap },
			(arg) => red(arg),
			() => Top
		);
	}

	/**
	 * This function resolves a vector function call `c` to a {@link ValueVector}
	 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
	 */
	private resolveAsVector({ operator, resolve, environment, graph, idMap }: FunctionResolve): ValueVector<Lift<Value[]>> | typeof Top {
		if(operator.type !== RType.FunctionCall) {
			return Top;
		}
		const resolveInfo = { environment, graph, idMap, full: true, resolve };
		const values = operator.arguments.map(arg => arg !== EmptyArgument ? this.resolveIdToValue(arg.value, resolveInfo) : Top);

		return vectorFrom(flattenVectorElements(values));
	}

	/**
	 * This function resolves a binary sequence operator `:` to a {@link ValueVector} of {@link ValueInterval}s
	 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
	 */
	private resolveAsSeq(res: FunctionResolve): ValueVector<Lift<ValueInterval[]>> | typeof Top {
		return this.resolveBinaryFunction(res, (l, r) => {
			const lVal = unliftRValue(l);
			const rVal = unliftRValue(r);
			if(isRNumberValue(lVal) && isRNumberValue(rVal)) {
				return vectorFrom(createNumberSequence(lVal, rVal).map(v => intervalFrom(v)));
			}
			return Top;
		});
	}


	/**
	 * This function resolves a unary plus operator `+` to a {@link ValueNumber} or {@link ValueVector} of ValueNumbers
	 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
	 */
	private resolveAsPlus(res: FunctionResolve): ValueInterval | ValueVector<Lift<ValueInterval[]>> | typeof Top {
		return this.resolveUnaryOrBinaryFunction(res,
			(arg) => {
				const argValue = unliftRValue(arg);

				if(isRNumberValue(argValue)) {
					return intervalFrom(argValue);
				} else if(Array.isArray(argValue) && argValue.every(isRNumberValue)) {
					return vectorFrom(argValue.map(v => intervalFrom(v)));
				}
				return Top;
			},
			(l, r) => {
				const lVal = unliftRValue(l);
				const rVal = unliftRValue(r);

				if(isRNumberValue(lVal) && isRNumberValue(rVal)) {
					return intervalFrom({ ...lVal, num: lVal.num + rVal.num });
				} else if(Array.isArray(lVal) && lVal.every(isRNumberValue) && isRNumberValue(rVal)) {
					return vectorFrom(lVal.map(v => ({ ...v, num: v.num + rVal.num })).map(v => intervalFrom(v)));
				} else if(isRNumberValue(lVal) && Array.isArray(rVal) && rVal.every(isRNumberValue)) {
					return vectorFrom(rVal.map(v => ({ ...v, num: lVal.num + v.num })).map(v => intervalFrom(v)));
				} else if(Array.isArray(lVal) && lVal.every(isRNumberValue) && Array.isArray(rVal) && rVal.every(isRNumberValue) && lVal.length === rVal.length) {
					return vectorFrom(lVal.map((v, i) => ({ ...v, num: v.num + rVal[i].num })).map(v => intervalFrom(v)));
				}
				return Top;
			}
		);
	}

	/**
	 * This function resolves a unary minus operator `-` to a {@link ValueNumber} or {@link ValueVector} of ValueNumbers
	 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
	 */
	private resolveAsMinus(res: FunctionResolve): ValueNumber | ValueVector<Lift<ValueNumber[]>> | typeof Top {
		return this.resolveUnaryOrBinaryFunction(res,
			(arg) => {
				const argValue = unliftRValue(arg);

				if(isRNumberValue(argValue)) {
					return liftScalar({ ...argValue, num: -argValue.num });
				} else if(Array.isArray(argValue) && argValue.every(isRNumberValue)) {
					return vectorFrom(argValue.map(v => ({ ...v, num: -v.num })).map(liftScalar));
				}
				return Top;
			},
			(l, r) => {
				const lVal = unliftRValue(l);
				const rVal = unliftRValue(r);

				if(isRNumberValue(lVal) && isRNumberValue(rVal)) {
					return liftScalar({ ...lVal, num: lVal.num - rVal.num });
				} else if(Array.isArray(lVal) && lVal.every(isRNumberValue) && isRNumberValue(rVal)) {
					return vectorFrom(lVal.map(v => ({ ...v, num: v.num - rVal.num })).map(liftScalar));
				} else if(isRNumberValue(lVal) && Array.isArray(rVal) && rVal.every(isRNumberValue)) {
					return vectorFrom(rVal.map(v => ({ ...v, num: lVal.num - v.num })).map(liftScalar));
				} else if(Array.isArray(lVal) && lVal.every(isRNumberValue) && Array.isArray(rVal) && rVal.every(isRNumberValue) && lVal.length === rVal.length) {
					return vectorFrom(lVal.map((v, i) => ({ ...v, num: v.num - rVal[i].num })).map(liftScalar));
				}
				return Top;
			}
		);
	}
}

function createNumberSequence(start: RNumberValue, end: RNumberValue): RNumberValue[] {
	const sequence: RNumberValue[] = [];
	const min = Math.min(start.num, end.num);
	const max = Math.max(start.num, end.num);

	for(let i = min; i <= max; i++) {
		sequence.push({ ...start, num: i });
	}

	if(start > end) {
		sequence.reverse();
	}
	return sequence;
}
