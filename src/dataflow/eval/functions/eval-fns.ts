import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../../graph/graph';
import type { REnvironmentInformation } from '../../environments/environment';
import type { Value } from '../values/r-value';
import { Top } from '../values/r-value';
import { binaryValues } from '../values/value-binary';
import { evalRExpression } from '../eval';
import { unaryValues } from '../values/value-unary';

const KnownBinaryFunctions = new Map<string,
    (node: RNode<ParentInformation>, args: readonly RNode<ParentInformation>[], dfg: DataflowGraph, env: REnvironmentInformation) => Value
>();

const KnownUnaryFunctions = new Map<string,
    (node: RNode<ParentInformation>, args: readonly RNode<ParentInformation>[], dfg: DataflowGraph, env: REnvironmentInformation) => Value
>();

export function callEvalFunction(name: string, node: RNode<ParentInformation>, args: readonly RNode<ParentInformation>[], dfg: DataflowGraph, env: REnvironmentInformation): Value {
	if(args.length === 1) {
		return KnownUnaryFunctions.get(name)?.(node, args, dfg, env) ?? Top;
	} else if(args.length === 2) {
		return KnownBinaryFunctions.get(name)?.(node, args, dfg, env) ?? Top;
	}
	return Top;
}


function registerBinaryEvalFunction(name: string, fn: (a: Value, b: Value) => Value) {
	KnownBinaryFunctions.set(name, (node, args, dfg, env) => {
		if(args.length !== 2) {
			return Top;
		}
		return fn(evalRExpression(args[0], dfg, env), evalRExpression(args[1], dfg, env));
	});
}

function registerUnaryEvalFunction(name: string, fn: (a: Value) => Value) {
	KnownUnaryFunctions.set(name, (node, args, dfg, env) => {
		if(args.length !== 1) {
			return Top;
		}
		return fn(evalRExpression(args[0], dfg, env));
	});
}

registerBinaryEvalFunction('+', (a, b) => binaryValues(a, 'add', b));
registerBinaryEvalFunction('-', (a, b) => binaryValues(a, 'sub', b));
registerBinaryEvalFunction('*', (a, b) => binaryValues(a, 'mul', b));
registerBinaryEvalFunction('/', (a, b) => binaryValues(a, 'div', b));
registerBinaryEvalFunction('^', (a, b) => binaryValues(a, 'pow', b));
registerBinaryEvalFunction('%%', (a, b) => binaryValues(a, 'mod', b));
registerBinaryEvalFunction('max', (a, b) => binaryValues(a, 'max', b));
registerBinaryEvalFunction('min', (a, b) => binaryValues(a, 'min', b));
registerBinaryEvalFunction('==', (a, b) => binaryValues(a, '==', b));
registerBinaryEvalFunction('!=', (a, b) => binaryValues(a, '!=', b));
registerBinaryEvalFunction('>', (a, b) => binaryValues(a, '>', b));
registerBinaryEvalFunction('>=', (a, b) => binaryValues(a, '>=', b));
registerBinaryEvalFunction('<', (a, b) => binaryValues(a, '<', b));
registerBinaryEvalFunction('<=', (a, b) => binaryValues(a, '<=', b));
registerUnaryEvalFunction('-', a => unaryValues(a, 'negate'));
registerUnaryEvalFunction('!', a => unaryValues(a, 'not'));
registerUnaryEvalFunction('sin', a => unaryValues(a, 'sin'));
registerUnaryEvalFunction('cos', a => unaryValues(a, 'cos'));
registerUnaryEvalFunction('tan', a => unaryValues(a, 'tan'));
registerUnaryEvalFunction('asin', a => unaryValues(a, 'asin'));
registerUnaryEvalFunction('sign', a => unaryValues(a, 'sign'));
registerUnaryEvalFunction('abs', a => unaryValues(a, 'abs'));
