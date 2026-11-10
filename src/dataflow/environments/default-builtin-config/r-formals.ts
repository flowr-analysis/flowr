import type { BuiltInDefinition, BuiltInDefinitions } from '../built-in-config';
import { Identifier, PkgName, type BrandedIdentifier } from '../identifier';
import { ArgProp, type ArgProps, type FnSig } from '../built-in-props';
import { RFormals } from '../../../data/r-formals.generated';

/** The formals R renamed or flowR names differently, as `package::name -> stated formal -> formal of R`, so the roles stated for it stay on it. */
const Renamed: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	'base::serverSocket':          { host: 'port' },
	'base::transform':             { x: '_data' },
	'grDevices::col2rgb':          { x: 'col' },
	'grDevices::adjustcolor':      { x: 'col' },
	'grDevices::colorRampPalette': { x: 'colors' },
	'grDevices::colorRamp':        { x: 'colors' },
	'curl::nslookup':              { url: 'host' },
	'data.table::setalloccol':     { x: 'DT' },
	'DBI::dbCreateTable':          { value: 'fields' },
	'RSQLite::dbCreateTable':      { value: 'fields' },
	'foreign::read.ssd':           { file: 'libname' },
	'foreign::write.foreign':      { file: 'datafile' },
	'googledrive::drive_get':      { file: 'path' },
	'haven::read_sas':             { file: 'data_file' },
	'haven::write_dta':            { file: 'path' },
	'haven::write_sas':            { file: 'path' },
	'haven::write_sav':            { file: 'path' },
	'haven::write_xpt':            { file: 'path' },
	'shiny::runGist':              { url: 'gist' },
	'yaml::yaml.load_file':        { file: 'input' }
};

/** Functions handing their `...` on to another of the package, whose formals they do not declare themselves take its place (`write.csv(x, file)` matches those of `write.table`). */
export const ForwardedTo: Readonly<Record<string, string>> = {
	'data.table::setindex': 'setkey',
	'knitr::knit_child':    'knit',
	'knitr::purl':          'knit',
	'utils::write.csv':     'write.table',
	'utils::write.csv2':    'write.table'
};

/** Whether the name is a plain function name, as the operators and syntax of the language state what they are for themselves. */
const Named = /^[A-Za-z.]/;

/** The formals R declares for `pkg::name`, if the package was installed when {@link RFormals} was generated and exports a function of that name. */
function declaredFormals(pkg: string, name: string): readonly BrandedIdentifier[] | undefined {
	const formals = RFormals[pkg]?.[name];
	return formals === undefined ? undefined : formals === '' ? [] : formals.split(',');
}

/** The formals the arguments of `pkg::name` are matched against: those R declares, the {@link ForwardedTo} ones in place of its `...`. */
export function formalsOfR(pkg: string, name: string): readonly BrandedIdentifier[] | undefined {
	const own = declaredFormals(pkg, name);
	const to = ForwardedTo[`${pkg}::${name}`];
	const target = to === undefined ? undefined : declaredFormals(pkg, to);
	return own === undefined || target === undefined ? own : own.flatMap(formal => formal === '...' ? target.filter(t => t === '...' || !own.includes(t)) : [formal]);
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

/** The functions of R a definition names: a replacement is the function `name<-` (`name<<-` calls the same one). */
export function functionsOfR(def: BuiltInDefinition): Identifier[] {
	switch(def.type) {
		case 'function':
			return def.names;
		case 'replacement':
			return def.names.map(id => Identifier.make(`${Identifier.getName(id)}<-`, Identifier.getNamespace(id)));
		default:
			return [];
	}
}

/** The formals {@link markFormals} gives the function, `undefined` where R's are unknown and the stated ones stay. */
function markedFormalsOf(id: Identifier): readonly BrandedIdentifier[] | undefined {
	const name = String(Identifier.getName(id));
	return Named.test(name) ? formalsOfR(String(Identifier.getNamespace(id) ?? PkgName.Base), name) : undefined;
}

/**
 * The definitions with the formals R declares, the roles stated before kept by name: a stated `sig` only contributes what each formal is used for.
 * A definition naming several functions with different formals is split by them, one whose formals R does not tell keeps what it states.
 */
export function markFormals(definitions: BuiltInDefinitions): BuiltInDefinitions {
	return definitions.flatMap((def): BuiltInDefinitions => {
		/* a replacement call hands its value on last and unnamed (`body<-`(f, v)), so R's formals (`fun, envir, value`) would bind it by position to the wrong one */
		if(def.type !== 'function') {
			return [def];
		}
		const groups = new Map<string | undefined, Identifier[]>();
		for(const id of def.names as readonly Identifier[]) {
			const key = markedFormalsOf(id)?.join(',');
			groups.set(key, [...groups.get(key) ?? [], id]);
		}
		if(groups.size === 1 && groups.has(undefined)) {
			return [def];
		}
		return [...groups].map(([key, names]) => {
			if(key === undefined) {
				return { ...def, names };
			}
			const [first] = names;
			const sig = withFormalsOf(String(Identifier.getNamespace(first) ?? PkgName.Base), String(Identifier.getName(first)), key === '' ? [] : key.split(','), def.config?.sig);
			return { ...def, names, config: { ...def.config, sig } };
		});
	});
}
