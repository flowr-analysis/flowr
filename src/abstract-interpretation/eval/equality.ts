import type { SDValue } from './domain';
import type { Const } from './domains/constant';
import type { ConstSet } from './domains/constant-set';

function arrayEquals<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;

  while (left.length > 0) {
    const value = left.pop()!;
    const index = right.findIndex(it => it === value);
    if (index === -1) return false;
    else right.splice(index, 1)
  }

  return true;
}

export function sdEqual(a: SDValue | undefined, b: SDValue | undefined): boolean {
	if(a === undefined && b === undefined) {
		return true;
	} else if(a !== undefined && b !== undefined) {
		if(a.kind !== b.kind) {
			return false;
		} else {
			switch(a.kind) {
				case 'top':
					return true;
					
				case 'bottom':
					return true;
					
				case 'const':
					return a.value === (b as Const).value;
					
				case 'const-set': {
					return arrayEquals([...a.value], [...(b as ConstSet).value]);
				}
			}
		}
	} else {
		return false;
	}
}
