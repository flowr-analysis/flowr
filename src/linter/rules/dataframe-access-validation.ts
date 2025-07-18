import { hasDataFrameExpressionInfo, type AbstractInterpretationInfo, type DataFrameOperationType } from '../../abstract-interpretation/data-frame/absint-info';
import { satisfiesColsNames, satisfiesLeqInterval, type DataFrameDomain } from '../../abstract-interpretation/data-frame/domain';
import { inferDataFrameShapes, resolveIdToDataFrameShape } from '../../abstract-interpretation/data-frame/shape-inference';
import { amendConfig } from '../../config';
import { extractCfg } from '../../control-flow/extract-cfg';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type { FlowrSearchElements } from '../../search/flowr-search';
import { Q } from '../../search/flowr-search-builder';
import { Enrichment } from '../../search/search-executor/search-enrichers';
import { formatRange } from '../../util/mermaid/dfg';
import { type MergeableRecord } from '../../util/objects';
import { rangeFrom, type SourceRange } from '../../util/range';
import type { LintingResult, LintingRule } from '../linter-format';
import { LintingCertainty, LintingPrettyPrintContext } from '../linter-format';
import { LintingRuleTag } from '../linter-tags';

interface DataFrameAccessOperation {
    nodeId:        NodeId
    operand?:      NodeId,
    operandShape?: DataFrameDomain,
    accessedCols?: (string | number)[],
    accessedRows?: number[]
};

interface DataFrameAccess {
	type:     'column' | 'row',
	accessed: string | number
};

export interface DataFrameAccessValidationResult extends LintingResult, DataFrameAccess {
    access:   string,
    operand?: string,
    range:    SourceRange
}

export interface DataFrameAccessValidationConfig extends MergeableRecord {
	/** Whether data frame shapes should be extracted from loaded external data files, such as CSV files (defaults to the option in the flowR config if `undefined`) */
	readLoadedData?: boolean
}

export interface DataFrameAccessValidationMetadata extends MergeableRecord {
	/** The number of data frame functions and operations containing inferred column or row accesses */
	numOperations:    number,
	/** The number of inferred abstract column or row access operations */
    numAccesses:   number,
	/** The total number of inferred accessed columns and rows */
    totalAccessed: number
}

