import { test } from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../lib/auth-errors.ts";
test("signup timeout gives recovery instructions without claiming account creation", () => {
  assert.match(authErrorMessage({status:504}, "signup"), /could not confirm whether/);
  assert.match(authErrorMessage({message:"HTTP 504"}, "signup"), /inbox and junk/);
  assert.match(authErrorMessage({status:504}, "login"), /try again/);
});
test("rate limits are distinct from ordinary validation errors", () => {
  assert.match(authErrorMessage({status:429}, "signup"), /wait a few minutes/);
  assert.equal(authErrorMessage({message:"Invalid login credentials"}, "login"), "Invalid login credentials");
});
