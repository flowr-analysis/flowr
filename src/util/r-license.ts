import type { Range } from 'semver';
import { assertUnreachable, guard } from './assert';
import { compactRecord } from './objects';
import { parseRRange } from './r-version';

export interface RLicenseInfo {
	type:               'license',
	license:            string
	versionConstraint?: Range
}

export interface RLicenseExceptionInfo {
	type:      'exception',
	exception: string
}

export interface RLicenseCombinationInfo {
	type:        'combination',
	combination: 'and' | 'or' | 'with'
	elements:    [left: RLicenseElementInfo, right: RLicenseElementInfo]
}

export interface NoLicenseInfo {
	type: 'no-license';
}

/**
 * The structured representation of an R license element.
 * This can be a license, an exception, a combination of licenses, or no license.
 * @see {@link parseRLicense} and {@link stringifyRLicense} to parse and stringify R license strings.
 */
export type RLicenseElementInfo = RLicenseInfo | RLicenseExceptionInfo | RLicenseCombinationInfo | NoLicenseInfo;

/**
 * Parses an R license string into its structured representation.
 */
export function parseRLicense(licenseString: string): RLicenseElementInfo {
	return parseLicenseInfo(skipWhitespace({ position: 0, remInput: licenseString })).element;
}

/**
 * Stringifies an R license element back into its string representation.
 */
export function stringifyRLicense(license: RLicenseElementInfo): string {
	const t = license.type;
	switch(t) {
		case 'no-license':
			return 'NO LICENSE';
		case 'license':
			return license.versionConstraint ? `${license.license} (${license.versionConstraint.raw})` : license.license;
		case 'exception':
			return `with ${license.exception}`;
		case 'combination': {
			const left = stringifyRLicense(license.elements[0]);
			const right = stringifyRLicense(license.elements[1]);
			const leftStr = license.elements[0].type === 'combination' ? `(${left})` : left;
			const rightStr = license.elements[1].type === 'combination' ? `(${right})` : right;
			return `${leftStr} ${license.combination} ${rightStr}`;
		}
		default:
			assertUnreachable(t);
	}
}

interface ParserInfo {
	position: number;
	remInput: string;
}

type ParserResult<Element = RLicenseElementInfo> = ParserInfo & { element: Element };

function parseLicenseInfo(info: ParserInfo): ParserResult {
	info = skipWhitespace(info);
	if(info.remInput.length === 0) {
		return { ...info, element: { type: 'no-license' } };
	} else if(info.remInput.startsWith('(')) {
		return parseParenthesizedExpression(info);
	} else {
		return parseBinaryOperator(info);
	}
}

function parseParenthesizedExpression(info: ParserInfo): ParserResult {
	const openParen = consumeString(info, '(');
	guard(openParen.element, `Expected (, but found ${info.remInput[0]} at position ${info.position}`);
	const innerInfo = parseLicenseInfo(openParen);
	const closeParen = consumeString(innerInfo, ')');
	guard(closeParen.element, `Expected ), but found ${innerInfo.remInput[0]} at position ${innerInfo.position}`);
	return { ...closeParen, element: innerInfo.element };
}

function skipWhitespace({ remInput, position }: ParserInfo): ParserInfo {
	let idx = remInput.search(/\S/);
	if(idx === -1) {
		idx = remInput.length;
	}
	position += idx;
	remInput = remInput.slice(idx);
	return { position, remInput };
}

function consumeLicenseName(info: ParserInfo): ParserResult<string>  {
	info = skipWhitespace(info);
	let licenseName = '';
	let isAtWhitespace = false;
	for(let i = 0; i < info.remInput.length; i++) {
		const char = info.remInput[i];
		if(/[()<>~!=,&|+]/.test(char)) {
			break;
		} else {
			isAtWhitespace = /\s/.test(char);
		}
		if(isAtWhitespace) {
			if(/^\s*(with|and|or)\s+/i.test(info.remInput.slice(i))) {
				break;
			}
		}
		licenseName += char;
	}
	const newInfo = {
		position: info.position + licenseName.length,
		remInput: info.remInput.slice(licenseName.length)
	};
	// file licenses are a special case!
	if(licenseName && /^file[\s-]+license$/i.test(licenseName.trim())) {
		return { ...newInfo, element: 'file LICENSE' };
	}
	return { ...newInfo, element: licenseName?.trim() ?? '' };
}

