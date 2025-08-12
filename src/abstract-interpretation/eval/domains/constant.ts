import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { AbstractStringValue, SDRNode, StringDomain } from '../domain';
import { Top } from '../domain';

export type Const = {
  kind:  'const',
  value: string,
}

export function isConst(value: AbstractStringValue): value is Const {
	return value.kind === 'const';
}

export class ConstStringDomain implements StringDomain {
	assignment(source: SDRNode): AbstractStringValue {
		return source.info.stringdomain?.value ?? Top;
	}

	stringConstant(_: SDRNode, str: RString): AbstractStringValue {
		return {
			kind:  'const',
			value: str.content.str
		};
	}
}
