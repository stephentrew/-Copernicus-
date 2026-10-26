//VERSION=3
// Sentinel-1 Monthly Mosaic RVI difference - diagnostic version
// Set DIAGNOSTIC_MODE to:
// 0 = final RVI difference map
// 1 = number of matching monthly mosaics found
// 2 = current RVI
// 3 = previous-year / older RVI
// 4 = RVI difference
// 5 = current VV
// 6 = current VH
// 7 = current VH/VV ratio

const DIAGNOSTIC_MODE = 1;

// Set these to the two monthly-mosaic dates you want to compare.
const OLDER_DATE = "2025-10-01";
const NEWER_DATE = "2026-10-01";

function setup() {
  return {
    input: [{
      datasource: "S1MOSAIC",
      bands: ["VV", "VH"]
    }],
    mosaicking: "ORBIT",
    output: [
      { id: "default", bands: 3, sampleType: "AUTO" },
      { id: "diagnostic", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}

function preProcessScenes(collections) {
  const allowedDates = [
    OLDER_DATE,
    NEWER_DATE
  ];

  collections.S1MOSAIC.scenes.orbits = collections.S1MOSAIC.scenes.orbits.filter(
    orbit => allowedDates.includes(orbit.dateFrom.split("T")[0])
  );

  return collections;
}

function getRvi(scene) {
  const vv = scene.VV;
  const vh = scene.VH;

  if (!isFinite(vv) || !isFinite(vh) || vv + vh === 0) {
    return NaN;
  }

  return (4 * vh) / (vv + vh);
}

function evaluatePixel(samples) {
  const scenes = samples.S1MOSAIC;
  const sceneCount = scenes.length;

  // Always calculate these if both scenes exist
  let older = null;
  let newer = null;
  let rviOlder = NaN;
  let rviNewer = NaN;
  let difference = NaN;

  if (sceneCount >= 2) {
    if (new Date(scenes[0].dateFrom) < new Date(scenes[1].dateFrom)) {
      older = scenes[0];
      newer = scenes[1];
    } else {
      older = scenes[1];
      newer = scenes[0];
    }

    rviOlder = getRvi(older);
    rviNewer = getRvi(newer);

    if (isFinite(rviOlder) && isFinite(rviNewer)) {
      difference = rviNewer - rviOlder;
    }
  }

  // Current scene values, if available
  const current = sceneCount > 0 ? scenes[sceneCount - 1] : null;
  const currentVV = current ? current.VV : NaN;
  const currentVH = current ? current.VH : NaN;
  const currentRatio = current ? currentVH / currentVV : NaN;
  const currentRVI = current ? getRvi(current) : NaN;

  let diagnosticValue = NaN;
  let r = 0;
  let g = 0;
  let b = 0;

  if (DIAGNOSTIC_MODE === 0) {
    // Final RVI difference map
    diagnosticValue = difference;

    if (!isFinite(difference)) {
      r = 0.2; g = 0.2; b = 0.2; // dark grey = no valid comparison
    } else if (difference < -0.15) {
      r = 0.85; g = 0.05; b = 0.15; // strong loss - red
    } else if (difference < -0.05) {
      r = 0.95; g = 0.55; b = 0.20; // moderate loss - orange
    } else if (difference <= 0.05) {
      r = 0.90; g = 0.90; b = 0.90; // little change - pale grey
    } else if (difference <= 0.15) {
      r = 0.35; g = 0.75; b = 0.35; // moderate increase - light green
    } else {
      r = 0.05; g = 0.45; b = 0.10; // strong increase - dark green
    }
  }

  else if (DIAGNOSTIC_MODE === 1) {
    // How many matching monthly mosaics were found?
    diagnosticValue = sceneCount;

    if (sceneCount === 0) {
      r = 0; g = 0; b = 0; // black = no matching dates
    } else if (sceneCount === 1) {
      r = 1; g = 0.6; b = 0; // orange = only one date found
    } else {
      r = 0; g = 0.8; b = 0; // green = both dates found
    }
  }

  else if (DIAGNOSTIC_MODE === 2) {
    // Current RVI
    diagnosticValue = currentRVI;

    if (!isFinite(currentRVI)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      r = 1 - currentRVI;
      g = currentRVI;
      b = 0;
    }
  }

  else if (DIAGNOSTIC_MODE === 3) {
    // Older RVI
    diagnosticValue = rviOlder;

    if (!isFinite(rviOlder)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      r = 1 - rviOlder;
      g = rviOlder;
      b = 0;
    }
  }

  else if (DIAGNOSTIC_MODE === 4) {
    // RVI difference, stretched for inspection
    diagnosticValue = difference;

    if (!isFinite(difference)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      const stretched = Math.max(0, Math.min(1, (difference + 0.3) / 0.6));
      r = 1 - stretched;
      g = stretched;
      b = 0;
    }
  }

  else if (DIAGNOSTIC_MODE === 5) {
    // Current VV backscatter
    diagnosticValue = currentVV;

    if (!isFinite(currentVV)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      const stretched = Math.max(0, Math.min(1, currentVV / 1));
      r = stretched;
      g = stretched;
      b = stretched;
    }
  }

  else if (DIAGNOSTIC_MODE === 6) {
    // Current VH backscatter
    diagnosticValue = currentVH;

    if (!isFinite(currentVH)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      const stretched = Math.max(0, Math.min(1, currentVH / 0.5));
      r = stretched;
      g = stretched;
      b = stretched;
    }
  }

  else if (DIAGNOSTIC_MODE === 7) {
    // Current VH / VV ratio
    diagnosticValue = currentRatio;

    if (!isFinite(currentRatio)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      const stretched = Math.max(0, Math.min(1, currentRatio / 1));
      r = stretched;
      g = stretched;
      b = 0;
    }
  }

  else {
    // Unknown mode
    diagnosticValue = -999;
    r = 1; g = 0; b = 1;
  }

  return {
    default: [r, g, b],
    diagnostic: [diagnosticValue]
  };
}
