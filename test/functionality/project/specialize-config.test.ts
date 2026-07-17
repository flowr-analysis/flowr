import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerContext } from '../../../src/project/context/flowr-analyzer-context';
import { ProjectKind } from '../../../src/project/context/project-kind';
import { FlowrConfig, VariableResolve } from '../../../src/config';
import type { RParseRequest } from '../../../src/r-bridge/retriever';
import type { DeepWritable } from 'ts-essentials';

/** a config specializing `overwrite` for the given `kind` */
function specializing(kind: ProjectKind, overwrite: (c: DeepWritable<FlowrConfig>) => void): FlowrConfig {
	const spec = FlowrConfig.amend(FlowrConfig.default(), overwrite);
	return FlowrConfig.amend(FlowrConfig.default(), c => {
		c.specializeConfig = { [kind]: spec };
	});
}

/** a context of a shiny app (`app.R` alone suffices), analyzed with the given `config` */
function shinyContext(config: FlowrConfig): FlowrAnalyzerContext {
	const ctx = new FlowrAnalyzerContext(config, new Map());
	ctx.addRequests([{ request: 'file', content: '/app/app.R' } as RParseRequest]);
	return ctx;
}

describe('FlowrConfig.forKind', () => {
	test('a kind without an overwrite keeps the config untouched', () => {
		const config = FlowrConfig.default();
		assert.strictEqual(FlowrConfig.forKind(config, ProjectKind.Package), config);
		assert.isUndefined(FlowrConfig.forKind(config, ProjectKind.Package).project.implicitSources);
	});

	test('any kind can be given an overwrite, not just shiny', () => {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.specializeConfig = { [ProjectKind.Notebook]: { project: { implicitSources: ['setup.R'] } } };
		});
		assert.deepStrictEqual(FlowrConfig.forKind(config, ProjectKind.Notebook).project.implicitSources, ['setup.R']);
	});

	test('any key can be specialized, not just the ones about the project', () => {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.specializeConfig = { [ProjectKind.Package]: { ignoreSourceCalls: true, solver: { variables: VariableResolve.Disabled } } };
		});
		const forPackage = FlowrConfig.forKind(config, ProjectKind.Package);
		assert.isTrue(forPackage.ignoreSourceCalls);
		assert.strictEqual(forPackage.solver.variables, VariableResolve.Disabled);
		assert.strictEqual(forPackage.solver.evalStrings, FlowrConfig.default().solver.evalStrings);
	});

	test('a value the user set themselves wins over the one of the kind', () => {
		const config = FlowrConfig.amend(specializing(ProjectKind.Package, c => {
			c.ignoreSourceCalls = true;
			c.solver.variables = VariableResolve.Disabled;
		}), c => {
			c.solver.variables = VariableResolve.Builtin;
		});
		const forPackage = FlowrConfig.forKind(config, ProjectKind.Package);
		assert.strictEqual(forPackage.solver.variables, VariableResolve.Builtin, 'the user set this one');
		assert.isTrue(forPackage.ignoreSourceCalls, 'but left this one to the kind');
	});
});

describe('The config of an analysis', () => {
	test('is specialized for the kind of the project', () => {
		const ctx = shinyContext(specializing(ProjectKind.ShinyApp, c => {
			c.ignoreSourceCalls = true;
		}));
		assert.strictEqual(ctx.projectKind(), ProjectKind.ShinyApp);
		assert.isTrue(ctx.config.ignoreSourceCalls);
		assert.isFalse(ctx.baseConfig.ignoreSourceCalls, 'the config as given stays untouched');
	});

	test('is the one given if nothing is specialized', () => {
		const config = FlowrConfig.amend(FlowrConfig.default(), c => {
			c.specializeConfig = undefined;
		});
		assert.strictEqual(shinyContext(config).config, config);
	});

	test('follows the kind as the files classifying the project arrive', () => {
		const config = specializing(ProjectKind.ShinyApp, c => {
			c.ignoreSourceCalls = true;
		});
		const ctx = new FlowrAnalyzerContext(config, new Map());
		assert.isFalse(ctx.config.ignoreSourceCalls, 'nothing marks this a shiny app yet');
		ctx.addRequests([{ request: 'file', content: '/app/app.R' } as RParseRequest]);
		assert.isTrue(ctx.config.ignoreSourceCalls);
	});

	test('is resolved anew after a re-evaluation', () => {
		const ctx = shinyContext(specializing(ProjectKind.ShinyApp, c => {
			c.ignoreSourceCalls = true;
		}));
		const first = ctx.config;
		assert.strictEqual(ctx.config, first, 'the same kind resolves to the same config');
		ctx.reevaluateConfig();
		assert.notStrictEqual(ctx.config, first);
		assert.isTrue(ctx.config.ignoreSourceCalls);
	});
});
