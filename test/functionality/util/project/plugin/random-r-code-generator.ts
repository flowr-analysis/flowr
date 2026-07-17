import { randomString } from '../../../../../src/util/random';

/**
 * Pools of symbols used by {@link RandomRCodeGenerator.generateString} to build random R strings.
 */
export const validStringSymbols = [
	Array.from({ length: 223 }, (_, i) => String.fromCharCode(32 + i)),
	[ '\n', '\t', '\v', '\b', '\r', '\f', '\x07', '\\', '\'', '"', ' ' ],
	[ '😀', '💩' ]
];

/**
 * Kinds of R objects {@link RandomRCodeGenerator} can 'generate'.
 */
export enum RObjectType {
	Literal           = 'literal',
	Vector            = 'vector',
	List              = 'list',
	Map               = 'map',
	Matrix            = 'matrix',
	DataFrame         = 'dataframe',
	Environment       = 'environment',
	Function          = 'function',
	PairList          = 'pairlist',
	Call              = 'call',
	Symbol            = 'symbol',
	Language          = 'language',
	Expression        = 'expression',
	AnonymousFunction = 'anonymous-function',
	Primitive         = 'primitive',
	Promise           = 'promise',
	Factor            = 'factor',
	S4                = 's4',
}

/**
 * The result of generating a single R object.
 */
export interface GeneratedRObject {
	readonly value: string;
	readonly type:  string;
	readonly len:   number;
}

/**
 * {@link RObjectType}s for which generating an attribute is not possible.
 */
/* R refuses to attach an attribute to a builtin, so generating one would only fail the whole script */
const typesWithoutAttributes = new Set(['symbol', 'promise', 'primitive']);

/**
 * Constant pool of fixed R object definitions used by {@link RandomRCodeGenerator}.
 */
const FixedRObjects = {
	promise:           { value: 'delayedAssign("x", 1L)',                            type: 'promise',    len: 1 },
	primitive:         { value: '.Primitive("sqrt")',                                type: 'primitive',  len: 1 },
	anonymousFunction: { value: '(function(x, y){ z <- x^2 + y^2; x+y+z })(0:7, 1)', type: 'function',   len: 1 },
	expression:        { value: 'expression(1 + 0:9)',                               type: 'expression', len: 1 },
	language:          { value: 'quote(1+2)',                                        type: 'language',   len: 1 },
	symbol:            { value: 'as.name("arrg")',                                   type: 'symbol',     len: 1 },
	call:              { value: 'call("round",10.5)',                                type: 'call',       len: 1 },
} as const;

/**
 * Generates random R code (literals, vectors, lists, functions, environments, S4 objects, ...).
 * @example
 * ```ts
 * const rnd = new SeededRandom(seedrandom('my-seed'));
 * const rcg = new RandomRCodeGenerator(rnd);
 * const { rCode, vars } = rcg.generateRCodeWithTypes([RObjectType.Vector, RObjectType.Function]);
 * // rCode now contains R source defining var_0 (a vector) and var_1 (a function)
 * ```
 */
export class RandomRCodeGenerator {
	private readonly rnd: SeededRandom;

	constructor(rnd: SeededRandom) {
		this.rnd = rnd;
	}

	/**
	 * Generates `numberOfObjects` random R variable definitions with the name scheme `var_0`, `var_1`, ...,
	 * Each variable a randomly chosen object type and (with some probability) a random attribute is assigned.
	 * @param numberOfObjects  - How many top-level variables to generate.
	 * @param maxNestingLevel  - Maximum recursion depth for nested object types (e.g. a list of vectors).
	 * @returns The generated R source code (`rCode`) and the list of variable names it defines (`vars`).
	 */
	generateRCode(numberOfObjects: number, maxNestingLevel: number) {
		const codeMap = new Map<string, string>();
		const vars: string[] = [];

		for(let i = 0; i < numberOfObjects; i++) {
			const name = `var_${i}`;

			const rnd = this.rnd.int(100);

			let code = '';

			if(rnd < 80){
				const operator = this.rnd.pick(['<-', '=', '<<-']);
				const { value, type, len } = this.generateObject(0, maxNestingLevel);
				code = `${name} ${operator} ${value}`;

				if(!(value === null || len === 0 || typesWithoutAttributes.has(type))) {
					const attribute = this.rnd.pick([
						() => this.generateAttribute(name),
						() => ({ value: `class(${name}) <- "foo"` }),
						() => ({ value: '' }),
					])();
					code = `${code}\n${attribute.value}`;
				}
			} else {
				code += this.generateS4(name);
			}

			codeMap.set(name, code);
			vars.push(name);
		}

		const rCode = Array.from(codeMap.values()).join('\n');

		return {
			rCode,
			vars
		};
	}

