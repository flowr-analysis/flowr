import type { RNode, RConstant, RSingleNode, ROther } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess, RNamedAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';

export function isROther(
	node: RNode<ParentInformation>
): node is ROther<ParentInformation> {
	return node.type === RType.Comment || node.type === RType.LineDirective;
}

export function isRConstant(
	node: RNode<ParentInformation>
): node is RConstant<ParentInformation> {
	return node.type === RType.String || node.type === RType.Number || node.type === RType.Logical;
}

export function isRSingleNode(
	node: RNode<ParentInformation>
): node is RSingleNode<ParentInformation> {
	return isRConstant(node) || isROther(node) || node.type === RType.Symbol || node.type === RType.Break || node.type === RType.Next;
}

export function isStringBasedAccess(
	access: RAccess<ParentInformation>
): access is RNamedAccess<ParentInformation> {
	return access.operator === '$' || access.operator === '@';
}
