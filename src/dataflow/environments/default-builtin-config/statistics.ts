import { sig, Forced } from './shared-signatures';
import { fn, pkg, stats, Primitive, Overrides, readsFile, writesFile } from './define-helpers';
import { Identifier, PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { AmbientStateAccessType } from '../built-in-kinds';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of the stats package and statistical modeling packages. */
export const StatsDefinitions = [
	fn(stats('na.omit'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, tags: [SemanticCallTag.Transforms], sig: sig({ object: Forced.Value, '...': Forced.Value }) },
		Primitive),
	/* the hypothesis tests: they compute a test statistic and hand it back visibly, which is the output a reader sees */
	fn([...stats('anova', 'ansari.test', 'aov', 'bartlett.test', 'binom.test', 'Box.test', 'chisq.test', 'cor.test', 'fisher.test', 'fligner.test', 'friedman.test', 'kruskal.test',
		'ks.test', 'manova', 'mantelhaen.test', 'mauchly.test', 'mcnemar.test', 'mood.test', 'oneway.test', 'pairwise.prop.test', 'pairwise.t.test', 'pairwise.wilcox.test', 'poisson.test',
		'PP.test', 'prop.test', 'prop.trend.test', 'quade.test', 'shapiro.test', 't.test', 'TukeyHSD', 'var.test', 'wilcox.test'), ...pkg(PkgName.Car, 'Anova', 'durbinWatsonTest',
		'leveneTest', 'linearHypothesis', 'ncvTest', 'outlierTest'), ...pkg(PkgName.LmTest, 'bgtest', 'bptest', 'coeftest', 'dwtest', 'gqtest', 'lrtest', 'raintest', 'resettest',
		'waldtest'), ...pkg(PkgName.NorTest, 'ad.test', 'cvm.test', 'lillie.test', 'pearson.test', 'sf.test'), ...pkg(PkgName.Tseries, 'adf.test', 'jarque.bera.test', 'kpss.test',
		'pp.test', 'runs.test', 'white.test'), ...pkg(PkgName.Rstatix, 'anova_test', 'chisq_test', 'cor_test', 'kruskal_test', 'shapiro_test', 't_test', 'wilcox_test'),
	...pkg(PkgName.Multcomp, 'glht')], BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, tags: [SemanticCallTag.Statistics] }),
	fn(pkg(PkgName.Lim, 'Read'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Expss, 'read_spss'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.SimPhe, 'read.geno'), BuiltInProcName.DefaultReadAllArgs, readsFile('fname')),
	fn(pkg(PkgName.Geomorph, 'readland.tps'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Stargazer, 'stargazer'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ '...': Forced.Value, out: Forced.Resource | ArgProp.Optional }) }),
	fn(pkg(PkgName.Texreg, 'htmlreg', 'texreg'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ l: Forced.Value, file: Forced.Resource | ArgProp.Optional }) }),
	fn(stats('read.ftable'), BuiltInProcName.DefaultReadAllArgs, { tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ file: Forced.Resource, '...': Forced.Value }) }),
	fn(pkg(PkgName.Claddis, 'write_nexus_matrix', 'write_tnt_matrix'), BuiltInProcName.DefaultReadAllArgs, writesFile('file_name', 'cladistic_matrix')),
	fn(pkg(PkgName.Hmisc, 'getHdata'), BuiltInProcName.DefineArgument,
		{ superAssignment: true, sig: sig({ '...': 0, list: ArgProp.Value, package: 0, 'lib.loc': 0, verbose: 0, envir: 0, overwrite: 0 }) }),
	fn(pkg(PkgName.Inferference, 'interference'), BuiltInProcName.Apply, { unquoteFunction: true, nameOfFunctionArgument: 'propensity_integrand', libFn: true }),
	fn([...stats('setNames'), ...pkg(PkgName.FastUtils, 'setNames')], BuiltInProcName.Default, { props: CallProp.Pure, sig: sig({ object: Forced.Value, nm: Forced.Value }) }),
	fn(stats('filter'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Pure, sig: sig({ x: Forced.Value, filter: Forced.Value, method: Forced.Flag, sides: Forced.Value, circular: Forced.Flag, init: Forced.Value }) }),
	fn(stats('step'), BuiltInProcName.DefaultReadAllArgs,
		{ tags: [SemanticCallTag.Prints], sig: sig({ object: Forced.Value, scope: Forced.Value, scale: Forced.Value, direction: Forced.Flag, trace: Forced.Flag, steps: Forced.Value, k: Forced.Value }) }),
	fn(stats('median'), BuiltInProcName.DefaultReadAllArgs, { props: CallProp.Pure, sig: sig({ x: Forced.Value, 'na.rm': Forced.Flag, '...': Forced.Value }) },
		{ overrides: true, assumePrimitive: true }),
	fn([...stats('princomp'), Identifier.from(['rmvnorm', 'mvtnorm']), Identifier.from(['randomForest', 'randomForest']), Identifier.from(['rvonmises', 'circular']),
		...Identifier.fromAll('permute', ['permute', 'shuffle', 'shuffleSet']), ...pkg(PkgName.Dplyr, 'sample_n', 'sample_frac')], BuiltInProcName.DefaultReadAllArgs,
	{ ambient: { type: AmbientStateAccessType.DrawRng }, tags: [SemanticCallTag.Random] }, Overrides),
] as const satisfies AnyBuiltInDefinition[];
