import type { SDValue, AbstractOperationsStringDomain } from '../domain';
import { Bottom, Top } from '../domain';

const sprintf = require('sprintf-js').sprintf;

export type Const = {
  kind:  'const',
  value: string,
}

export function isConst(value: SDValue): value is Const {
	return value.kind === 'const';
}

function toConst(value: SDValue): SDValue {
	switch(value.kind) {
		case 'const-set':
			switch(value.value.length) {
				case 1:
					return {
						kind:  'const',
						value: value.value[0],
					};

				default:
					return Top;
			}

		case 'const':
			return value;

		case 'top':
			return Top;

		case 'bottom':
			return Bottom;
	}
}

function konst(value: string): Const {
	return { kind: 'const', value };
}

export class ConstStringDomain implements AbstractOperationsStringDomain {
  const(value: string): SDValue {
  	return konst(value)
  }
    
	concat(_sep: SDValue, ..._args: readonly SDValue[]): SDValue {
		const sep = toConst(_sep);
		const args = _args.map(toConst); 
			
		if (_args.length === 1) {
			return _args[0]
		}

		if(!isConst(sep) || !args.every(isConst)) {
			return Top;
		}

		return konst(
			args.slice(1).reduce((l, r) =>
				l + sep.value + r.value, args[0].value
			)
		);
	}
    
	join(..._args: readonly SDValue[]): SDValue {
		const args = _args.map(toConst); 
			
		if(!args.every(isConst)) {
			return Top;
		}
			
    
		if(args.every(i => i.value === args[0].value)) {
			return konst(args[0].value);
		} else {
			return Top;
		}
	}

	map(value: SDValue, func: (str: string) => string): SDValue {
		const innerValue = toConst(value);
		if (!isConst(innerValue)) return Top;
		return { kind: "const", value: func(innerValue.value) }
	}

  sprintf(fmt: SDValue, ...args: readonly SDValue[]): SDValue {
  	if (!isConst(fmt)) return Top;
  	if (!args.every(isConst)) return Top;

  	return konst(sprintf(fmt.value, args.map(it => it.value)))
  }
}
