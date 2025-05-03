import { DefaultNormalizedAstFold } from '../abstract-interpretation/normalized-ast-fold';
import type { RExpressionList } from '../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import type { RLogical } from '../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import type { RString } from '../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { type RDataType, RDataTypeTag } from './types';

export class TypeInferencer<Info> extends DefaultNormalizedAstFold<RDataType, Info> {
	constructor() {
		super({ tag: RDataTypeTag.Any });
	}

	protected override concat(_a: RDataType, _b: RDataType): RDataType {
		// Do not combine typing information for now
		return { tag: RDataTypeTag.Any };
	}

	override foldRLogical(_node: RLogical<Info>): RDataType {
		return { tag: RDataTypeTag.Logical };
	}

	override foldRNumber(node: RNumber<Info>): RDataType {
		if(node.content.complexNumber) {
			return { tag: RDataTypeTag.Complex };
		}
		if(Number.isInteger(node.content.num)) {
			return { tag: RDataTypeTag.Integer };
		}
		return { tag: RDataTypeTag.Double };
	}

	override foldRString(_node: RString<Info>): RDataType {
		return { tag: RDataTypeTag.String };
	}

	override foldRExpressionList(exprList: RExpressionList<Info>): RDataType {
		if(exprList.children.length === 0) {
			return { tag: RDataTypeTag.Null };
		} else {
			// Do not handle early returns for now
			return this.fold(exprList.children[exprList.children.length - 1]);
		}
	}
}