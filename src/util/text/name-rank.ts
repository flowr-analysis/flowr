/**
 * What a reader most likely meant when typing a name: a well-used package first, base R ahead of CRAN, and
 * the things one rarely reaches for last, which are S3 methods, `%operators%`, and names starting with a dot.
 *
 * The signature browser and the playground's completion both offer names out of the same database, so they
 * order them with the same {@link rankName}, and what one of them learns the other one knows.
 */
export interface NameRankInput {
	/** the name being offered */
	readonly name:       string;
	/** what was typed, empty when nothing was */
	readonly needle:     string;
	/** how far down the fuzzy match sits, `0` being the closest; `0` when nothing was typed */
	readonly rank?:      number;
	/** how often the owning package was downloaded, `0` when unknown */
	readonly downloads?: number;
	/** the owning package ships with R */
	readonly baseR?:     boolean;
	/** the owning package is `base` itself */
	readonly base?:      boolean;
	/** flowR carries a definition of its own for the name, so it is one people actually call */
	readonly known?:     boolean;
	/** the name is an S3 method, like `print.foo` */
	readonly s3?:        boolean;
	/** the name holds a value rather than a function */
	readonly variable?:  boolean;
}

/**
 * Every rule beyond the match itself, as `points` and when they apply. A list rather than a run of
 * conditions, so a rule can be read, weighed against its neighbours, or added without touching the rest.
 */
const Adjustments: readonly (readonly [points: number, when: (of: NameRankInput) => boolean])[] = [
	/*
	 * What was typed, exactly, always comes first, and the bonus is large enough to mean it: everything else
	 * together (a known name in base R, well downloaded, one place closer in the match) is worth about 1600,
	 * so typing `Sin` used to be answered with base R's `sin` first. Several packages exporting the same exact
	 * name all earn it, so the rules below still decide which of them leads.
	 * The same spelling in another case comes next.
	 */
	[3000, ({ name, needle }) => name === needle],
	[900, ({ name, needle }) => name !== needle && name.toLowerCase() === needle.toLowerCase()],
	/* a real function from base R is what a reader usually means; a lone symbol almost never is */
	[40, ({ name, baseR }) => baseR === true && name.length >= 3],
	[-20, ({ variable }) => variable === true],
	[-40, ({ name }) => name.length < 3],
	/* `names<-` is the replacement form of `names`, and nobody reaches for it first */
	[-35, ({ name }) => name.endsWith('<-')],
	[-45, ({ name, needle }) => name.includes('.') && !needle.includes('.')],
	/* `base` itself before the packages that merely ship with R */
	[20, ({ base }) => base === true],
	/* a name flowR recognises outranks a closer spelling it knows nothing about: typing `plot` should
	   offer `ggplot` before `plotH`, because one of them is a function people actually call */
	[500, ({ known }) => known === true],
	[-30, ({ s3 }) => s3 === true],
	/* operators, punctuation, and SHOUTING names are rarely what someone is looking for */
	[-60, ({ name }) => /^%.*%$/.test(name) || /^[^\w.]/.test(name)],
	[-30, ({ name, needle }) => name === name.toUpperCase() && /[A-Z]/.test(name) && name !== needle],
	[-400, ({ name }) => name.startsWith('.')]
];

/** The points {@link NameRankInput} earns, higher being offered first. */
export function rankName(of: NameRankInput): number {
	const { name, needle, rank = 0, downloads = 0 } = of;
	/* how well it matches comes first, then how short it is; popularity only settles what is left.
	   Length only matters against something typed: with an empty box it would rank `AIC` above `mean` */
	const match = -rank * 150 - (needle ? name.length * 12 : 0)
		+ Math.min(Math.log10(downloads + 10), 8) * (needle ? 4 : 12);
	return Adjustments.reduce((points, [worth, when]) => when(of) ? points + worth : points, match);
}
