import { SliceDirection } from '../../../core/steps/all/static-slicing/00-slice';
import type { SlicingCriteria } from '../../../slicing/criterion/parse';
import type { ReplOutput } from '../commands/repl-main';
import type { ParsedQueryLine } from '../../../queries/query';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { BaseQueryFormat } from '../../../queries/base-query-format';

function sliceDirectionParser(argument: string): SliceDirection {
	const endBracket = argument.indexOf(')');
	return argument[endBracket + 1] === 'f' ? SliceDirection.Forward : SliceDirection.Backward;
}

function sliceCriteriaParser(argument: string): SlicingCriteria | undefined {
	if(argument.startsWith('(') && argument.includes(')')) {
		const endBracket = argument.indexOf(')');
		const criteriaPart = argument.slice(1, endBracket);
		const criteria = criteriaPart.split(',');

		return criteria as SlicingCriteria;
	}
}

export interface SliceQueryParserParameters<QueryType extends BaseQueryFormat['type']> {
	/** The query type to parse */
	type:           QueryType;
	/** REPL output interface */
	output:         ReplOutput;
	/** Line to parse */
	line:           readonly string[];
	/** Whether the slicing criteria is mandatory */
	isMandatory:    boolean;
	/** Whether to parse the slicing direction */
	withDirection?: boolean;
}

/**
 * Parses slice criteria and (optionally) the slice direction from a query line.
 */
export function sliceQueryParser<QueryType extends BaseQueryFormat['type']>({ line, output, withDirection = false, isMandatory, type }: SliceQueryParserParameters<QueryType>): ParsedQueryLine<QueryType> {
	const criteria = sliceCriteriaParser(line[0]);
	if(isMandatory && !criteria) {
		output.stderr(output.formatter.format('Invalid static-slice query format, slicing criteria must be given in the form "(criterion1;criterion2;...)"',
			{ color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
		return { query: [] };
	}

	return {
		query: [{
			type:      type,
			criteria:  criteria,
			direction: (withDirection ? sliceDirectionParser(line[0]) : SliceDirection.Backward)
		}],
		rCode: criteria ? line[1] : line[0]
	} as ParsedQueryLine<QueryType>;
}
