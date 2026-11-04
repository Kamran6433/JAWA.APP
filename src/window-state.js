// Remembers where the window was, and puts it back somewhere visible even if
// a screen has since been unplugged or the resolution changed.

export const DEFAULT_SIZE = Object.freeze({ width: 1200, height: 800 });
export const MINIMUM_SIZE = Object.freeze({ width: 360, height: 480 });

export function restoreBounds(saved, displays) {
  const areas = (Array.isArray(displays) ? displays : []).map((display) => display?.workArea).filter(isRectangle);
  if (areas.length === 0) return { ...DEFAULT_SIZE, maximized: false };

  const state = validState(saved);
  if (!state) return centred(DEFAULT_SIZE, areas[0], false);

  const size = { width: Math.max(MINIMUM_SIZE.width, state.width), height: Math.max(MINIMUM_SIZE.height, state.height) };
  const area = mostOverlapping(state, areas);
  if (!area) return centred(size, areas[0], state.maximized);

  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  return {
    x: clamp(state.x, area.x, area.x + area.width - width),
    y: clamp(state.y, area.y, area.y + area.height - height),
    width,
    height,
    maximized: state.maximized,
  };
}

export function parseWindowState(text) {
  try {
    return validState(JSON.parse(text));
  } catch {
    return null;
  }
}

export function serializeWindowState(state) {
  return JSON.stringify(validState(state));
}

function validState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { x, y, width, height } = value;
  if (![ x, y, width, height ].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height, maximized: value.maximized === true };
}

function isRectangle(area) {
  return Boolean(area) && [ area.x, area.y, area.width, area.height ].every(Number.isFinite) && area.width > 0 && area.height > 0;
}

function mostOverlapping(rectangle, areas) {
  let best = null;
  let bestOverlap = 0;
  for (const area of areas) {
    const overlap = Math.max(0, Math.min(rectangle.x + rectangle.width, area.x + area.width) - Math.max(rectangle.x, area.x)) *
      Math.max(0, Math.min(rectangle.y + rectangle.height, area.y + area.height) - Math.max(rectangle.y, area.y));
    if (overlap > bestOverlap) [ best, bestOverlap ] = [ area, overlap ];
  }
  return best;
}

function centred(size, area, maximized) {
  const width = Math.min(size.width, area.width);
  const height = Math.min(size.height, area.height);
  return { x: area.x + Math.floor((area.width - width) / 2), y: area.y + Math.floor((area.height - height) / 2), width, height, maximized };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
