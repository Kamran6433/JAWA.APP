import { test } from "node:test";
import assert from "node:assert/strict";
import { SIGN_IN_COMPLETION_PATH, findSignInLink, parseSignInLink, signInCompletionRequest } from "../../src/sign-in-link.js";

const code = "Qm9vdHN0cmFwLWNvZGUtZm9yLXRlc3RzLW9ubHktMDE"; // 43 URL-safe characters

test("reads the one-time code from this app's own sign-in link", () => {
  assert.equal(code.length, 43);
  assert.deepEqual(parseSignInLink(`jawa-menu://sign-in?code=${code}`, "jawa-menu"), { code });
  assert.deepEqual(parseSignInLink(`JAWA-MENU://sign-in/?code=${code}`, "jawa-menu"), { code });
});

test("ignores anything that is not exactly that link", () => {
  for (const link of [
    `jawa-site://sign-in?code=${code}`,
    `https://menu.jawa.example/sign-in?code=${code}`,
    `jawa-menu://sign-out?code=${code}`,
    `jawa-menu://sign-in/extra?code=${code}`,
    `jawa-menu://sign-in?code=${code}&next=https://attacker.example`,
    `jawa-menu://sign-in?code=${code}&code=${code}`,
    `jawa-menu://sign-in?code=${code}#fragment`,
    `jawa-menu://user:pw@sign-in?code=${code}`,
    `jawa-menu://sign-in:443?code=${code}`,
    `jawa-menu://sign-in?code=${code.slice(1)}`,
    `jawa-menu://sign-in?code=${code}A`,
    `jawa-menu://sign-in?code=${code.slice(1)}=`,
    `jawa-menu://sign-in?code=${code.slice(1)}%2F`,
    "jawa-menu://sign-in",
    "jawa-menu://sign-in?code=",
    "not a link",
    "",
    null,
    undefined,
    {},
  ]) {
    assert.equal(parseSignInLink(link, "jawa-menu"), null, String(link));
  }
});

test("finds the link among a second launch's command-line arguments", () => {
  const argv = [ "/Applications/JAWA MENU.app/Contents/MacOS/JAWA MENU", "--allow-file-access-from-files", `jawa-menu://sign-in?code=${code}` ];
  assert.deepEqual(findSignInLink(argv, "jawa-menu"), { code });
  assert.equal(findSignInLink([ "electron", "." ], "jawa-menu"), null);
  assert.equal(findSignInLink(undefined, "jawa-menu"), null);
});

test("hands the code to JAWA ID in a form POST, never in the address", () => {
  const request = signInCompletionRequest("https://menu.jawa.example", code);
  assert.equal(SIGN_IN_COMPLETION_PATH, "/desktop/sign-in/complete");
  assert.equal(request.url, "https://menu.jawa.example/desktop/sign-in/complete");
  assert.ok(!request.url.includes(code));
  assert.equal(request.options.extraHeaders, "Content-Type: application/x-www-form-urlencoded");
  assert.equal(request.options.postData.length, 1);
  assert.equal(request.options.postData[0].type, "rawData");
  assert.equal(Buffer.from(request.options.postData[0].bytes).toString(), `code=${code}`);
});

test("refuses to build a request for a malformed code", () => {
  assert.throws(() => signInCompletionRequest("https://menu.jawa.example", "short"), /code/);
  assert.throws(() => signInCompletionRequest("https://menu.jawa.example", `${code.slice(1)}&`), /code/);
});
