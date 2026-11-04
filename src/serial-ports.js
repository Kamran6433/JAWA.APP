// Chrome shows its own picker when a page asks for a serial port; Electron
// leaves it to the app. These choices feed a plain native dialog.

const MAX_PORTS = 8;

export function serialPortChoices(portList, t) {
  const ports = (Array.isArray(portList) ? portList : [])
    .filter((port) => port && typeof port.portId === "string" && port.portId !== "")
    .slice(0, MAX_PORTS);
  return {
    title: t("serial.title"),
    message: ports.length ? t("serial.message") : t("serial.none"),
    buttons: [ ...ports.map((port) => String(port.displayName || port.portName || port.portId)), t("serial.cancel") ],
    cancelId: ports.length,
    portIds: ports.map((port) => port.portId),
  };
}

// An empty string tells Electron that no port was chosen.
export function chosenPortId(response, choices) {
  return Number.isInteger(response) && response >= 0 && response < choices.portIds.length ? choices.portIds[response] : "";
}
