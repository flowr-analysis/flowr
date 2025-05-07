import type { ValueArgument, ValueFunctionDescription } from './value-function';
import { getArgument , stringifyValueArgument , isOfEitherType } from './value-function';
import type { Value, ValueSet } from '../r-value';
import { isBottom, isTop , stringifyValue , Top } from '../r-value';
import { unaryValue } from '../value-unary';
import { binaryValue } from '../value-binary';
import { ValueIntervalMinusOneToOne, ValueIntervalZeroToPositiveInfinity } from '../intervals/interval-constants';
import { expensiveTrace, LogLevel } from '../../../../util/log';
import { ValueEvalLog } from '../../eval';
import { setFrom, ValueSetTop } from '../sets/set-constants';
import { flattenVector, ValueVectorTop, vectorFrom } from '../vectors/vector-constants';
import { ValueIntegerOne, ValueIntegerZero } from '../scalar/scalar-constants';
import { stringFrom, ValueStringBot, ValueStringTop } from '../string/string-constants';

class FunctionEvaluator {
	private functionProviders: Map<string, ValueFunctionDescription[]> = new Map();

	/**
     * Register an evaluator with the given description.
     */
	public registerFunction(name: string, description: ValueFunctionDescription): void {
		if(!this.functionProviders.has(name)) {
			this.functionProviders.set(name, []);
		}
		(this.functionProviders.get(name) as ValueFunctionDescription[]).push(description);
	}

	public registerFunctions(names: readonly string[], descriptions: ValueFunctionDescription): void {
		names.forEach(name => this.registerFunction(name, descriptions));
	}


	public callFunction(name: string, args: readonly ValueArgument[]): ValueSet {
		expensiveTrace(ValueEvalLog, () => ` * callFunction(${name}, ${args.map(a => stringifyValueArgument(a)).join(', ')})`);
		const providers = this.functionProviders.get(name);
		if(providers === undefined) {
			ValueEvalLog.trace(`No function providers for ${name}`);
			return ValueSetTop;
		}
		const activeProviders = providers.filter(p => p.canApply(args, name));

		if(ValueEvalLog.settings.minLevel <= LogLevel.Trace) {
			ValueEvalLog.trace(`* Active providers for ${name}: ${activeProviders.length}`);
			activeProviders.forEach(p => ValueEvalLog.trace(`    - ${p.description}`));
		}

		const results = setFrom(...activeProviders.map(p => setFrom(p.apply(args, name))));
		expensiveTrace(ValueEvalLog, () => ` => callFunction(${name}, ${args.map(a => stringifyValueArgument(a)).join(', ')}) = ${stringifyValue(results)}`);
		return results;
	}
}

export const DefaultValueFunctionEvaluator = new FunctionEvaluator();

const dvfe = DefaultValueFunctionEvaluator;

function isNumericType(v: Value): boolean {
	return isOfEitherType(v, 'number', 'interval', 'vector', 'set', Top.type);
}

function isStringType(v: Value): boolean {
	return isOfEitherType(v, 'string', 'set', Top.type);
}

dvfe.registerFunctions(['id', 'force'], {
	description: 'Simply return a single argument',
	canApply:    args => args.length === 1,
	apply:       args => args[0][1]
});

dvfe.registerFunction('-', {
	description: '-a',
	canApply:    args => args.length === 1 && isNumericType(args[0][1]),
	apply:       ([arg]) => {
		return unaryValue(arg[1], 'negate');
	}
});

// maybe use intersect for clamps
dvfe.registerFunction('abs', {
	description: 'abs(a)',
	canApply:    args => args.length === 1 && isNumericType(getArgument(args, { position: 0, name: 'x' })),
	apply:       args => {
		return binaryValue(unaryValue(getArgument(args, { position: 0, name: 'x' }), 'abs'), 'intersect', ValueIntervalZeroToPositiveInfinity);
	}
});

dvfe.registerFunction('ceiling', {
	description: 'ceiling(a)',
	canApply:    args => args.length === 1 && isNumericType(getArgument(args, { position: 0, name: 'x' })),
	apply:       (args) => {
		return unaryValue(getArgument(args, { position: 0, name: 'x' }), 'ceil');
	}
});

dvfe.registerFunction('floor', {
	description: 'floor(a)',
	canApply:    args => args.length === 1 && isNumericType(getArgument(args, { position: 0, name: 'x' })),
	apply:       (args) => {
		return unaryValue(getArgument(args, { position: 0, name: 'x' }), 'floor');
	}
});

// TODO: support digits
dvfe.registerFunction('round', {
	description: 'round(a)',
	canApply:    args => args.length === 1 && isNumericType(getArgument(args, { position: 0, name: 'x' })),
	apply:       (args) => {
		return unaryValue(getArgument(args, { position: 0, name: 'x' }), 'round');
	}
});

dvfe.registerFunction('sign', {
	description: 'sign(a)',
	canApply:    args => args.length === 1 && isNumericType(getArgument(args, { position: 0, name: 'x' })),
	apply:       (args) => {
		return binaryValue(unaryValue(getArgument(args, { position: 0, name: 'x' }), 'sign'), 'intersect', ValueIntervalMinusOneToOne);
	}
});

