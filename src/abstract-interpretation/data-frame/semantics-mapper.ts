import type { BuiltInMappingName } from '../../dataflow/environments/built-in';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { RAccess, RNamedAccess } from '../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataFrameInfo } from './absint-info';
import { mapDataFrameAccess } from './mappers/access-mapper';
import { mapDataFrameAssignment } from './mappers/assignment-mapper';
import { mapDataFrameFunctionCall } from './mappers/function-mapper';

const DataFrameProcessorMapper = {
	'builtin:default':    mapDataFrameFunctionCall,
	'builtin:assignment': mapDataFrameAssignment,
	'builtin:access':     mapDataFrameAccess,
} as const satisfies Partial<Record<BuiltInMappingName, DataFrameProcessor>>;

type DataFrameProcessor = <OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph
) => DataFrameInfo | undefined;

export function mapDataFrameSemantics<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	dfg: DataflowGraph,
	origin: BuiltInMappingName
): DataFrameInfo | undefined {
	if(origin in DataFrameProcessorMapper) {
		const mapperFunction = DataFrameProcessorMapper[origin as keyof typeof DataFrameProcessorMapper];

		return mapperFunction(node, dfg);
	}
}

export function isStringBasedAccess<OtherInfo>(
	access: RAccess<OtherInfo & ParentInformation>
): access is RNamedAccess<OtherInfo & ParentInformation> {
	return access.operator === '$' || access.operator === '@';
}
