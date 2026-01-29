import type { FunctionInfo } from './function-info';
import type { LinkToLastCall, LinkToNestedCall } from '../../call-context-query/call-context-query-format';

const ExpectFunctions: LinkToNestedCall = {
	type:     'link-to-nested-call',
	callName: new RegExp(/* testthat */
		'^(expect_equal|expect_identical|expect_error|expect_warning|expect_message|expect_condition|' +
		'expect_true|expect_false|expect_all_equal|expect_all_true|expect_all_false|expect_lt|expect_lte|expect_gt|expect_gte|' +
		'expect_length|expect_shape|expect_match|expect_no_match|expect_named|expect_null|expect_setequal|expect_mapequal|' +
		'expect_contains|expect_in|expect_disjoint|expect_type|expect_s3_class|expect_s4_class|expect_r6_class|expect_s7_class|' +
		'expect_vector|expect_no_error|expect_no_warning|expect_no_message|expect_no_condition|expect_invisible|expect_visible|' +
		'expect_output|expect_silent|expect_snapshot|expect_snapshot_value|expect_snapshot_file|announce_snapshot_file|' +
		'compare_file_binary|compare_file_text|snapshot_accept|snapshot_reject|snapshot_review|' +
		'fail|pass|expect_success|expect_failure|expect_snapshot_failure|show_failure| + ' +
		/* tinytest */
		'exit_file|exit_if_not|expect_equal|expect_identical|expect_equivalent|expect_true|expect_false|expect_silent|expect_null|' +
		'expect_inherits|expect_error|expect_warning|expect_message|expect_stdout|expect_equal_to_reference|' +
		'expect_equivalent_to_reference|expect_length|expect_match|ignore|report_side_effects|' +
		/* RUnit */
		'checkEquals|checkEqualsNumeric|checkIdentical|checkTrue|checkException' +
		')$')
};

const ContextFunctions: LinkToLastCall = {
	type:     'link-to-last-call',
	callName: new RegExp('^(context)$')
};

export const TestFunctions: FunctionInfo[] = [
	{ package: 'testthat', name: 'test_that', argName: 'desc', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions,ContextFunctions] },
	{ package: 'testthat', name: 'describe', argName: 'description', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions,ContextFunctions] },
	{ package: 'testthat', name: 'it', argName: 'description', argIdx: 0, resolveValue: true, linkTo: [ExpectFunctions,ContextFunctions] },
	{ package: 'testthat', name: 'expect_lt' },
	{ package: 'testthat', name: 'expect_lte' },
	{ package: 'testthat', name: 'expect_gt' },
	{ package: 'testthat', name: 'expect_gte' },
	{ package: 'testthat', name: 'expect_length' },
	{ package: 'testthat', name: 'expect_shape' },
	{ package: 'testthat', name: 'expect_match' },
	{ package: 'testthat', name: 'expect_no_match' },
	{ package: 'testthat', name: 'expect_named' },
	{ package: 'testthat', name: 'expect_null' },
	{ package: 'testthat', name: 'expect_setequal' },
	{ package: 'testthat', name: 'expect_mapequal' },
	{ package: 'testthat', name: 'expect_contains' },
	{ package: 'testthat', name: 'expect_in' },
	{ package: 'testthat', name: 'expect_disjoint' },
	{ package: 'testthat', name: 'expect_type' },
	{ package: 'testthat', name: 'expect_s3_class' },
	{ package: 'testthat', name: 'expect_s4_class' },
	{ package: 'testthat', name: 'expect_r6_class' },
	{ package: 'testthat', name: 'expect_s7_class' },
	{ package: 'testthat', name: 'expect_vector' },
	{ package: 'testthat', name: 'expect_no_error' },
	{ package: 'testthat', name: 'expect_no_warning' },
	{ package: 'testthat', name: 'expect_no_message' },
	{ package: 'testthat', name: 'expect_no_condition' },
	{ package: 'testthat', name: 'expect_invisible' },
	{ package: 'testthat', name: 'expect_visible' },
	{ package: 'testthat', name: 'expect_output' },
	{ package: 'testthat', name: 'expect_silent' },
	{ package: 'testthat', name: 'expect_snapshot' },
	{ package: 'testthat', name: 'expect_snapshot_value' },
	{ package: 'testthat', name: 'expect_snapshot_file' },
	{ package: 'testthat', name: 'announce_snapshot_file' },
	{ package: 'testthat', name: 'compare_file_binary' },
	{ package: 'testthat', name: 'compare_file_text' },
	{ package: 'testthat', name: 'snapshot_accept' },
	{ package: 'testthat', name: 'snapshot_reject' },
	{ package: 'testthat', name: 'snapshot_review' },
	{ package: 'testthat', name: 'fail' },
	{ package: 'testthat', name: 'pass' },
	{ package: 'testthat', name: 'expect_success' },
	{ package: 'testthat', name: 'expect_failure' },
	{ package: 'testthat', name: 'expect_snapshot_failure' },
	{ package: 'testthat', name: 'show_failure' },

	{ package: 'tinytest', name: 'exit_file', argName: 'msg', resolveValue: true },
	{ package: 'tinytest', name: 'exit_if_not' },
	{ package: 'tinytest', name: 'expect_equal', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_identical', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_equivalent', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_true', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_false', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_silent', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_null', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_inherits', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_error', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_warning', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_message', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_stdout', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_equal_to_reference', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_equivalent_to_reference', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_length', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'expect_match', argName: 'info', resolveValue: true },
	{ package: 'tinytest', name: 'ignore' },
	{ package: 'tinytest', name: 'report_side_effects' },

	{ package: 'RUnit', name: 'checkEquals', argName: 'msg', argIdx: 2, resolveValue: true },
	{ package: 'RUnit', name: 'checkEqualsNumeric', argName: 'msg', argIdx: 2, resolveValue: true },
	{ package: 'RUnit', name: 'checkIdentical', argName: 'msg', argIdx: 2, resolveValue: true },
	{ package: 'RUnit', name: 'checkTrue', argName: 'msg', argIdx: 1, resolveValue: true },
	{ package: 'RUnit', name: 'checkException', argName: 'msg', argIdx: 1, resolveValue: true },
];