	/**
	 * Generates R source for a single object of the given {@link RObjectType}.
	 * @param type            - The kind of object to generate.
	 * @param nestingLevel    - Current recursion depth (used to bound nested generation).
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R expression (`value`), its R type name (`type`), and its length/size (`len`).
	 */
	generateObjectOfType(type: RObjectType, nestingLevel: number, maxNestingLevel: number): GeneratedRObject {
		switch(type) {
			case RObjectType.Literal:           return this.generateLiteral();
			case RObjectType.Vector:            return this.generateVector(nestingLevel + 1, maxNestingLevel);
			case RObjectType.List:              return this.generateList(nestingLevel + 1, maxNestingLevel);
			case RObjectType.Map:               return this.generateMap(nestingLevel + 1, maxNestingLevel);
			case RObjectType.Matrix:            return this.generateMatrix(maxNestingLevel);
			case RObjectType.DataFrame:         return this.generateDataFrame();
			case RObjectType.Environment:       return this.generateEnvironmentExpr();
			case RObjectType.Function:          return this.generateFunction(nestingLevel + 1, maxNestingLevel);
			case RObjectType.PairList:          return this.generatePairList(nestingLevel + 1, maxNestingLevel);
			case RObjectType.Call:              return FixedRObjects.call;
			case RObjectType.Symbol:            return FixedRObjects.symbol;
			case RObjectType.Language:          return FixedRObjects.language;
			case RObjectType.Expression:        return FixedRObjects.expression;
			case RObjectType.AnonymousFunction: return FixedRObjects.anonymousFunction;
			case RObjectType.Primitive:         return FixedRObjects.primitive;
			case RObjectType.Promise:           return FixedRObjects.promise;
			case RObjectType.Factor:            return this.generateFactor(nestingLevel + 1, maxNestingLevel);
			case RObjectType.S4:                return { value: this.generateS4(`tmp_${Date.now()}`), type: 's4', len: 1 };
		}
	}

	/**
	 * Generates one variable definition per entry in `types`, in order.
	 * @param types           - The {@link RObjectType} to generate for each variable, in order.
	 * @param maxNestingLevel - Maximum recursion depth for nested object types.
	 * @returns The generated R source code (`rCode`) and the list of variable names it defines (`vars`).
	 */
	generateRCodeWithTypes(types: RObjectType[], maxNestingLevel = 1) {
		const codeMap = new Map<string, string>();
		const vars: string[] = [];

		for(let i = 0; i < types.length; i++) {
			const name = `var_${i}`;
			const { value } = this.generateObjectOfType(types[i], 0, maxNestingLevel);
			codeMap.set(name, `${name} <- ${value}`);
			vars.push(name);
		}

		return {
			rCode: Array.from(codeMap.values()).join('\n'),
			vars
		};
	}

	/**
	 * Generates a fixed S4 class (`Employee`) and an instance of it assigned to `name`.
	 * @param name - The variable name the new S4 instance should be assigned to.
	 * @returns R source code.
	 */
	generateS4(name: string){
		return `setClass("Employee", slots=list(name="character",
                                age="numeric",
                                role="character"))
				${name} <- new("Employee", name = "Sanket",
                        age = 21,
                        role = "Software Developer")`;
	}

	/**
	 * Generates a random object, picking its {@link RObjectType} uniformly at random.
	 * @param nestingLevel    - Current recursion depth.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R object.
	 */
	generateObject(nestingLevel: number, maxNestingLevel: number): GeneratedRObject {
		if(nestingLevel >= maxNestingLevel){
			return this.generateLiteral();
		}

		const values = Object.values(RObjectType) as RObjectType[];
		const type = this.rnd.pick(values);
		return this.generateObjectOfType(type, nestingLevel, maxNestingLevel);
	}

	/**
	 * Generates a `factor(...)` wrapping a random vector.
	 * @param nestingLevel    - Current recursion depth.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R object.
	 */
	generateFactor(nestingLevel: number, maxNestingLevel: number): GeneratedRObject {
		const vector = this.generateVector(nestingLevel, maxNestingLevel);
		return { value: `factor(${vector.value})`, type: 'factor', len: vector.len };
	}

