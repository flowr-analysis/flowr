import { SliceDirection } from '../../../core/steps/all/static-slicing/00-slice';
import type { SingleSlicingCriterion, SlicingCriteria } from '../../../slicing/criterion/parse';

export function sliceDirectionParser(argument: string): SliceDirection {
	const endBracket = argument.indexOf(')');
	return argument[endBracket + 1] === 'f' ? SliceDirection.Forward : SliceDirection.Backward;
}

export function sliceCriterionParser(argument: string | undefined): SingleSlicingCriterion | undefined {
	if(argument?.startsWith('(') && argument.includes(')')) {
		const endBracket = argument.indexOf(')');
		return argument.slice(1, endBracket) as SingleSlicingCriterion;
	}
}

export function sliceCriteriaParser(argument: string | undefined): SlicingCriteria | undefined {
	if(argument?.startsWith('(') && argument.includes(')')) {
		const endBracket = argument.indexOf(')');
		const criteriaPart = argument.slice(1, endBracket);
		const criteria = criteriaPart.split(',');

		return criteria as SlicingCriteria;
	}
}
