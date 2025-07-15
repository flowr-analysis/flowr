import { describe } from 'vitest';
import { RUnknownType } from '../../../../src/typing/unification/types';
import { assertInferredType } from '../../_helper/typing/unification/assert-inferred-type';

describe('Infer no type information for currently unsupported R expressions', () => {
	assertInferredType('1 + 2',                  new RUnknownType());
	assertInferredType('print("Hello, world!")', new RUnknownType());
});