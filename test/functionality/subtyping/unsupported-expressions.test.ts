import { describe } from 'vitest';
import { RTypeIntersection, RTypeUnion, RTypeVariable } from '../../../src/subtyping/types';
import { assertInferredType } from '../_helper/subtyping/assert-inferred-type';

describe('Infer no type information for currently unsupported R expressions', () => {
	assertInferredType('1 + 2',                  new RTypeVariable(new RTypeUnion(), new RTypeIntersection()));
	assertInferredType('print("Hello, world!")', new RTypeVariable(new RTypeUnion(), new RTypeIntersection()));
});