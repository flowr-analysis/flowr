import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RString } from '../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { Const } from './domains/constant';
import type { StringDomainInfo } from './visitor';

export type Top = { kind: 'top' }
export const Top: Top = { kind: 'top' };

export type Bottom = { kind: 'bottom' }
export const Bottom: Bottom = { kind: 'bottom' };

export function isTop(value: AbstractStringValue): value is Top {
	return value.kind === 'top';
}

export function isBottom(value: AbstractStringValue): value is Bottom {
	return value.kind === 'bottom';
}

export type AbstractStringValue = Top | Bottom | Const

export type SDRNode = RNode<NoInfo & StringDomainInfo & ParentInformation>
export interface StringDomain {
  assignment:     (source: SDRNode) => AbstractStringValue
  stringConstant: (node: SDRNode, str: RString) => AbstractStringValue
}