function makeRange(rangeStr: string): Range | undefined {
	try {
		return parseRRange(rangeStr);
	} catch{
		return undefined;
	}
}

function parseLicenseElement(info: ParserInfo): ParserResult {
	const licenseName = consumeLicenseName(info);
	info = skipWhitespace(licenseName);
	// may be followed by version constraint in parentheses or directly
	let versionConstraint: Range | undefined;
	if(/^\(\s*?[\d<>=!~]/.test(info.remInput)) {
		// version constraint
		if(info.remInput.startsWith('(')) {
			const openParen = consumeString(info, '(');
			guard(openParen.element, `Expected (, but found ${info.remInput[0]} at position ${info.position}`);
			info = skipWhitespace(openParen);
			// consume until closing parenthesis
			const versionStr = consumeUntilString(info, ')');
			versionConstraint = makeRange(versionStr.element);
			const closeParen = consumeString(versionStr, ')');
			guard(closeParen.element, `Expected ), but found ${versionStr.remInput[0]} at position ${versionStr.position}`);
			info = skipWhitespace(closeParen);
		} else {
			// consume until whitespace or special character
			const versionStr = consumeRegexp(info, /^[\d<>=!~.\s]+/);
			versionConstraint = versionStr.element ? makeRange(versionStr.element) : undefined;
			info = skipWhitespace(versionStr);
		}
	}
	const licenseInfo: RLicenseInfo = compactRecord({
		type:    'license',
		license: licenseName.element,
		versionConstraint
	} as const);
	return { ...info, element: licenseInfo };
}

const operators = {
	'and':  ['and', '+', '&'],
	'or':   ['or', '|'],
	'with': ['with']
} as const;

function parseBinaryOperator(info: ParserInfo): ParserResult {
	const license = parseLicenseElement(info);
	info = skipWhitespace(license);
	const operator = tryConsumeOperator(info);
	if(operator.element) {
		info = skipWhitespace(operator);
		let rightLicense = parseLicenseInfo(info);
		if(operator.element === 'with' && rightLicense.element.type === 'license') {
			rightLicense = {
				...rightLicense,
				element: {
					type:      'exception',
					exception: rightLicense.element.license
				}
			};
		}
		const combination: RLicenseCombinationInfo = {
			type:        'combination',
			combination: operator.element,
			elements:    [license.element, rightLicense.element]
		};
		return { ...rightLicense, element: combination };
	}

	return { ...info, element: license.element };
}

function tryConsumeOperator(info: ParserInfo): ParserResult<'and' | 'or' | 'with' | undefined> {
	for(const [opName, opSymbols] of Object.entries(operators)) {
		for(const symbol of opSymbols) {
			if(info.remInput.toLowerCase().startsWith(symbol)) {
				const newInfo = {
					position: info.position + symbol.length,
					remInput: info.remInput.slice(symbol.length)
				};
				return { ...newInfo, element: opName as 'and' | 'or' | 'with' };
			}
		}
	}
	return { ...info, element: undefined };
}

function consumeString(info: ParserInfo, str: string): ParserResult<boolean> {
	info = skipWhitespace(info);
	if(info.remInput.startsWith(str)) {
		const newInfo = {
			position: info.position + str.length,
			remInput: info.remInput.slice(str.length)
		};
		return { ...newInfo, element: true };
	} else {
		return { ...info, element: false };
	}
}

function consumeUntilString(info: ParserInfo, str: string): ParserResult<string> {
	let idx = info.remInput.indexOf(str);
	if(idx === -1) {
		idx = info.remInput.length;
	}
	const consumed = info.remInput.slice(0, idx);
	const newInfo = {
		position: info.position + idx,
		remInput: info.remInput.slice(idx)
	};
	return { ...newInfo, element: consumed };
}

function consumeRegexp(info: ParserInfo, regex: RegExp): ParserResult<string | null> {
	info = skipWhitespace(info);
	const match = info.remInput.match(regex);
	if(match && match.index === 0) {
		const matchedStr = match[0];
		const newInfo = {
			position: info.position + matchedStr.length,
			remInput: info.remInput.slice(matchedStr.length)
		};
		return { ...newInfo, element: matchedStr };
	}
	return { ...info, element: null };
}