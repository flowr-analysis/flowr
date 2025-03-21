import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { NormalizedAst, ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { AbstractInterpretationInfo } from './absint-info';
import type { DataFrameDomain } from './domain';
import { DataFrameTop, joinDataFrames } from './domain';
import { resolveVariableOrigin } from './semantics';

export function resolveDataFrameValue<OtherInfo>(
	node: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	ast: NormalizedAst<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	environment: REnvironmentInformation
): DataFrameDomain {
	const domain = node.info.dataFrame?.domain;

	if(domain === undefined) {
		return DataFrameTop;
	}
	const identifiers = resolveVariableOrigin(node, { ast, environment });
	const values = identifiers?.map(nodeId => domain.get(nodeId) ?? DataFrameTop);

	return values ? joinDataFrames(...values) : DataFrameTop;
}
