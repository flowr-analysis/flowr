import { DefaultNormalizedAstFold } from '../abstract-interpretation/normalized-ast-fold';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';

export enum RDataType {
    Logical = 'LogicalType',
    Numeric = 'NumericType',
    String = 'StringType',
}

export type TypingInfo = RDataType | undefined;

export class TypeInferencer<Info> extends DefaultNormalizedAstFold<TypingInfo, Info> {
	constructor() {
		super(undefined);
	}

	protected override concat(a: TypingInfo, b: TypingInfo): TypingInfo {
		// Do not combine typing information for now
		return b;
	}

	override foldRLogical(_node: RLogical<Info>): TypingInfo {
		return RDataType.Logical;
	}

	override foldRNumber(_node: RNumber<Info>): TypingInfo {
		return RDataType.Numeric;
	}

	override foldRString(_node: RString<Info>): TypingInfo {
		return RDataType.String;
	}
}