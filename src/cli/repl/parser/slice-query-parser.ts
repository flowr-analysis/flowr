import type { SlicingCriterion, SlicingCriteria } from '../../../slicing/criterion/parse';
import { SliceDirection } from '../../../util/slice-direction';

/**
 * Checks whether the given argument represents a slicing direction with an `f` suffix.
 */
export function sliceDirectionParser(argument: string): SliceDirection {
	const endBracket = argument.indexOf(')');
	return argument[endBracket + 1] === 'f' ? SliceDirection.Forward : SliceDirection.Backward;
}

/**
 * Parses a single slicing criterion from the given argument.
 */
export function sliceCriterionParser(argument: string | undefined): SlicingCriterion | undefined {
	if(argument?.startsWith('(') && argument.includes(')')) {
		const endBracket = argument.indexOf(')');
		return argument.slice(1, endBracket) as SlicingCriterion;
	}
}

/**
 * Parses multiple slicing criteria from the given argument.
 */
export function sliceCriteriaParser(argument: string | undefined): SlicingCriteria | undefined {
	if(argument?.startsWith('(') && argument.includes(')')) {
		const endBracket = argument.indexOf(')');
		const criteriaPart = argument.slice(1, endBracket);
		const criteria = criteriaPart.split(';');

		return criteria as SlicingCriteria;
	}
}
