import { describe } from 'vitest';
import { RTypeVariable } from '../../../../src/typing/types';
import { assertInferredType } from '../../_helper/typing/unification/assert-inferred-type';

describe('Infer no type information for currently unsupported R expressions', () => {
	assertInferredType('1 + 2',                  new RTypeVariable());
	assertInferredType('print("Hello, world!")', new RTypeVariable());
});