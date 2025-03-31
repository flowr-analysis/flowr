import type { REnvironmentInformation } from '../../dataflow/environments/environment';
import { resolveByName } from '../../dataflow/environments/resolve-by-name';
import type { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { AbstractInterpretationInfo } from './absint-info';
import type { DataFrameDomain } from './domain';
import { DataFrameTop, joinDataFrames } from './domain';

export function resolveDataFrameValue<OtherInfo>(
	node: RSymbol<OtherInfo & ParentInformation & AbstractInterpretationInfo>,
	environment: REnvironmentInformation,
	identifier: string = node.content
): DataFrameDomain {
	const domain = node.info.dataFrame?.domain;

	if(domain === undefined) {
		return DataFrameTop;
	}
	const identifiers = resolveByName(identifier, environment);
	const values = identifiers?.map(id => domain.get(id.nodeId) ?? DataFrameTop);

	return values ? joinDataFrames(...values) : DataFrameTop;
}
