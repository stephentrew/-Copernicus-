//VERSION=3
// Compare first and last Sentinel-1 GRD acquisitions
// within the selected Copernicus Browser time range.

const DIAGNOSTIC_MODE = 1;

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
  const validScenes = samples.filter(scene => scene.dataMask === 1);
  const count = validScenes.length;

  let previous = null;
  let current = null;
  let rviPrevious = NaN;
  let rviCurrent = NaN;
  let difference = NaN;

  if (count >= 2) {
    previous = validScenes[0];
    current = validScenes[count - 1];

    rviPrevious = getRvi(previous);
    rviCurrent = getRvi(current);

    if (isFinite(rviPrevious) && isFinite(rviCurrent)) {
      difference = rviCurrent - rviPrevious;
    }
  }

  const currentScene = count > 0 ? validScenes[count - 1] : null;
  const currentRVI = currentScene ? getRvi(currentScene) : NaN;

  let diagnosticValue = NaN;
  let r = 0;
  let g = 0;
  let b = 0;

  if (DIAGNOSTIC_MODE === 1) {
    diagnosticValue = count;

    if (count === 0) {
      r = 0; g = 0; b = 0;
    } else if (count === 1) {
      r = 1; g = 0.6; b = 0;
    } else {
      r = 0; g = 0.8; b = 0;
    }
  }

  else if (DIAGNOSTIC_MODE === 0) {
    diagnosticValue = difference;

    if (!isFinite(difference)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else if (difference < -0.15) {
      r = 0.85; g = 0.05; b = 0.15;
    } else if (difference < -0.05) {
      r = 0.95; g = 0.55; b = 0.20;
    } else if (difference <= 0.05) {
      r = 0.90; g = 0.90; b = 0.90;
    } else if (difference <= 0.15) {
      r = 0.35; g = 0.75; b = 0.35;
    } else {
      r = 0.05; g = 0.45; b = 0.10;
    }
  }

  else if (DIAGNOSTIC_MODE === 2) {
    diagnosticValue = currentRVI;

    if (!isFinite(currentRVI)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      r = 1 - currentRVI;
      g = currentRVI;
      b = 0;
    }
  }

  else {
    diagnosticValue = -999;
    r = 1; g = 0; b = 1;
  }

  return {
    default: [r, g, b],
    diagnostic: [diagnosticValue]
  };
}
