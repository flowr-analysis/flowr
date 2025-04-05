import { beforeAll, describe, expect, test } from 'vitest';
import { retrieveNormalizedAst, withShell } from '../_helper/shell';
import type { NormalizedAst } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { RDataType, TypeInferencer } from '../../../src/typing/type-inferencer';

describe.sequential('Infer types for constant expressions', withShell(shell => {
	let logicalAst: NormalizedAst | undefined;
	let numberAst: NormalizedAst | undefined;
	let stringAst: NormalizedAst | undefined;
    let inferencer = new TypeInferencer();

	beforeAll(async() => {
		logicalAst = await retrieveNormalizedAst(shell, 'TRUE');
		numberAst  = await retrieveNormalizedAst(shell, '42');
		stringAst  = await retrieveNormalizedAst(shell, '"Hello, world!"');

	});

	test(`Infer ${RDataType.Logical} for logical constants`, () => {
		let inferredType = inferencer.fold(logicalAst?.ast);
		expect(inferredType).toBe(RDataType.Logical);
	});
	
    test(`Infer ${RDataType.Numeric} for numeric constants`, () => {
		let inferredType = inferencer.fold(numberAst?.ast);
		expect(inferredType).toBe(RDataType.Numeric);
	});
	
    test(`Infer ${RDataType.String} for string constants`, () => {
		let inferredType = inferencer.fold(stringAst?.ast);
		expect(inferredType).toBe(RDataType.String);
	});
}));