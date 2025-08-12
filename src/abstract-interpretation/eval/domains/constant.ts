import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { AbstractStringValue, SDRNode, StringDomain } from '../domain';
import { Bottom, Top } from '../domain';

export type Const = {
  kind:  'const',
  value: string,
}

export function isConst(value: AbstractStringValue): value is Const {
	return value.kind === 'const';
}

function toConst(value: AbstractStringValue): AbstractStringValue {
	switch(value.kind) {
		case 'const-set':
			switch(value.value.length) {
				case 1:
					return {
						kind:  'const',
						value: value.value[0],
					};

				case 0:
					return Bottom;

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

export class ConstStringDomain implements StringDomain {
	assignment(source: SDRNode): AbstractStringValue {
		return toConst(source.info.stringdomain?.value ?? Top);
	}

	stringConstant(_: SDRNode, str: RString): AbstractStringValue {
		return {
			kind:  'const',
			value: str.content.str
		};
	}
}
