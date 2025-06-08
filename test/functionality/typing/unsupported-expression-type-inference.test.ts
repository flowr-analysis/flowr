import { describe } from 'vitest';
import { RDataTypeTag } from '../../../src/typing/types';
import { assertInferredType } from '../_helper/typing/assert-inferred-type';

describe('Infer no type information for currently unsupported R expressions', () => {
	assertInferredType('1 + 2',                  { tag: RDataTypeTag.Unknown });
	assertInferredType('print("Hello, world!")', { tag: RDataTypeTag.Unknown });
});