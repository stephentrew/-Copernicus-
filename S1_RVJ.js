//VERSION=3
// Sentinel-1 GRD RVI change:
// current acquisition minus previous acquisition

// DIAGNOSTIC_MODE:
// 0 = final RVI difference map
// 1 = number of matching dates found
// 2 = current-date RVI
// 3 = previous-date RVI
// 4 = RVI difference, stretched
// 5 = current VV
// 6 = current VH
// 7 = current VH / VV ratio

const DIAGNOSTIC_MODE = 1;

// Change these to the exact IW GRD acquisition dates shown in Copernicus Browser.
// Use two dates from the SAME relative orbit wherever possible.
const PREVIOUS_DATE = "2026-09-02";
const CURRENT_DATE = "2026-10-08";

function setup() {
  return {
    input: ["VV", "VH", "dataMask"],
    mosaicking: "ORBIT",
    output: [
      { id: "default", bands: 3, sampleType: "AUTO" },
      { id: "diagnostic", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}

function preProcessScenes(collections) {
  const allowedDates = [
    PREVIOUS_DATE,
    CURRENT_DATE
  ];

  collections.scenes.orbits = collections.scenes.orbits.filter(
    orbit => allowedDates.includes(orbit.dateFrom.split("T")[0])
  );

  return collections;
}

function getRvi(scene) {
  if (!scene || !isFinite(scene.VV) || !isFinite(scene.VH)) {
    return NaN;
  }

  const vv = scene.VV;
  const vh = scene.VH;

  if (vv + vh === 0) {
    return NaN;
  }

  return (4 * vh) / (vv + vh);
}

function evaluatePixel(samples) {
  // With no named datasource, samples is already the array of scenes.
  const scenes = samples;

  // Keep only valid pixels
  const validScenes = scenes.filter(scene => scene.dataMask === 1);
  const sceneCount = validScenes.length;

  let previous = null;
  let current = null;
  let rviPrevious = NaN;
  let rviCurrent = NaN;
  let difference = NaN;

  if (sceneCount >= 2) {
    if (
      new Date(validScenes[0].dateFrom) <
      new Date(validScenes[1].dateFrom)
    ) {
      previous = validScenes[0];
      current = validScenes[1];
    } else {
      previous = validScenes[1];
      current = validScenes[0];
    }

    rviPrevious = getRvi(previous);
    rviCurrent = getRvi(current);

    if (isFinite(rviPrevious) && isFinite(rviCurrent)) {
      difference = rviCurrent - rviPrevious;
    }
  }

  // Values from the most recent valid acquisition
  const currentScene = sceneCount > 0 ? validScenes[sceneCount - 1] : null;
  const currentVV = currentScene ? currentScene.VV : NaN;
  const currentVH = currentScene ? currentScene.VH : NaN;
  const currentRatio = currentScene ? currentVH / currentVV : NaN;
  const currentRVI = currentScene ? getRvi(currentScene) : NaN;

  let diagnosticValue = NaN;
  let r = 0;
  let g = 0;
  let b = 0;

  if (DIAGNOSTIC_MODE === 0) {
    // Final RVI difference map
    diagnosticValue = difference;

    if (!isFinite(difference)) {
      r = 0.20; g = 0.20; b = 0.20; // dark grey = no valid comparison
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
    // How many matching valid dates were found?
    diagnosticValue = sceneCount;

    if (sceneCount === 0) {
      r = 0; g = 0; b = 0; // black = neither date found
    } else if (sceneCount === 1) {
      r = 1; g = 0.6; b = 0; // orange = only one date found
    } else {
      r = 0; g = 0.8; b = 0; // green = both dates found
    }
  }

  else if (DIAGNOSTIC_MODE === 2) {
    // Current-date RVI
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
    // Previous-date RVI
    diagnosticValue = rviPrevious;

    if (!isFinite(rviPrevious)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      r = 1 - rviPrevious;
      g = rviPrevious;
      b = 0;
    }
  }

  else if (DIAGNOSTIC_MODE === 4) {
    // RVI difference, stretched from -0.3 to +0.3
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
    // Unknown diagnostic mode
    diagnosticValue = -999;
    r = 1; g = 0; b = 1;
  }

  return {
    default: [r, g, b],
    diagnostic: [diagnosticValue]
  };
}
