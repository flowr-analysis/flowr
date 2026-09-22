import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SourceLocation } from '../../util/range';
import { SourceLocation as SourceLocationOps } from '../../util/range';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/** Per-finding context handed to a {@link ReportTemplate}. */
export interface FindingContext {
	/** The name of the taint analysis */
	readonly name:          string;
	/** The AST node ID that reached Bottom */
	readonly nodeId:        NodeId;
	/** The resolved AST node, if present in the id map */
	readonly node?:         RNode<ParentInformation>;
	/** The source location of the node, if resolvable */
	readonly loc?:          SourceLocation;
	/** The formatted source location, if resolvable */
	readonly locString?:    string;
	/** 1-based start line of the finding, if known */
	readonly line?:         number;
	/** 1-based start column of the finding, if known */
	readonly column?:       number;
	/** The source file of the finding, if known */
	readonly file?:         string;
	/** The node's lexeme, if known */
	readonly lexeme?:       string;
	/** The called function's name, if the node resolves to a named call */
	readonly functionName?: string;
}

/**
 * A report message: either a constant string, or a function rendering a message per {@link FindingContext|finding}.
 */
export type ReportTemplate = string | ((finding: FindingContext) => string);

/**
 * Convenience accessor rendering the offending token of a finding: the called function's name when the
 * finding node resolves to a named call, otherwise the node's lexeme.
 */
export const findingToken: (finding: FindingContext) => string | undefined
	= finding => finding.functionName ?? finding.lexeme;

/**
 * Assembles the {@link FindingContext} for a single finding from its node id and resolved node/location.
 */
export function buildFindingContext(
	name: string,
	nodeId: NodeId,
	node: RNode<ParentInformation> | undefined,
	loc: SourceLocation | undefined
): FindingContext {
	return {
		name,
		nodeId,
		node,
		loc,
		locString:    loc !== undefined ? SourceLocationOps.format(loc) : undefined,
		line:         loc?.[0],
		column:       loc?.[1],
		file:         loc !== undefined ? SourceLocationOps.getFile(loc) : undefined,
		lexeme:       node?.lexeme,
		functionName: RFunctionCall.isNamed(node) ? node.functionName.lexeme : undefined,
	};
}

/**
 * Renders a {@link ReportTemplate} for a given {@link FindingContext}.
 * Constant strings are returned verbatim.
 */
export function renderReport(report: ReportTemplate, ctx: FindingContext): string {
	return typeof report === 'function' ? report(ctx) : report;
}

/**
 * The default report template which appends the function name or lexeme and line number of the finding to the explanatory string.
 * @param s - Human-readable explanation of the finding
 */
export function defaultReportTemplate(s: string){
	return (f: FindingContext) => `${s} [${findingToken(f)} at ${f.locString}]`;
}

