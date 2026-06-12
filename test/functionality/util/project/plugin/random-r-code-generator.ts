import { randomString } from '../../../../../src/util/random';

export const validStringSymbols = [
	[
		'a','b','c','x','y','z',
		'A','B','C','X','Y','Z',
		'0','1','2','3','4','5','6','7','8','9',

		'.', ',', ';', ':', '!', '?',
		'-', '_', '+', '*', '/', '=',

		'(', ')', '[', ']', '{', '}',

		'@', '€', '#', '§', '$', '%', '&', '^', '|', '`', '~', '<', '>', '°',

		'ä','ö','ü','ß',
		'Ä','Ö','Ü',
		'é','è','ê',
		'í', 'ì', 'î',
	],
	// eslint-disable-next-line no-useless-escape
	[ '\n','\t','\v','\b','\r','\f','\a','\\','\'','\"', ' ' ],
	[ '😀', '💩' ]
];

export enum RObjectType {
	Literal         = 'literal',
	Vector          = 'vector',
	List            = 'list',
	Map             = 'map',
	Matrix          = 'matrix',
	DataFrame       = 'dataframe',
	Environment     = 'environment',
	Function        = 'function',
	PairList        = 'pairlist',
	Call            = 'call',
	Symbol          = 'symbol',
	Language        = 'language',
	Expression      = 'expression',
	AnonymousFunction = 'anonymous-function',
	Primitive       = 'primitive',
	Promise         = 'promise',
	Factor          = 'factor',
	S4              = 's4',
}

const typesWithoutAttributes = new Set(['symbol', 'promise']);

export class RandomRCodeGenerator {
	private readonly rnd: SeededRandom;

	constructor(rnd: SeededRandom) {
		this.rnd = rnd;
	}

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

