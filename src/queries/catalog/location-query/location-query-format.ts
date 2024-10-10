import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import type { SourceRange } from '../../../util/range';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';

export interface LabeledSourceRange {
	readonly startLine:   number;
	readonly startColumn: number;
	readonly endLine:     number;
	readonly endColumn:   number;
}

export function labelSourceRange([startLine, startColumn, endLine, endColumn]: SourceRange): LabeledSourceRange {
	return { startLine, startColumn, endLine, endColumn };
}

export function labeledSourceRangeToString({ startLine, startColumn, endLine, endColumn }: LabeledSourceRange): string {
	return `${startLine}:${startColumn} – ${endLine}:${endColumn}`;
}

export interface LocationQuery extends BaseQueryFormat {
	readonly type:   'location';
	readonly nodeId: NodeId;
}

export interface LocationQueryResult extends BaseQueryResult {
	readonly location:	Record<NodeId, LabeledSourceRange | undefined>;
}
