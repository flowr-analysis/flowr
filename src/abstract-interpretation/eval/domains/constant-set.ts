import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { AbstractStringValue, SDRNode, StringDomain } from '../domain';
import { Bottom, Top } from '../domain';

export type ConstSet = {
  kind:  'const-set',
  value: string[],
}

export function isConstSet(value: AbstractStringValue): value is ConstSet {
	return value.kind === 'const-set';
}

function toConstSet(value: AbstractStringValue): AbstractStringValue {
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

export class ConstSetStringDomain implements StringDomain {
	assignment(source: SDRNode): AbstractStringValue {
		return toConstSet(source.info.stringdomain?.value ?? Top);
	}

	stringConstant(_: SDRNode, str: RString): AbstractStringValue {
		return {
			kind:  'const-set',
			value: [str.content.str]
		};
	}
}
