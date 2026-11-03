import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinterLines } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { SecretLeak } from '../../../src/linter/rules/secret-exfiltration';
import { FileTrust } from '../../../src/taint-analysis/predefined/secret-analysis';
import { Identifier } from '../../../src/dataflow/environments/identifier';

const { Certain, Uncertain } = LintingResultCertainty;
const AllOptIn = { optIn: [SecretLeak.Url, SecretLeak.Files, SecretLeak.Process, SecretLeak.Llm] };

describe('flowR linter', withTreeSitter(parser => {
	describe('secret exfiltration', () => {
		const lint = (name: string, code: string, expected: Record<string, unknown>[], config?: object) =>
			assertLinterLines(name, parser, code, 'secret-exfiltration', expected, config);

		describe('the examples of the feature request', () => {
			const example = `key <- Sys.getenv("API_KEY")
server <- function(input, output, session) {
  httr2::request("https://api.example.org") |>
    httr2::req_auth_bearer_token(key)
  httr::GET(input$url, httr::add_headers(Authorization = key))
  output$debug <- renderPrint(Sys.getenv())
  message("calling with ", key)
  message("key set: ", nzchar(key))
  httr::GET(paste0("https://api.example.org/?key=", key))
}`;
			lint('only the reported classes without opt-in', example, [
				{ line: 5, leak: SecretLeak.Exfiltration, severity: 'high', certainty: Uncertain },
				{ line: 6, leak: SecretLeak.Leakage, severity: 'high', certainty: Certain },
				{ line: 7, leak: SecretLeak.Leakage, severity: 'medium', certainty: Certain }
			]);
			lint('the secret in a url once opted in', example, [
				{ line: 5, leak: SecretLeak.Exfiltration },
				{ line: 6, leak: SecretLeak.Leakage },
				{ line: 7, leak: SecretLeak.Leakage },
				{ line: 9, leak: SecretLeak.Url }
			], { optIn: [SecretLeak.Url] });
		});

		describe('sources', () => {
			lint('a credential-like environment variable', 'message(Sys.getenv("GITHUB_TOKEN"))', [{ line: 1, function: 'message', leak: SecretLeak.Leakage }]);
			lint('an environment variable that holds no credential', 'message(Sys.getenv("HOME"))', []);
			lint('all environment variables', 'print(Sys.getenv())', [{ line: 1, leak: SecretLeak.Leakage }]);
			lint('an environment variable whose name is unknown', 'f <- function(name) message(Sys.getenv(name))', [{ line: 1, leak: SecretLeak.Leakage }]);
			lint('the keyring', 'k <- keyring::key_get("svc")\ncat(k)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('a config value, through accesses', 'cfg <- config::get()\nmessage(cfg$db$password)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('an element of a list holding a secret', 'l <- list(k = Sys.getenv("API_KEY"))\nprint(l[["k"]])', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('a credentials file', 'n <- readLines("~/.netrc")\nprint(n)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('any other file may hold secrets', 'n <- readLines("data.txt")\nprint(n)', [{ line: 2, leak: SecretLeak.Leakage, certainty: Uncertain }]);
			lint('a hardcoded credential', 'message("using ghp_abcdefghijklmnopqrstuvwxyz0123456789")', [{ line: 1, leak: SecretLeak.Leakage }]);
			lint('a hardcoded credential in a variable', 'tok <- "ghp_abcdefghijklmnopqrstuvwxyz0123456789"\nmessage(tok)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('a configured source', 'message(vault_read("db"))', [{ line: 1, leak: SecretLeak.Leakage }], { sources: [Identifier.make('vault_read')] });
			lint('a configured credential name pattern', 'message(Sys.getenv("SESAME"))', [{ line: 1, leak: SecretLeak.Leakage }], { credentialNamePattern: 'sesame' });
		});

		describe('declassifiers', () => {
			lint('presence checks', 'key <- Sys.getenv("API_KEY")\nmessage(nzchar(key), nchar(key), is.na(key), key == "")', []);
			lint('hashing', 'key <- Sys.getenv("API_KEY")\nmessage(digest::digest(key))\nprint(openssl::sha256(key))', []);
			lint('a configured declassifier', 'key <- Sys.getenv("API_KEY")\nmessage(mask(key))', [], { declassifiers: [Identifier.make('mask')] });
			lint('string operations keep the secret', 'key <- Sys.getenv("API_KEY")\nmessage(toupper(paste0("k=", key)))', [{ line: 2, leak: SecretLeak.Leakage }]);
		});

		describe('network destinations', () => {
			lint('a body to a destination the user chose', 'key <- Sys.getenv("API_KEY")\nu <- readline()\nhttr::POST(u, body = list(k = key))',
				[{ line: 3, leak: SecretLeak.Exfiltration, severity: 'high', certainty: Certain }]);
			lint('a body to a constant destination', 'key <- Sys.getenv("API_KEY")\nhttr::POST("https://api.example.org/token", body = list(secret = key))', [], AllOptIn);
			lint('an auth channel of a request to a user-chosen host', 'key <- Sys.getenv("API_KEY")\nhttr2::request(readline()) |> httr2::req_auth_bearer_token(key)',
				[{ line: 2, leak: SecretLeak.Exfiltration, certainty: Certain }]);
			lint('an auth channel of a request held in a variable', 'key <- Sys.getenv("API_KEY")\nreq <- httr2::request(readline())\nhttr2::req_auth_bearer_token(req, key)',
				[{ line: 3, leak: SecretLeak.Exfiltration }]);
			lint('an auth channel of a constant host', 'key <- Sys.getenv("API_KEY")\nreq <- httr2::request("https://api.example.org")\nhttr2::req_auth_basic(req, "me", key)', [], AllOptIn);
			lint('a database password', 'pw <- Sys.getenv("DB_PASSWORD")\ncon <- DBI::dbConnect(RPostgres::Postgres(), host = "db.local", password = pw)', [], AllOptIn);
			lint('a database host the user chose', 'pw <- Sys.getenv("DB_PASSWORD")\ncon <- DBI::dbConnect(RPostgres::Postgres(), host = readline(), password = pw)', [{ line: 2, leak: SecretLeak.Exfiltration }]);
			lint('a secret in the url of a download', 'key <- Sys.getenv("API_KEY")\ndownload.file(paste0("https://x.org/?k=", key), "out.csv")', [{ line: 2, leak: SecretLeak.Url }], AllOptIn);
			lint('a secret in a query of a request', 'key <- Sys.getenv("API_KEY")\nhttr2::request("https://x.org") |> httr2::req_url_query(key = key)', [{ line: 2, leak: SecretLeak.Url }], AllOptIn);
		});

		describe('other sinks', () => {
			lint('the browser', 'key <- Sys.getenv("API_KEY")\nshiny::HTML(key)', [{ line: 2, sink: 'browser', leak: SecretLeak.Leakage, severity: 'high' }]);
			lint('an error', 'f <- function() stop("bad key ", Sys.getenv("API_KEY"))', [{ line: 1, leak: SecretLeak.Leakage, severity: 'medium' }]);
			lint('the standard error stream', 'writeLines(Sys.getenv("API_KEY"), stderr())', [{ line: 1, leak: SecretLeak.Leakage }]);
			lint('a file needs opting in', 'writeLines(Sys.getenv("API_KEY"), "key.txt")', []);
			lint('a file', 'writeLines(Sys.getenv("API_KEY"), "key.txt")\ncat(Sys.getenv("API_KEY"), file = "k")\nsaveRDS(Sys.getenv("API_KEY"), "k.rds")',
				[{ line: 1, leak: SecretLeak.Files }, { line: 2, leak: SecretLeak.Files }, { line: 3, leak: SecretLeak.Files }], AllOptIn);
			lint('another process', 'system(paste("curl -H", Sys.getenv("API_KEY")))', [{ line: 1, leak: SecretLeak.Process, severity: 'low' }], AllOptIn);
			lint('a language model', 'chat <- ellmer::chat_openai(system_prompt = paste("use", Sys.getenv("API_KEY")))', [{ line: 1, leak: SecretLeak.Llm }], AllOptIn);
		});

		describe('file trust', () => {
			const code = 'd <- readr::read_csv("users.csv")\nmessage(d$token)';
			lint('files are not trusted by default', code, [{ line: 2, leak: SecretLeak.Leakage, certainty: Uncertain }]);
			lint('only credential files', code, [], { fileTrust: FileTrust.CredentialFiles });
			lint('trusted files', code, [], { trustedFiles: '\\.csv$' });
			lint('secret files', code, [{ line: 2, certainty: Certain }], { secretFiles: '^users' });
			lint('file content to a host the user chose', 'd <- readLines("notes.txt")\nhttr::POST(readline(), body = d)', [{ line: 2, leak: SecretLeak.Exfiltration, certainty: Uncertain }]);
			lint('file content and a secret', 'd <- readLines("notes.txt")\nmessage(d, Sys.getenv("API_KEY"))', [{ line: 2, certainty: Certain }]);
			lint('a hashed file', 'message(digest::digest(readLines("notes.txt")))', []);
			lint('a token from a file in an authentication channel', 'tok <- readLines("token.txt")\nhttr2::request(readline()) |> httr2::req_auth_bearer_token(tok)', [{ line: 2, leak: SecretLeak.Exfiltration }]);
		});

		describe('responses', () => {
			const token = 'r <- httr::POST("https://auth.x.org/oauth/token", body = list(client_secret = Sys.getenv("CLIENT_SECRET")))';
			const authed = 'r <- httr::GET("https://x.org", httr::add_headers(Authorization = Sys.getenv("API_KEY")))';
			lint('a token from a token endpoint', `${token}\ntok <- httr::content(r)$access_token\nmessage(tok)`, [{ line: 3, leak: SecretLeak.Leakage }]);
			lint('a response written out with its credentials', `${authed}\nsaveRDS(r, "r.rds")`, [{ line: 2, leak: SecretLeak.Files }], AllOptIn);
			lint('a response shown in full', `${authed}\nstr(r)`, [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('a printed response, its status, and body', `${authed}\nprint(r)\nstop("failed: ", r$status_code)\nmessage(httr::content(r, "text"))`, []);
			lint('an oauth token', 'tok <- httr::oauth2.0_token(ep, app)\nprint(tok)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('a password prompt', 'pw <- askpass::askpass()\nrlang::abort(paste("wrong password", pw))', [{ line: 2, leak: SecretLeak.Leakage }]);
		});

		describe('methods', () => {
			lint('a chat', 'chat <- ellmer::chat_openai()\nchat$chat(paste("use", Sys.getenv("API_KEY")))', [{ line: 2, function: '$chat', leak: SecretLeak.Llm }], AllOptIn);
			lint('a custom message to the browser', 'server <- function(input, output, session) {\n  session$sendCustomMessage("cfg", list(key = Sys.getenv("API_KEY")))\n}', [{ line: 2, sink: 'browser', severity: 'high' }]);
			lint('a method of another name', 'obj$save(Sys.getenv("API_KEY"))', []);
		});

		describe('functions', () => {
			lint('a helper sending its argument', 'send <- function(x) httr::POST(readline(), body = x)\nsend(Sys.getenv("API_KEY"))', [{ line: 1, leak: SecretLeak.Exfiltration }]);
			lint('nested helpers', 'log_it <- function(x) message(x)\nwrap <- function(y) log_it(y)\nwrap(Sys.getenv("API_KEY"))', [{ line: 1, leak: SecretLeak.Leakage }]);
			lint('a helper returning a secret', 'get_key <- function() Sys.getenv("API_KEY")\nmessage(get_key())', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('a password field prefilled', 'ui <- shiny::passwordInput("pw", "Password", value = Sys.getenv("DB_PASSWORD"))', [{ line: 1, sink: 'browser' }]);
		});

		describe('control flow', () => {
			lint('within a loop, reported once', 'key <- Sys.getenv("API_KEY")\nfor(i in 1:3) message(key)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('within a branch', 'key <- Sys.getenv("API_KEY")\nif(verbose) message(key)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('within a function no one calls', 'key <- Sys.getenv("API_KEY")\nlog_key <- function() print(key)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('within a nested function', 'key <- Sys.getenv("API_KEY")\nf <- function() function() print(key)', [{ line: 2, leak: SecretLeak.Leakage }]);
			lint('through a called function', 'key <- Sys.getenv("API_KEY")\nf <- function(x) message(x)\nf(key)', [{ line: 2, leak: SecretLeak.Leakage }]);
		});
	});
}));