	/**
	 * Generates an attribute to the given R object.
	 * @param name - Name of variable the attribute is added to.
	 * @returns The generated R source code (`value`) and the length of the object (`len`).
	 */
	generateAttribute(name: string): { value: string, len: number } {
		const obj = this.generateLiteral();
		return { value: `attr(${name}, 'attr') <- ${obj.value}`, len: obj.len };
	}

	/**
	 * Generates a pairlist.
	 * @param nestingLevel    - Current recursion depth.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R object.
	 */
	generatePairList(nestingLevel: number, maxNestingLevel: number): GeneratedRObject {
		const len = this.rnd.int(10);
		const elements = Array.from({ length: len }, () =>
			this.generateObject(nestingLevel + 1, maxNestingLevel).value
		);
		return { value: `pairlist(${elements.join(', ')})`, type: 'pairlist', len };
	}

	/**
	 * Generates a vector.
	 * @param nestingLevel    - Current recursion depth.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R object.
	 */
	generateVector(nestingLevel: number, maxNestingLevel: number): GeneratedRObject {
		const len = this.rnd.int(10);
		const elements = Array.from({ length: len }, () =>
			this.generateObject(nestingLevel + 1, maxNestingLevel).value
		);
		return { value: `c(${elements.join(', ')})`, type: 'vector', len };
	}

	/**
	 * Generates a list.
	 * @param nestingLevel    - Current recursion depth.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @param length          - (optional) Size of the generated list.
	 * @returns The generated R object.
	 */
	generateList(nestingLevel: number, maxNestingLevel: number, length?: number): GeneratedRObject {
		const len = length ?? this.rnd.int(10);
		const elements = Array.from({ length: len }, () =>
			this.generateObject(nestingLevel + 1, maxNestingLevel).value
		);
		return { value: `list(${elements.join(', ')})`, type: 'list', len };
	}

	/**
	 * Generates a map (named list).
	 * @param nestingLevel    - Current recursion depth.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R object.
	 */
	generateMap(nestingLevel: number, maxNestingLevel: number): GeneratedRObject {
		const len = this.rnd.int(10);
		const elements = Array.from({ length: len }, (_, i) => {
			const key = `key_${i}`;
			const { value } = this.generateObject(nestingLevel + 1, maxNestingLevel);
			return `${key} = ${value}`;
		});
		return { value: `list(${elements.join(', ')})`, type: 'map', len };
	}

	/**
	 * Generates a matrix.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R object.
	 */
	generateMatrix(maxNestingLevel: number): GeneratedRObject {
		const rows = this.rnd.int(3) + 1;
		const cols = this.rnd.int(3) + 1;
		const len = rows * cols;
		const elements = this.generateList(maxNestingLevel - 1, maxNestingLevel, len);
		const byRow = this.rnd.pick(['TRUE', 'FALSE']);
		return { value: `matrix(c(${elements.value}), nrow = ${rows}, ncol = ${cols}, byrow = ${byRow})`, type: 'matrix', len };
	}

	/**
	 * Generates a data frame.
	 * @returns The generated R object.
	 */
	generateDataFrame(): GeneratedRObject {
		const nRows = this.rnd.int(10);
		const nCols = this.rnd.int(10);
		const cols = Array.from({ length: nCols }, (_, i) => {
			const type = this.rnd.pick(['integer', 'double', 'logical', 'character']);
			const vals = Array.from({ length: nRows }, () => this.generateTypedLiteral(type).value);
			return `col_${i} = c(${vals.join(', ')})`;
		});
		return { value: `data.frame(${cols.join(', ')})`, type: 'dataframe', len: nCols };
	}

	/**
	 * Generates an environment expression.
	 * @returns The generated R object.
	 */
	generateEnvironmentExpr(): GeneratedRObject {
		const value = this.rnd.pick([
			'new.env()',
			'new.env(parent = emptyenv())',
			'globalenv()',
			'baseenv()',
			'emptyenv()',
		]);
		return { value, type: 'environment', len: 1 };
	}

