import { test } from "node:test";
import assert from "node:assert/strict";
import { SIGN_IN_COMPLETION_PATH, findSignInLink, parseSignInLink, signInCompletionRequest } from "../../src/sign-in-link.js";

const code = "Qm9vdHN0cmFwLWNvZGUtZm9yLXRlc3RzLW9ubHktMDE"; // 43 URL-safe characters

test("reads the one-time code from this app's own sign-in link", () => {
  assert.equal(code.length, 43);
  assert.deepEqual(parseSignInLink(`jawa-pos://sign-in?code=${code}`, "jawa-pos"), { code });
  assert.deepEqual(parseSignInLink(`JAWA-POS://sign-in/?code=${code}`, "jawa-pos"), { code });
});

test("ignores anything that is not exactly that link", () => {
  for (const link of [
    `jawa-site://sign-in?code=${code}`,
    `https://pos.jawa.example/sign-in?code=${code}`,
    `jawa-pos://sign-out?code=${code}`,
    `jawa-pos://sign-in/extra?code=${code}`,
    `jawa-pos://sign-in?code=${code}&next=https://attacker.example`,
    `jawa-pos://sign-in?code=${code}&code=${code}`,
    `jawa-pos://sign-in?code=${code}#fragment`,
    `jawa-pos://user:pw@sign-in?code=${code}`,
    `jawa-pos://sign-in:443?code=${code}`,
    `jawa-pos://sign-in?code=${code.slice(1)}`,
    `jawa-pos://sign-in?code=${code}A`,
    `jawa-pos://sign-in?code=${code.slice(1)}=`,
    `jawa-pos://sign-in?code=${code.slice(1)}%2F`,
    "jawa-pos://sign-in",
    "jawa-pos://sign-in?code=",
    "not a link",
    "",
    null,
    undefined,
    {},
  ]) {
    assert.equal(parseSignInLink(link, "jawa-pos"), null, String(link));
  }
});

test("finds the link among a second launch's command-line arguments", () => {
  const argv = [ "/Applications/JAWA POS.app/Contents/MacOS/JAWA POS", "--allow-file-access-from-files", `jawa-pos://sign-in?code=${code}` ];
  assert.deepEqual(findSignInLink(argv, "jawa-pos"), { code });
  assert.equal(findSignInLink([ "electron", "." ], "jawa-pos"), null);
  assert.equal(findSignInLink(undefined, "jawa-pos"), null);
});

test("hands the code to JAWA ID in a form POST, never in the address", () => {
  const request = signInCompletionRequest("https://pos.jawa.example", code);
  assert.equal(SIGN_IN_COMPLETION_PATH, "/desktop/sign-in/complete");
  assert.equal(request.url, "https://pos.jawa.example/desktop/sign-in/complete");
  assert.ok(!request.url.includes(code));
  assert.equal(request.options.extraHeaders, "Content-Type: application/x-www-form-urlencoded");
  assert.equal(request.options.postData.length, 1);
  assert.equal(request.options.postData[0].type, "rawData");
  assert.equal(Buffer.from(request.options.postData[0].bytes).toString(), `code=${code}`);
});

test("refuses to build a request for a malformed code", () => {
  assert.throws(() => signInCompletionRequest("https://pos.jawa.example", "short"), /code/);
  assert.throws(() => signInCompletionRequest("https://pos.jawa.example", `${code.slice(1)}&`), /code/);
});
