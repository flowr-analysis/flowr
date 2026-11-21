import { fn, pkg } from './define-helpers';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { CallProp } from '../built-in-props';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of testing and assertions. */
export const TestingDefinitions = [
	/* mocking replaces a function binding, so later calls of it behave differently */
	fn(pkg(PkgName.Testthat, 'local_mocked_bindings', 'with_mocked_bindings', 'local_mocked_s3_method', 'with_mocked_s3_method', 'local_mocked_s4_method', 'with_mocked_s4_method',
		'local_mocked_r6_class'), BuiltInProcName.Default, { libFn: true, props: CallProp.Invisible, hasUnknownSideEffects: true }),
	fn(pkg(PkgName.Mockery, 'stub', 'stub_'), BuiltInProcName.Default, { libFn: true, props: CallProp.Invisible, hasUnknownSideEffects: true }),
] as const satisfies AnyBuiltInDefinition[];
