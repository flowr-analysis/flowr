import type { ValueFunctionDescription } from './value-function';
import { isOfEitherType } from './value-function';
import type { Value, ValueVector } from '../r-value';
import { Top } from '../r-value';
import { vectorFrom } from '../vectors/vector-constants';
import { unionVector } from '../vectors/vector-operations';
import { unaryValue } from '../value-unary';
import { binaryValue } from '../value-binary';
import { ValueIntervalMinusOneToOne } from '../intervals/interval-constants';

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


	public callFunction(name: string, args: readonly Value[]): ValueVector<Value[]> {
		const providers = this.functionProviders.get(name);
		if(providers === undefined) {
			return vectorFrom();
		}
		const activeProviders = providers.filter(p => p.canApply(args));

		// TODO: allow to deeply union these results
		return unionVector(...activeProviders.map(p => vectorFrom(p.apply(args))));
	}
}

export const DefaultValueFunctionEvaluator = new FunctionEvaluator();

const dvfe = DefaultValueFunctionEvaluator;

dvfe.registerFunctions(['id', 'force'], {
	description: 'Simply return a single argument',
	canApply:    args => args.length === 1,
	apply:       args => args[0]
});

dvfe.registerFunction('-', {
	description: '-a',
	canApply:    args => args.length === 1 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type),
	apply:       ([arg]) => {
		return unaryValue(arg, 'negate');
	}
});

// maybe use intersect for clamps
dvfe.registerFunction('abs', {
	description: 'abs(a)',
	canApply:    args => args.length === 1 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type),
	apply:       ([arg]) => {
		return binaryValue(unaryValue(arg, 'abs'), 'intersect', ValueIntervalMinusOneToOne);
	}
});

dvfe.registerFunction('ceil', {
	description: 'ceil(a)',
	canApply:    args => args.length === 1 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type),
	apply:       ([arg]) => {
		return unaryValue(arg, 'ceil');
	}
});

dvfe.registerFunction('floor', {
	description: 'floor(a)',
	canApply:    args => args.length === 1 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type),
	apply:       ([arg]) => {
		return unaryValue(arg, 'floor');
	}
});

dvfe.registerFunction('round', {
	description: 'round(a)',
	canApply:    args => args.length === 1 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type),
	apply:       ([arg]) => {
		return unaryValue(arg, 'round');
	}
});

dvfe.registerFunction('sign', {
	description: 'sign(a)',
	canApply:    args => args.length === 1 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type),
	apply:       ([arg]) => {
		return unaryValue(arg, 'sign');
	}
});

dvfe.registerFunction('add', {
	description: 'a + b',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'add', b);
	}
});

dvfe.registerFunction('sub', {
	description: 'a - b',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'sub', b);
	}
});

dvfe.registerFunction('mul', {
	description: 'a * b',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'mul', b);
	}
});

dvfe.registerFunction('div', {
	description: 'a / b',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'div', b);
	}
});

dvfe.registerFunction('pow', {
	description: 'a ^ b',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'pow', b);
	}
});

dvfe.registerFunction('mod', {
	description: 'a % b',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'mod', b);
	}
});

dvfe.registerFunction('max', {
	description: 'max(a, b)',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'max', b);
	}
});

dvfe.registerFunction('min', {
	description: 'min(a, b)',
	canApply:    args => args.length === 2 && isOfEitherType(args[0], 'number', 'interval', 'vector', Top.type) && isOfEitherType(args[1], 'number', 'interval', 'vector', Top.type),
	apply:       ([a, b]) => {
		return binaryValue(a, 'min', b);
	}
});



