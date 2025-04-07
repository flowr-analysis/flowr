import { DefaultNormalizedAstFold } from '../abstract-interpretation/normalized-ast-fold';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';

export enum RDataType {
    Logical = 'LogicalType',
    Numeric = 'NumericType',
	Complex = 'ComplexType',
    String  = 'StringType',
	Null    = 'NullType',
}

export type TypingInfo = RDataType
					   | undefined; // Represents missing type information

export class TypeInferencer<Info> extends DefaultNormalizedAstFold<TypingInfo, Info> {
	constructor() {
		super(undefined);
	}

	protected override concat(_a: TypingInfo, _b: TypingInfo): TypingInfo {
		// Do not combine typing information for now
		return undefined;
	}

	override foldRLogical(_node: RLogical<Info>): TypingInfo {
		return RDataType.Logical;
	}

	override foldRNumber(node: RNumber<Info>): TypingInfo {
		if(node.content.complexNumber) {
			return RDataType.Complex;
		}
		return RDataType.Numeric;
	}

	override foldRString(_node: RString<Info>): TypingInfo {
		return RDataType.String;
	}

	override foldRExpressionList(exprList: RExpressionList<Info>): TypingInfo {
		if(exprList.children.length === 0) {
			return RDataType.Null;
		} else {
			// Do not handle early returns for now
			return this.fold(exprList.children[exprList.children.length - 1]);
		}
	}
}