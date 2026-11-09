import type { BuiltInDefinitions } from '../built-in-config';
import { Identifier, PkgName, type BrandedIdentifier } from '../identifier';
import { ArgProp, type ArgProps, type FnSig } from '../built-in-props';
import { RBaseFormals } from '../../../data/r-base-formals.generated';

/** The formals R renamed or flowR names differently, as `package::name -> stated formal -> formal of R`, so the roles stated for it stay on it. */
const Renamed: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	'base::serverSocket':          { host: 'port' },
	'base::transform':             { x: '_data' },
	'grDevices::col2rgb':          { x: 'col' },
	'grDevices::adjustcolor':      { x: 'col' },
	'grDevices::colorRampPalette': { x: 'colors' },
	'grDevices::colorRamp':        { x: 'colors' }
};

/** Functions declaring only `...` that hand it on to another, whose formals the arguments are matched against (`write.csv(x, file)`). */
export const ForwardedTo: Readonly<Record<string, string>> = {
	'utils::write.csv':  'write.table',
	'utils::write.csv2': 'write.table'
};

/** Whether the name is a plain function name, as the operators and syntax of the language state what they are for themselves. */
const Named = /^[A-Za-z.]/;

/** R's formals of `name` in the package, if the base packages declare any. */
export function formalsOfR(pkg: string, name: string): readonly BrandedIdentifier[] | undefined {
	const formals = Named.test(name) ? RBaseFormals[pkg]?.[ForwardedTo[`${pkg}::${name}`] ?? name] : undefined;
	return formals === undefined ? undefined : formals.split(',');
}

/**
 * The signature naming exactly the formals R declares. A formal keeps what `stated` says of it, one it did not name takes
 * what its `...` claimed for every such argument (the first alias aside), and without either claims nothing.
 */
function withFormalsOf(pkg: string, name: string, formals: readonly BrandedIdentifier[], stated: FnSig | undefined): FnSig {
	const renamed = Renamed[`${pkg}::${name}`] ?? {};
	const roles = new Map<BrandedIdentifier, ArgProps>(stated?.map(([formal, props]) => [renamed[String(formal)] ?? String(formal), props] as const));
	const rest = roles.get('...') ?? 0;
	return formals.map((formal, at) => [formal, roles.get(formal) ?? (at === 0 ? rest : rest & ~ArgProp.Alias)]);
}

/** The definitions of the base packages with the formals R declares, the roles stated before kept by name. A definition naming several functions with different formals is split by them. */
export function markFormals(definitions: BuiltInDefinitions): BuiltInDefinitions {
	return definitions.flatMap((def): BuiltInDefinitions => {
		if(def.type !== 'function') {
			return [def];
		}
		const groups = new Map<string, Identifier[]>();
		for(const id of def.names as readonly Identifier[]) {
			const formals = formalsOfR(String(Identifier.getNamespace(id) ?? PkgName.Base), String(Identifier.getName(id)));
			const key = formals?.join(',') ?? '';
			groups.set(key, [...groups.get(key) ?? [], id]);
		}
		if(groups.size === 1 && groups.has('')) {
			return [def];
		}
		return [...groups].map(([key, names]) => {
			if(key === '') {
				return { ...def, names };
			}
			const [first] = names;
			const sig = withFormalsOf(String(Identifier.getNamespace(first) ?? PkgName.Base), String(Identifier.getName(first)), key.split(','), def.config?.sig);
			return { ...def, names, config: { ...def.config, sig } };
		});
	});
}
