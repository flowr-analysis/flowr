import type { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { AbstractStringValue, SDRNode, StringDomain } from '../domain';
import { Bottom, isBottom, isTop, Top } from '../domain';

export type Const = {
  kind:  'const',
  value: string,
}

export function isConst(value: AbstractStringValue): value is Const {
	return value.kind === 'const';
}

function toConst(value: AbstractStringValue): Top | Bottom | Const {
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

	ifThenElseCall(then: SDRNode, els: SDRNode): AbstractStringValue {
		const t = then.info.stringdomain?.value;
		const e = els.info.stringdomain?.value;

		if(t && !e) {
			return toConst(t);
		}
		if(!t && e) {
			return toConst(e);
		}
		if(!t || !e) {
			return Top;
		}

		const t2 = toConst(t);
		const e2 = toConst(e);

		if(isTop(t2) || isTop(e2)) {
			return Top;
		}
		if(isBottom(t2) || isBottom(e2)) {
			return Bottom;
		}

		return t2.value === e2.value ? {
			kind:  'const',
			value: t2.value
		} : Top;
	}
}
