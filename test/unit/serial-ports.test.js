import { test } from "node:test";
import assert from "node:assert/strict";
import { chosenPortId, serialPortChoices } from "../../src/serial-ports.js";
import { translator } from "../../src/strings.js";

const t = translator("en");
const ports = [
  { portId: "a", portName: "/dev/cu.usbserial-1", displayName: "CID Easy caller ID" },
  { portId: "b", portName: "COM4" },
];

test("lists each adapter by its friendly name, then Cancel", () => {
  const choices = serialPortChoices(ports, t);
  assert.deepEqual(choices.buttons, [ "CID Easy caller ID", "COM4", t("serial.cancel") ]);
  assert.equal(choices.cancelId, 2);
  assert.deepEqual(choices.portIds, [ "a", "b" ]);
  assert.equal(choices.message, t("serial.message"));
});

test("shows at most eight adapters and ignores malformed entries", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ portId: `p${index}`, portName: `COM${index}` }));
  const choices = serialPortChoices([ null, { portName: "no id" }, ...many ], t);
  assert.equal(choices.portIds.length, 8);
  assert.equal(choices.buttons.length, 9);
});

test("with no adapters plugged in, says so and offers only Cancel", () => {
  const choices = serialPortChoices([], t);
  assert.deepEqual(choices.buttons, [ t("serial.cancel") ]);
  assert.equal(choices.message, t("serial.none"));
});

test("the chosen button maps to its port, and Cancel or anything else to none", () => {
  const choices = serialPortChoices(ports, t);
  assert.equal(chosenPortId(0, choices), "a");
  assert.equal(chosenPortId(1, choices), "b");
  assert.equal(chosenPortId(2, choices), "");
  assert.equal(chosenPortId(-1, choices), "");
  assert.equal(chosenPortId(99, choices), "");
  assert.equal(chosenPortId("0", choices), "");
});
