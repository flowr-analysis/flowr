import { describe, test } from 'vitest';
import { testTaintAnalysis } from '../helper';
import { securityAnalysis, NetworkInput, FileInput } from '../../../../src/taint-analysis/predefined/security-analysis';

describe('Security Taint Analysis: protocol-aware read sources', () => {
	test('read.table with a URL literal is NetworkInput', async() => {
		await testTaintAnalysis('x <- read.table("http://example.com/data.csv")', securityAnalysis, {
			'1@x': NetworkInput
		});
	});

	test('read.csv with a named URL argument is NetworkInput', async() => {
		await testTaintAnalysis('x <- read.csv(file = "https://example.com/d.csv")', securityAnalysis, {
			'1@x': NetworkInput
		});
	});

	test('namespaced utils::read.csv with a URL is NetworkInput', async() => {
		await testTaintAnalysis('x <- utils::read.csv("http://example.com/data.csv")', securityAnalysis, {
			'1@x': NetworkInput
		});
	});

	test('read.table with a local path literal is FileInput', async() => {
		await testTaintAnalysis('x <- read.table("data.csv")', securityAnalysis, {
			'1@x': FileInput
		});
	});

	test('read.table with an unresolved path defaults to FileInput', async() => {
		await testTaintAnalysis(`
			p <- somevar
			x <- read.table(p)`, securityAnalysis, {
			'2@x': FileInput
		});
	});

	test('download.file remains NetworkInput regardless of argument', async() => {
		await testTaintAnalysis('x <- download.file("data.csv", "out.csv")', securityAnalysis, {
			'1@x': NetworkInput
		});
	});
});
