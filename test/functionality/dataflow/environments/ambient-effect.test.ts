import { assert, describe, test } from 'vitest';
import { AmbientFamilyInfo, AmbientPart, AmbientVerb, AmbientVerbInfo, ambientSummaryOf, declaresAmbient } from '../../../../src/dataflow/environments/ambient-effect';
import { KeyedState } from '../../../../src/dataflow/environments/ambient-state-name';
import { statedSignatures } from '../../../../src/dataflow/environments/default-builtin-config';
import { CallProp, CallProps } from '../../../../src/dataflow/environments/built-in-props';
import type { BrandedIdentifier } from '../../../../src/dataflow/environments/identifier';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';

describe('Ambient effects of the built-ins', () => {
	const stated = statedSignatures();
	/** the accesses of `name` as `family: label [members] (when)` */
	function summary(name: BrandedIdentifier): string[] {
		return (stated.get(name)?.[0]?.ambient ?? []).flatMap(f => f.accesses.map(a =>
			`${f.label}: ${a.label}${a.members.length > 0 ? ` [${a.members.join(', ')}]` : ''}${a.when.length > 0 ? ` (${a.when.join(', ')})` : ''}`));
	}
	function check(name: BrandedIdentifier, expected: readonly string[]) {
		test(name, () => {
			assert.deepStrictEqual(summary(name), expected);
		});
	}
	describe('summaries by part and access', () => {
		check('png', ['graphics device: opens device', 'files: writes files [named by filename]']);
		check('points', ['graphics device: adds to plot', 'graphics device: reads graphics parameters', 'palette: reads palette']);
		check('curve', ['graphics device: adds to plot (if add is TRUE)', 'graphics device: starts a new plot (unless add is TRUE)', 'graphics device: reads graphics parameters', 'palette: reads palette']);
		check('dev.off', ['graphics device: closes device']);
		check('dev.cur', ['graphics device: reads device [every open one]']);
		check('par', ['graphics device: reads graphics parameters', 'graphics device: reads graphics parameters [the unnamed arguments] (if it only queries)', 'graphics device: writes graphics parameters [the names of the arguments] (unless it only queries)', 'graphics device: reads plot (if it only queries)']);
		check('runif', ['random numbers: draws from random number generator']);
		check('paste', ['options: reads options [scipen, OutDec]']);
		check('col2rgb', ['palette: reads palette']);
		check('Sys.timezone', ['environment variables: reads environment variables [TZ]']);
		check('cat', ['options: reads options [digits, width, max.print, digits.secs, useFancyQuotes, scipen, OutDec]', 'message sink: adds to message sink (if file is a call of stderr)', 'files: reads files [named by file] (if append is TRUE)', 'files: writes files [named by file]', 'output sink: adds to sink']);
		check('message', ['message sink: adds to message sink']);
	});
	test('every part and verb has its words', () => {
		for(const part of [...Object.values(AmbientPart), ...Object.values(KeyedState)]) {
			assert.isNotEmpty(AmbientFamilyInfo[part].description, part);
		}
		for(const verb of Object.values(AmbientVerb)) {
			assert.isNotEmpty(AmbientVerbInfo[verb].description, verb);
		}
	});
	test('a declaration states the ambient label on the page', () => {
		for(const [name, signatures] of stated) {
			const props = new Set(signatures[0].props);
			if(signatures[0].ambient !== undefined) {
				assert.isTrue(props.has(CallProps.labels({ props: CallProp.Ambient })[0]), String(name));
			}
		}
		assert.isFalse(declaresAmbient({}));
		assert.isEmpty(ambientSummaryOf(undefined));
	});
	/* each checked in R 4.6.1 */
	describe('values of the entries the calls set', () => {
		function value(name: string, code: string, criterion: string, expected: string | undefined) {
			test(name, async() => {
				const analyzer = await new FlowrAnalyzerBuilder().setEngine('tree-sitter').build();
				analyzer.addRequest(requestFromInput(code));
				const result = await analyzer.query([{ type: 'resolve-value', criteria: [criterion as never] }]);
				const values = JSON.stringify(Object.values(result['resolve-value'].results)[0].values, (key, v: unknown) => key === 'markedAsInt' || key === 'complexNumber' || key === 'quotes' || key === 'elementDomain' ? undefined : v);
				if(expected === undefined) {
					assert.notInclude(values, '"set"', values);
				} else {
					assert.include(values, expected, values);
				}
			});
		}
		value('getOption after options', 'options(digits = 3)\nx <- getOption("digits")', '2@x', '"num":3');
		value('getOption after a later options naming others', 'options(digits = 3)\noptions(digits = 5, width = 3)\nx <- getOption("digits")', '3@x', '"num":5');
		value('both branches set the option', 'if(u) options(digits = 3) else options(digits = 4)\nx <- getOption("digits")', '2@x', '"num":4');
		value('one branch sets the option', 'if(u) options(digits = 3)\nx <- getOption("digits")', '2@x', undefined);
		value('restoring options we cannot see into', 'op <- options(warn = 1)\noptions(op)\nx <- getOption("warn")', '3@x', undefined);
		value('Sys.getenv after Sys.setenv', 'Sys.setenv(A = "x")\nx <- Sys.getenv("A")', '2@x', '"str":"x"');
		value('Sys.getenv after Sys.unsetenv', 'Sys.setenv(A = "x")\nSys.unsetenv("A")\nx <- Sys.getenv("A")', '3@x', undefined);
		value('par after par', 'par(mfrow = c(1, 2))\nx <- par("mfrow")', '2@x', '"num":2');
		value('a new device starts with its own parameters', 'par(mfrow = c(1, 2))\npng("a.png")\nx <- par("mfrow")', '3@x', undefined);
		value('layout changes mfrow', 'par(mfrow = c(1, 2))\nlayout(matrix(1:3, 1))\nx <- par("mfrow")', '3@x', undefined);
	});
});
