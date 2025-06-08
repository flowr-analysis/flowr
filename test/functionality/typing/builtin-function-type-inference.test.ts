import { describe } from 'vitest';
import { RDataTypeTag } from '../../../src/typing/types';
import { assertInferredType, assertInferredTypes } from '../_helper/typing/assert-inferred-type';
import { Q } from '../../../src/search/flowr-search-builder';

describe('Infer types for builtin functions', () => {
	assertInferredType('rm(x)', { tag: RDataTypeTag.Null as const });

	assertInferredTypes(
		'x <- 42\nget("x")',
		{ query: Q.criterion('1@x').build(), expectedType: { tag: RDataTypeTag.Integer as const } },
		{ query: Q.criterion('2@get').build(), expectedType: { tag: RDataTypeTag.Integer as const } },
		{ query: Q.criterion('2@"x"').build(), expectedType: { tag: RDataTypeTag.String as const } }
	);

	assertInferredTypes(
		'eval(quote(TRUE))',
		{ query: Q.criterion('1@eval').build(), expectedType: { tag: RDataTypeTag.Unknown as const } },
		{ query: Q.criterion('1@quote').build(), expectedType: { tag: RDataTypeTag.Language as const } },
		{ query: Q.criterion('1@TRUE').build(), expectedType: { tag: RDataTypeTag.Logical as const } }
	);
	
	assertInferredType('list(1, 2, 3)', { tag: RDataTypeTag.List as const });

	assertInferredTypes(
		'c("Hello", "Flo", "!")',
		{ query: Q.criterion('1@c').build(), expectedType: { tag: RDataTypeTag.String as const } },
		{ query: Q.criterion('1@"Hello"').build(), expectedType: { tag: RDataTypeTag.String as const } }
	);
});