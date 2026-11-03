import { describe, test } from 'vitest';
import { testTaintAnalysis, type TaintAnalysisExpectation } from '../helper';
import { createSecretAnalysis, Credential, FileContent, FileTrust, Response, Secret, secretAnalysis } from '../../../../src/taint-analysis/predefined/secret-analysis';
import { Bottom, Top } from '../../../../src/abstract-interpretation/domains/lattice';
import { decorateLabelContext, label } from '../../_helper/label';
import { testLoopFixpoint } from '../loop-helper';

function testSecret(name: string, code: string, expectation: TaintAnalysisExpectation): void {
	test(decorateLabelContext(label(name), ['taint']), async() => {
		await testTaintAnalysis(code, secretAnalysis, expectation);
	});
}

describe('Secret Taint Analysis', () => {
	describe('Sources', () => {
		testSecret('a credential-like environment variable', 'x <- Sys.getenv("API_KEY")', { '1@x': Secret });
		testSecret('an environment variable without a credential', 'x <- Sys.getenv("HOME")', { '1@x': Top });
		testSecret('all environment variables', 'x <- Sys.getenv()', { '1@x': Secret });
		testSecret('several names of which one holds a credential', 'x <- Sys.getenv(c("HOME", "DB_PASSWORD"))', { '1@x': Secret });
		testSecret('the keyring', 'x <- keyring::key_get("svc")', { '1@x': Secret });
		testSecret('a config value', 'x <- config::get("db")', { '1@x': Secret });
		testSecret('a credentials file', 'x <- readLines(".Renviron")', { '1@x': Secret });
		testSecret('any other file may hold secrets', 'x <- readLines("data.txt")', { '1@x': FileContent });
		testSecret('a file read by a package', 'x <- readr::read_csv("users.csv")\ny <- x$token', { '1@x': FileContent, '2@y': FileContent });
		testSecret('a file of unknown name', 'x <- readRDS(f)', { '1@x': FileContent });
		testSecret('a hashed file', 'x <- digest::digest(readLines("data.txt"))', { '1@x': Top });
	});

	describe('File trust', () => {
		const withTrust = (name: string, code: string, options: Parameters<typeof createSecretAnalysis>[0], expectation: TaintAnalysisExpectation) =>
			test(decorateLabelContext(label(name), ['taint']), async() => {
				await testTaintAnalysis(code, createSecretAnalysis(options), expectation);
			});
		withTrust('only credential files', 'x <- readLines("data.txt")\ny <- readLines(".netrc")', { fileTrust: FileTrust.CredentialFiles }, { '1@x': Top, '2@y': Secret });
		withTrust('trusted files', 'x <- read.csv("data/a.csv")\ny <- read.csv("conf/a.csv")', { trustedFiles: /^data\// }, { '1@x': Top, '2@y': FileContent });
		withTrust('secret files', 'x <- jsonlite::read_json("secrets/db.json")', { fileTrust: FileTrust.CredentialFiles, secretFiles: /^secrets\// }, { '1@x': Secret });
		withTrust('a credential file stays secret when trusted', 'x <- readLines(".Renviron")', { trustedFiles: /Renviron/ }, { '1@x': Secret });
	});

	describe('Propagation', () => {
		testSecret('a vector holding a secret', 'k <- Sys.getenv("API_KEY")\nx <- c("a", k)', { '2@x': Secret });
		testSecret('the shape of a secret is not secret', 'k <- Sys.getenv("API_KEY")\nx <- length(k)', { '2@x': Top });
	});

	describe('Declassifiers and credentials', () => {
		testSecret('presence check', 'k <- Sys.getenv("API_KEY")\nx <- nzchar(k)', { '2@x': Top });
		testSecret('hashing', 'k <- Sys.getenv("API_KEY")\nx <- digest::digest(k)', { '2@x': Top });
		testSecret('an authentication header holds a credential', 'k <- Sys.getenv("API_KEY")\nx <- httr::add_headers(Authorization = k)', { '2@x': Credential });
		testSecret('an authentication header without a secret', 'x <- httr::add_headers(Accept = "json")', { '1@x': Top });
	});

	describe('Sinks', () => {
		testSecret('a method of a chat', 'k <- Sys.getenv("API_KEY")\nx <- chat$chat(k)', { '2@x': Bottom });
		testSecret('a whole response written out', 'r <- httr::GET("https://x.org", httr::add_headers(Authorization = Sys.getenv("API_KEY")))\nx <- saveRDS(r, "r.rds")', { '2@x': Bottom });
		testSecret('a response printed hides its request', 'r <- httr::GET("https://x.org", httr::add_headers(Authorization = Sys.getenv("API_KEY")))\nx <- print(r)', { '2@x': Top });
		testSecret('an authentication channel is no sink', 'k <- Sys.getenv("API_KEY")\nx <- httr2::req_auth_bearer_token(r, k)', { '2@x': Credential });
	});

	describe('Requests and responses', () => {
		const auth = 'httr::add_headers(Authorization = Sys.getenv("API_KEY"))';
		const token = 'r <- httr::POST("https://auth.x.org/oauth/token", body = list(client_secret = Sys.getenv("CLIENT_SECRET")))';
		testSecret('a response keeps the credentials of its request', `x <- httr::GET("https://x.org", ${auth})`, { '1@x': Response });
		testSecret('a response without secrets', 'x <- httr::GET("https://x.org")', { '1@x': Top });
		testSecret('the body of a response', `r <- httr::GET("https://x.org", ${auth})\nx <- httr::content(r)`, { '2@x': Top });
		testSecret('a field of a response', `r <- httr::GET("https://x.org", ${auth})\nx <- r$status_code`, { '2@x': Top });
		testSecret('a token endpoint answers with a secret', token, { '1@r': Secret });
		testSecret('the token in the body', `${token}\nx <- httr::content(r)$access_token`, { '2@x': Secret });
		testSecret('the token through json', `${token}\nx <- jsonlite::fromJSON(httr::content(r, "text"))`, { '2@x': Secret });
		testSecret('a request holding a secret', 'x <- httr2::request(paste0("https://x.org/?k=", Sys.getenv("API_KEY")))', { '1@x': Secret });
		testSecret('a performed request', 'req <- httr2::request("https://x.org") |> httr2::req_auth_bearer_token(Sys.getenv("API_KEY"))\nx <- httr2::req_perform(req)', { '2@x': Response });
		testSecret('an oauth flow', 'x <- httr2::oauth_flow_client_credentials(client)', { '1@x': Secret });
		testSecret('an oauth client', 'x <- httr2::oauth_client("id", "https://x.org/token", secret = Sys.getenv("CLIENT_SECRET"))', { '1@x': Credential });
		testSecret('a password prompt', 'x <- askpass::askpass()', { '1@x': Secret });
	});

	describe('Functions', () => {
		testSecret('a function returning a secret', 'get_key <- function() Sys.getenv("API_KEY")\nx <- get_key()', { '2@x': Secret });
		testSecret('a call made by do.call', 'x <- do.call(readLines, list(".Renviron"))', { '1@x': Secret });
	});

	describe('Loops preserve the taint', () => {
		testLoopFixpoint(secretAnalysis, 'a secret forwarded through the loop stays secret', 'x <- Sys.getenv("API_KEY")', 'x <- x', Secret);
	});
});
