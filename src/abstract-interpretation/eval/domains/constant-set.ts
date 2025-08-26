import type { SDValue, StringDomain } from '../domain';
import { Bottom, Top } from '../domain';

export type ConstSet = {
  kind:  'const-set',
  value: string[],
}

export function isConstSet(value: SDValue): value is ConstSet {
	return value.kind === 'const-set';
}

function toConstSet(value: SDValue): SDValue {
	switch(value.kind) {
		case 'const-set':
			return value;

		case 'const':
			return {
				kind:  'const-set',
				value: [ value.value ]
			};

		case 'top':
			return Top;

		case 'bottom':
			return Bottom;
	}
}

function constSet(...value: string[]): ConstSet {
	return {
		kind: 'const-set',
		value
	};
}

export class ConstSetStringDomain implements StringDomain {
	MAX_VARIANTS = 1_000
	
	const(value: string): SDValue {
		return constSet(value);
	}

	concat(_sep: SDValue, ..._args: readonly SDValue[]): SDValue {
		const sep = toConstSet(_sep);
		const args = _args.map(toConstSet);

		if (_args.length === 1) {
			return _args[0];
		}

		// value was not converted or was top, bottom is currently ignored
		if(!isConstSet(sep) || !args.every(isConstSet)) {
			return Top;
		}
    
		const variants = sep.value.length * args
			.map(it => it.value.length)
			.reduce((l, r) => l * r);

		if(variants > this.MAX_VARIANTS) {
			return Top;
		}

		const value = args.slice(1).reduce(
			(l, r) => l
				.flatMap(l => sep.value.map(s => l + s))
				.flatMap(l => r.value.map(r => l + r)),
			args[0].value
		);

		return constSet(...value);
	}
  
	join(..._args: readonly SDValue[]): SDValue {
		const args = _args.map(toConstSet);

		// value was not converted or was top, bottom is currently ignored
		if(!args.every(isConstSet)) {
			return Top;
		}

		const variants = args.reduce((acc, val) => acc + val.value.length, 0);

		// includes duplicates
		if(variants > this.MAX_VARIANTS) {
			return Top;
		}

		// deduplicated
		const value = [...new Set(
			args.flatMap(it => it.value)
		)];
    
		return constSet(...value);
	}
}