export const DATA_FRAME_ACCESS_VALIDATION = {
	createSearch:        () => Q.all().with(Enrichment.CallTargets, { onlyBuiltin: true }),
	processSearchResult: (elements, config, data) => {
		const flowrConfig = amendConfig(data.config, flowrConfig => {
			if(config.readLoadedData !== undefined) {
				flowrConfig.abstractInterpretation.dataFrame.readLoadedData.readExternalFiles = config.readLoadedData;
			}
			return flowrConfig;
		});
		const cfg = extractCfg(data.normalize, flowrConfig, data.dataflow.graph);
		inferDataFrameShapes(cfg, data.dataflow.graph, data.normalize, flowrConfig);

		const accessOperations = getAccessOperations(elements);
		const accesses: DataFrameAccessOperation[] = [];

		for(const [nodeId, operations] of accessOperations) {
			const access: DataFrameAccessOperation = { nodeId };

			for(const operation of operations) {
				access.operand ??= operation.operand;
				access.operandShape ??= resolveIdToDataFrameShape(operation.operand, data.dataflow.graph);

				if(operation.operation === 'accessCols' && operation.columns !== undefined) {
					access.accessedCols ??= [];
					access.accessedCols.push(...operation.columns);
				} else if(operation.operation === 'accessRows' && operation.rows !== undefined) {
					access.accessedRows ??= [];
					access.accessedRows.push(...operation.rows);
				}
			}
			accesses.push(access);
		}

		const operations = accessOperations.entries().flatMap(([, operations]) => operations).toArray();

		const metadata: DataFrameAccessValidationMetadata = {
			numOperations: accessOperations.size,
			numAccesses:   operations.length,
			totalAccessed: operations
				.map(operation => operation.operation === 'accessCols' ? operation.columns?.length ?? 0 : operation.rows?.length ?? 0)
				.reduce((a, b) => a + b, 0)
		};

		const results: DataFrameAccessValidationResult[] = accesses
			.flatMap(access => findInvalidDataFrameAccesses(access)
				.map(accessed => ({ nodeId: access.nodeId, operand: access.operand, ...accessed }))
			)
			.map(({ nodeId, operand, ...accessed }) => ({
				...accessed,
				node:    data.normalize.idMap.get(nodeId),
				operand: operand !== undefined ? data.normalize.idMap.get(operand) : undefined,
			}))
			.map(({ node, operand, ...accessed }) => ({
				...accessed,
				access:    node?.lexeme ?? '???',
				operand:   operand?.type === RType.Symbol ? operand.content : undefined,
				range:     node?.info.fullRange ?? node?.location ?? rangeFrom(-1, -1, -1, -1),
				certainty: LintingCertainty.Definitely
			}));

		return { results, '.meta': metadata };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: result => `Access of ${result.type} ` +
			(typeof result.accessed === 'string' ? `"${result.accessed}"` : result.accessed) + ' ' +
			(result.operand !== undefined ? `of \`${result.operand}\`` : `at \`${result.access}\``) + ` at ${formatRange(result.range)}`,
		[LintingPrettyPrintContext.Full]: result => `Accessed ${result.type} ` +
			(typeof result.accessed === 'string' ? `"${result.accessed}"` : result.accessed) + ' does not exist ' +
			(result.operand !== undefined ? `in \`${result.operand}\`` : `at \`${result.access}\``) + ` at ${formatRange(result.range)}`
	},
	info: {
		name:          'Dataframe Access Validation',
		tags:          [LintingRuleTag.Bug, LintingRuleTag.Usability, LintingRuleTag.Reproducibility],
		description:   'Validates the existance of accessed columns and rows of dataframes.',
		defaultConfig: { readLoadedData: false }
	}
} as const satisfies LintingRule<DataFrameAccessValidationResult, DataFrameAccessValidationMetadata, DataFrameAccessValidationConfig>;

function getAccessOperations(
	elements: FlowrSearchElements<ParentInformation & AbstractInterpretationInfo>
): Map<NodeId, DataFrameOperationType<'accessCols' | 'accessRows'>[]> {
	return new Map(elements.getElements()
		.map(element => element.node)
		.filter(hasDataFrameExpressionInfo)
		.map<[NodeId, DataFrameOperationType<'accessCols' | 'accessRows'>[]]>(node =>
			[node.info.id, node.info.dataFrame.operations
				.filter(({ operation }) => operation === 'accessCols' || operation === 'accessRows')
				.map(({ operation, operand, type: _type, options: _options, ...args }) =>
					({ operation, operand, ...args } as DataFrameOperationType<'accessCols' | 'accessRows'>))
			])
		.filter(([, operations]) => operations.length > 0)
	);
}

function findInvalidDataFrameAccesses(
	{ operandShape, accessedCols, accessedRows }: DataFrameAccessOperation
): DataFrameAccess[] {
	const invalidAccesses: DataFrameAccess[] = [];

	if(operandShape !== undefined) {
		for(const row of accessedRows ?? []) {
			if(!satisfiesLeqInterval(operandShape.rows, row)) {
				invalidAccesses.push({ type: 'row',accessed: row });
			}
		}
		for(const col of accessedCols ?? []) {
			if(typeof col === 'string' && !satisfiesColsNames(operandShape.colnames, col)) {
				invalidAccesses.push({ type: 'column',accessed: col });
			} else if(typeof col === 'number' && !satisfiesLeqInterval(operandShape.cols, col)) {
				invalidAccesses.push({ type: 'column',accessed: col });
			}
		}
	}
	return invalidAccesses;
}