	/**
	 * Generates a function.
	 * @param nestingLevel    - Current recursion depth.
	 * @param maxNestingLevel - Maximum recursion depth allowed.
	 * @returns The generated R object.
	 */
	generateFunction(nestingLevel: number, maxNestingLevel: number): GeneratedRObject {
		const args = Array.from({ length: this.rnd.int(3) }, (_, i) => `arg${i}`).join(', ');
		const body = this.generateObject(nestingLevel + 1, maxNestingLevel);
		return { value: `function(${args}) { ${body.value} }`, type: 'function', len: body.len };
	}

	/**
	 * Generates a single literal value of the given primitive R type.
	 * @param type - The primitive R type name to generate a literal for.
	 * @returns The generated R object.
	 */
	generateTypedLiteral(type: string): GeneratedRObject {
		switch(type) {
			case 'integer': {
				const obj = this.rnd.int(1000);
				return { value: `${obj}L`, type: 'integer', len: Math.ceil(Math.log10(obj + 1)) };
			}
			case 'double':    return this.generateDouble();
			case 'logical':   return { value: this.rnd.pick(['TRUE', 'FALSE', 'NA']), type: 'logical', len: 1 };
			case 'character': return this.generateString();
			case 'complex':   return { value: `${this.generateDouble().value}+${this.generateDouble().value}i`, type: 'complex', len: 1 };
			case 'raw':       return { value: `as.raw(0x${this.rnd.int(256).toString(16).padStart(2, '0')})`, type: 'raw', len: 1 };
			default:          return { value: 'NULL', type: 'NULL', len: 1 };
		}
	}

	/**
	 * Generates a random string literal.
	 * Uses {@link validStringSymbols}.
	 * @returns The generated R object.
	 */
	generateString(): GeneratedRObject {
		const len = this.rnd.int(50);

		const weights = [70, 20, 10];
		const total = weights.reduce((a, b) => a + b, 0);

		const pickIndex = () => {
			let r = this.rnd.int(total);
			for(let i = 0; i < weights.length; i++) {
				r -= weights[i];
				if(r < 0) {
					return i;
				}
			}
			return weights.length - 1;
		};

		const elements = Array.from({ length: len }, () =>
			randomString(1, validStringSymbols[pickIndex()])
				.replaceAll('\\', '\\\\')
				.replaceAll('"', String.raw`\"`)
		).join('');
		return {
			value: `"${elements}"`,
			type:  'character',
			len:   elements.length,
		};
	}

	/**
	 * Generates a random literal.
	 * @returns The generated R object.
	 */
	generateLiteral(): GeneratedRObject {
		return this.rnd.pick([
			() => ({ value: `${this.rnd.pick(['NA_integer_', 'NA_real_', 'NA_complex_', 'NA_character_', 'Inf', '-Inf', 'NaN'])}`, type: 'NaTypes', len: 1 }),
			() => this.generateTypedLiteral('logical'),
			() => this.generateTypedLiteral('integer'),
			() => this.generateTypedLiteral('double'),
			() => this.generateTypedLiteral('complex'),
			() => this.generateTypedLiteral('character'),
			() => this.generateTypedLiteral('raw'),
		])();
	}

	/**
	 * Generates a random double literal.
	 * @returns The generated R object.
	 */
	generateDouble(): GeneratedRObject {
		return this.rnd.pick([
			() => {
				const value = (this.rnd.int(10000) / 100 - 50).toFixed(this.rnd.int(10));
				return { value: `${value}`, type: 'double', len: value.length };
			},
			() => {
				const value = this.rnd.int(1e10);
				return { value: `${value}`, type: 'double', len: Math.ceil(Math.log10(value + 1)) };
			},
			() => {
				const value = `${(this.rnd.int(999))}.${this.rnd.int(999)}e${this.rnd.pick(['+', '-'])}${this.rnd.int(10)}`;
				return { value: `${value}`, type: 'double', len: value.length };
			},
		])();
	}
}

/**
 * Helper class to wrap around a `() => number` RNG
 * for generating bounded random integers and picking random array elements.
 */
export class SeededRandom {
	/**
	 * @param rng - A function returning a random float in `[0, 1)`.
	 */
	constructor(private readonly rng: () => number) {}

	/**
	 * Generates a random number.
	 * @param max - maximum size of the number.
	 * @returns a random integer in `[0, max)`.
	 */
	int(max: number) {
		return Math.floor(this.rng() * max);
	}

	/**
	 * Generates a random element from a given array.
	 * @param arr - the array to pick from.
	 * @returns a random element.
	 */
	pick<T>(arr: T[]) {
		return arr[this.int(arr.length)];
	}
}