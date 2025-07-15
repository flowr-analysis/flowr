import { describe } from 'vitest';
import { RComplexType, RDoubleType, RIntegerType, RLogicalType, RNullType, RStringType } from '../../../src/typing/unification/types';
import { assertInferredType } from '../_helper/typing/assert-inferred-type';

describe.each([
	{ description: 'logical constant',        input: 'TRUE',            expectedType: new RLogicalType() },
	{ description: 'logical constant',        input: 'FALSE',           expectedType: new RLogicalType() },
	{ description: 'null constant',           input: 'NULL',            expectedType: new RNullType() },
	{ description: 'integer constant',        input: '42',              expectedType: new RDoubleType() },
	{ description: 'integer constant',        input: '42L',             expectedType: new RIntegerType() },
	{ description: 'double constant',         input: '42.5',            expectedType: new RDoubleType() },
	{ description: 'complex number constant', input: '42i',             expectedType: new RComplexType() },
	{ description: 'string constant',         input: '"Hello, world!"', expectedType: new RStringType() },
	{ description: 'empty expression list',   input: '{}',              expectedType: new RNullType() }
])('Infer $expectedType for $description', ({ input, expectedType }) => assertInferredType(input, expectedType));