dvfe.registerFunction('add', {
	description: 'a + b',
	canApply:    args => args.length === 2 && isNumericType(args[0][1]) && isNumericType(args[1][1]),
	apply:       ([a, b]) => {
		return binaryValue(a[1], 'add', b[1]);
	}
});

dvfe.registerFunction('sub', {
	description: 'a - b',
	canApply:    args => args.length === 2 && isNumericType(args[0][1]) && isNumericType(args[1][1]),
	apply:       ([a, b]) => {
		return binaryValue(a[1], 'sub', b[1]);
	}
});

dvfe.registerFunction('mul', {
	description: 'a * b',
	canApply:    args => args.length === 2 && isNumericType(args[0][1]) && isNumericType(args[1][1]),
	apply:       ([a, b]) => {
		return binaryValue(a[1], 'mul', b[1]);
	}
});

dvfe.registerFunction('div', {
	description: 'a / b',
	canApply:    args => args.length === 2 && isNumericType(args[0][1]) && isNumericType(args[1][1]),
	apply:       ([a, b]) => {
		return binaryValue(a[1], 'div', b[1]);
	}
});

dvfe.registerFunction('pow', {
	description: 'a ^ b',
	canApply:    args => args.length === 2 && isNumericType(args[0][1]) && isNumericType(args[1][1]),
	apply:       ([a, b]) => {
		return binaryValue(a[1], 'pow', b[1]);
	}
});

dvfe.registerFunction('mod', {
	description: 'a % b',
	canApply:    args => args.length === 2 && isNumericType(args[0][1]) && isNumericType(args[1][1]),
	apply:       ([a, b]) => {
		return binaryValue(a[1], 'mod', b[1]);
	}
});

dvfe.registerFunction('max', {
	description: 'max(a, b)',
	canApply:    args => args.every(a => isNumericType(a[1])),
	apply:       args => {
		let result = args[0][1];
		for(let i = 1; i < args.length; i++) {
			result = binaryValue(result, 'max', args[i][1]);
		}
		return result;
	}
});

dvfe.registerFunction('min', {
	description: 'min(a, b)',
	canApply:    args => args.every(a => isNumericType(a[1])),
	apply:       args => {
		let result = args[0][1];
		for(let i = 1; i < args.length; i++) {
			result = binaryValue(result, 'min', args[i][1]);
		}
		return result;
	}
});

for(const [op, opname] of [
	['+', 'add'], ['-', 'sub'], ['*', 'mul'], ['/', 'div'], ['^', 'pow'], ['%%', 'mod'], ['max', 'max'], ['min', 'min'],
	['<=', '<='], ['<', '<'], ['>=', '>='], ['>', '>'], ['==', '=='], ['!=', '!=']
]) {
	dvfe.registerFunction(op, {
		description: `a ${op} b`,
		canApply:    args => args.length === 2 && args.every(a => isNumericType(a[1])),
		apply:       ([larg, rarg]) => {
			return binaryValue(larg[1], opname, rarg[1]);
		}
	});
}


dvfe.registerFunction('{', {
	description: 'R grouping, {a, b, c, ...}',
	canApply:    () => true,
	apply:       args => {
		if(args.length === 0) {
			return Top;
		}
		return args[args.length - 1][1];
	}
});

dvfe.registerFunction('c', {
	description: 'c vector construction',
	canApply:    () => true,
	apply:       args => {
		return flattenVector(...args.map(a => a[1]));
	}
});

// TODO: vectorize, TODO: argument
dvfe.registerFunctions(['paste', 'paste0'], {
	description: 'paste strings',
	// TODO: support vectorization
	canApply:    args => args.every(a => isStringType(a[1])),
	apply:       (args, name) => {
		const result = [];
		for(const arg of args) {
			if(isTop(arg[1])) {
				return ValueStringTop;
			} else if(isBottom(arg[1])) {
				return ValueStringBot;
			} else if(arg[1].type !== 'string') {
				// TODO handle set
				return ValueStringTop;
			} else if(isTop(arg[1].value)) {
				return ValueStringTop;
			} else if(isBottom(arg[1].value)) {
				return ValueStringBot;
			}
			result.push(arg[1].value.str);
		}
		return stringFrom(result.join(name === 'paste0' ? '' : ' '));
	}
});

dvfe.registerFunction('runif', {
	description: 'R grouping, {a, b, c, ...}',
	canApply:    args => args.length > 0 && args.length <= 3 && args.every(a => isNumericType(a[1])),
	apply:       args => {
		if(args.length === 0) {
			return ValueVectorTop;
		}
		const min = args.length > 1 ? getArgument(args, { position: 1, name: 'min' }) : ValueIntegerZero;
		const max = args.length > 2 ? getArgument(args, { position: 2, name: 'max' }) : ValueIntegerOne;

		const range = binaryValue(max, 'union', min);

		// TODO: support n
		return vectorFrom({
			elements: Top,
			domain:   range
		});
	}
});