	generateObjectOfType(type: RObjectType, nestingLevel: number, maxNestingLevel: number): { value: string, type: string, len: number } {
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
			case RObjectType.Call:              return this.generateCall();
			case RObjectType.Symbol:            return this.generateSymbol();
			case RObjectType.Language:          return this.generateLanguage();
			case RObjectType.Expression:        return this.generateExpression();
			case RObjectType.AnonymousFunction: return this.generateAnonymousFunction();
			case RObjectType.Primitive:         return this.generatePrimitive();
			case RObjectType.Promise:           return this.generatePromise();
			case RObjectType.Factor:            return this.generateFactor(nestingLevel + 1, maxNestingLevel);
			case RObjectType.S4:                return { value: this.generateS4(`tmp_${Date.now()}`), type: 's4', len: 1 };
		}
	}

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

	generateS4(name: string){
		return `setClass("Employee", slots=list(name="character",
                                age="numeric",
                                role="character"))
				${name} <- new("Employee", name = "Sanket",
                        age = 21,
                        role = "Software Developer")`;
	}

	generateObject(nestingLevel: number, maxNestingLevel: number): {value: string, type: string, len: number} {
		if(nestingLevel >= maxNestingLevel){
			return this.generateLiteral();
		}

		const values = Object.values(RObjectType) as RObjectType[];
		const type = this.rnd.pick(values);
		return this.generateObjectOfType(type, nestingLevel, maxNestingLevel);
	}

	generateFactor(nestingLevel: number, maxNestingLevel: number): { value: string, type: string, len: number }  {
		const vector = this.generateVector(nestingLevel, maxNestingLevel);
		return { value: `factor(${vector.value})`, type: 'factor', len: vector.len };
	}

	generateAttribute(name: string): {value: string, len: number} {
		const obj = this.generateLiteral();
		return { value: `attr(${name}, 'attr') <- ${obj.value}`, len: obj.len };
	}

	generatePromise(): { value: string, type: string, len: number } {
		return { value: 'delayedAssign("x", msg)', type: 'promise', len: 1 };
	}

	generatePrimitive(): { value: string, type: string, len: number }  {
		return { value: '.Primitive("sqrt")', type: 'primitive', len: 1 };
	}

	generateAnonymousFunction(): { value: string, type: string, len: number }  {
		return { value: '(function(x, y){ z <- x^2 + y^2; x+y+z })(0:7, 1)', type: 'function', len: 1 }; // need?
	}

	generateExpression(): { value: string, type: string, len: number } {
		return { value: 'expression(1 + 0:9)', type: 'expression', len: 1 };
	}

	generateLanguage(): { value: string, type: string, len: number } {
		return { value: 'quote(1+2)', type: 'language', len: 1 };
	}

	generateSymbol(): { value: string, type: string, len: number } {
		return { value: 'as.name("arrg")', type: 'symbol', len: 1 };
	}

	generateCall(): { value: string, type: string, len: number } {
		return { value: 'call("round",10.5)', type: 'call', len: 1 };
	}

	generatePairList(nestingLevel: number, maxNestingLevel: number): { value: string, type: string, len: number }  {
		const len = this.rnd.int(10);
		const elements = Array.from({ length: len }, () =>
			this.generateObject(nestingLevel + 1, maxNestingLevel).value
		);
		return { value: `pairlist(${elements.join(', ')})`, type: 'pairlist', len: len };
	}

	generateVector(nestingLevel: number, maxNestingLevel: number): { value: string, type: string, len: number } {
		const len = this.rnd.int(10);
		const elements = Array.from({ length: len }, () =>
			this.generateObject(nestingLevel + 1, maxNestingLevel).value
		);
		return { value: `c(${elements.join(', ')})`, type: 'vector', len: len };
	}

	generateList(nestingLevel: number, maxNestingLevel: number, length?: number): { value: string, type: string, len: number } {
		const len = length || this.rnd.int(10);
		const elements = Array.from({ length: len }, () =>
			this.generateObject(nestingLevel + 1, maxNestingLevel).value
		);
		return { value: `list(${elements.join(', ')})`, type: 'list', len: len };
	}

	generateMap(nestingLevel: number, maxNestingLevel: number): { value: string, type: string, len: number } {
		const len = this.rnd.int(10);
		const elements = Array.from({ length: len }, (_, i) => {
			const key = `key_${i}`;
			const { value, type: _type } = this.generateObject(nestingLevel + 1, maxNestingLevel);
			return `${key} = ${value}`;
		});
		return { value: `list(${elements.join(', ')})`, type: 'Map', len: len };
	}

	generateMatrix(maxNestingLevel: number): { value: string, type: string, len: number } {
		const rows = this.rnd.int(3) + 1;
		const cols = this.rnd.int(3) + 1;
		const elements = this.generateList(maxNestingLevel - 1, maxNestingLevel, rows);
		const byRow = this.rnd.pick(['TRUE', 'FALSE']);
		return { value: `matrix(c(${elements.value}), nrow = ${rows}, ncol = ${cols}, byrow = ${byRow})`, type: 'matrix', len: elements.len };
	}

	generateDataFrame(): { value: string, type: string, len: number } {
		const nRows = this.rnd.int(10);
		const nCols = this.rnd.int(10);
		const cols = Array.from({ length: nCols }, (_, i) => {
			const type = this.rnd.pick(['integer', 'double', 'logical', 'character']);
			const vals = Array.from({ length: nRows }, () => this.generateTypedLiteral(type).value);
			return `col_${i} = c(${vals.join(', ')})`;
		});
		return { value: `data.frame(${cols.join(', ')})`, type: 'dataframe', len: nCols };
	}

	generateEnvironmentExpr(): { value: string, type: string, len: number } {
		const value = this.rnd.pick([
			'new.env()',
			'new.env(parent = emptyenv())',
			'globalenv()',
			'baseenv()',
			'emptyenv()',
		]);
		return { value: value, type: 'environment', len: 1 };
	}

	generateFunction(nestingLevel: number, maxNestingLevel: number): { value: string, type: string, len: number } {
		const args = Array.from({ length: this.rnd.int(3) }, (_, i) => `arg${i}`).join(', ');
		const body = this.generateObject(nestingLevel + 1, maxNestingLevel);
		return { value: `function(${args}) { ${body.value} }`, type: 'function', len: body.len };
	}

	generateTypedLiteral(type: string): { value: string, type: string, len: number } {
		switch(type) {
			case 'integer':   {
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

	generateString(): {value: string, type: string, len: number } {
		const len = this.rnd.int(50);

		const weights = [70, 20, 10];
		const total = weights.reduce((a, b) => a + b, 0);

		const pickIndex = () => {
			const r = this.rnd.int(total);
			for(let i = 0; i < weights.length; i++) {
				if(r < weights[i]) {
					return i;
				}
			}
		};

		const elements = Array.from({ length: len }, () =>
			randomString(1, validStringSymbols[pickIndex() as number])
				.replaceAll('\\', '\\\\')
				.replaceAll('"', String.raw`\"`)
		).join('');
		return {
			value: `"${elements}"`,
			type:  'character',
			len:   elements.length,
		};
	}

	generateLiteral(): { value: string, type: string, len: number } {
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

	generateDouble(): { value: string, type: string, len: number } {
		return this.rnd.pick([
			() => {
				const value = (this.rnd.int(10000) / 100 - 50).toFixed(this.rnd.int(10));
				return { value: `${value}`, type: 'double', len: value.length };
			},
			() => {
				const value = this.rnd.int(1e10);
				return { value: `${value}`, type: 'double', len: Math.ceil(Math.log10(value + 1)) };
			},
			() =>{
				const value = `${(this.rnd.int(999))}.${this.rnd.int(999)}e${this.rnd.pick(['+', '-'])}${this.rnd.int(10)}`;
				return { value: `${value}`, type: 'double', len: value.length };
			},
		])();
	}
}

export class SeededRandom {
	constructor(private readonly rng: () => number) {}

	int(max: number) {
		return Math.floor(this.rng() * max);
	}

	pick<T>(arr: T[]) {
		return arr[this.int(arr.length)];
	}
}