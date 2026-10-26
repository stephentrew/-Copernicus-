//VERSION=3
// Sentinel-1 GRD IW RVI change:
// latest available acquisition minus earliest available acquisition
// within the selected Copernicus Browser time range.

// ============================
// SETTINGS
// ============================

// DIAGNOSTIC_MODE:
// 0 = final RVI difference map with colour ramp
// 1 = number of valid acquisitions found
// 2 = latest RVI
// 3 = earliest RVI
// 4 = RVI difference, stretched
// 5 = latest VV
// 6 = latest VH
// 7 = latest VH / VV ratio

const DIAGNOSTIC_MODE = 1;

// Colour-ramp limits.
// Differences outside these limits are clipped to the end colours.
const MIN_DIFFERENCE = -0.30;
const MAX_DIFFERENCE = 0.30;

// ============================
// SCRIPT
// ============================

function setup() {
  return {
    input: ["VV", "VH", "dataMask"],
    mosaicking: "ORBIT",
    output: [
      { id: "default", bands: 3, sampleType: "AUTO" },
      { id: "difference", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}

function preProcessScenes(collections) {
  // Use every valid IW GRD acquisition in the selected Browser time range.
  // The script compares the earliest and latest available acquisitions.
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

// Continuous colour ramp
// Difference value -> colour
function getRampColour(value) {
  const ramp = [
    [-0.30, 0x67001f], // strong loss - dark red
    [-0.15, 0xc51b7d], // loss - magenta/pink
    [-0.05, 0xfdae6b], // slight loss - orange
    [ 0.00, 0xf7f7f7], // little change - pale grey
    [ 0.05, 0xa1d99b], // slight increase - pale green
    [ 0.15, 0x31a354], // increase - green
    [ 0.30, 0x006d2c]  // strong increase - dark green
  ];

  // Clip values outside ramp range
  if (!isFinite(value)) {
    return [0.15, 0.15, 0.15];
  }

  if (value <= MIN_DIFFERENCE) {
    return hexToRgb(ramp[0][1]);
  }

  if (value >= MAX_DIFFERENCE) {
    return hexToRgb(ramp[ramp.length - 1][1]);
  }

  // Find surrounding ramp points and interpolate
  for (let i = 0; i < ramp.length - 1; i++) {
    const lowerValue = ramp[i][0];
    const upperValue = ramp[i + 1][0];

    if (value >= lowerValue && value <= upperValue) {
      const lowerColour = hexToRgb(ramp[i][1]);
      const upperColour = hexToRgb(ramp[i + 1][1]);

      const fraction =
        (value - lowerValue) / (upperValue - lowerValue);

      return [
        lowerColour[0] + fraction * (upperColour[0] - lowerColour[0]),
        lowerColour[1] + fraction * (upperColour[1] - lowerColour[1]),
        lowerColour[2] + fraction * (upperColour[2] - lowerColour[2])
      ];
    }
  }

  return [0.15, 0.15, 0.15];
}

function hexToRgb(hex) {
  return [
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255
  ];
}

function evaluatePixel(samples) {
  // Keep only valid pixels
  const validScenes = samples.filter(scene => scene.dataMask === 1);
  const sceneCount = validScenes.length;

  let earlier = null;
  let later = null;
  let rviEarlier = NaN;
  let rviLater = NaN;
  let difference = NaN;

  if (sceneCount >= 2) {
    earlier = validScenes[0];
    later = validScenes[sceneCount - 1];

    rviEarlier = getRvi(earlier);
    rviLater = getRvi(later);

    if (isFinite(rviEarlier) && isFinite(rviLater)) {
      difference = rviLater - rviEarlier;
    }
  }

  // Values from the latest valid acquisition
  const latestScene = sceneCount > 0 ? validScenes[sceneCount - 1] : null;
  const latestVV = latestScene ? latestScene.VV : NaN;
  const latestVH = latestScene ? latestScene.VH : NaN;
  const latestRatio = latestScene ? latestVH / latestVV : NaN;
  const latestRVI = latestScene ? getRvi(latestScene) : NaN;

  let diagnosticValue = NaN;
  let colour = [0, 0, 0];

  if (DIAGNOSTIC_MODE === 0) {
    // Final RVI difference map
    diagnosticValue = difference;
    colour = getRampColour(difference);
  }

  else if (DIAGNOSTIC_MODE === 1) {
    // How many valid acquisitions were found?
    diagnosticValue = sceneCount;

    if (sceneCount === 0) {
      colour = [0, 0, 0]; // black = no acquisitions
    } else if (sceneCount === 1) {
      colour = [1, 0.6, 0]; // orange = one acquisition
    } else {
      colour = [0, 0.8, 0]; // green = two or more acquisitions
    }
  }

  else if (DIAGNOSTIC_MODE === 2) {
    // Latest RVI
    diagnosticValue = latestRVI;

    if (!isFinite(latestRVI)) {
      colour = [0.2, 0.2, 0.2];
    } else {
      colour = [1 - latestRVI, latestRVI, 0];
    }
  }

  else if (DIAGNOSTIC_MODE === 3) {
    // Earliest RVI
    diagnosticValue = rviEarlier;

    if (!isFinite(rviEarlier)) {
      colour = [0.2, 0.2, 0.2];
    } else {
      colour = [1 - rviEarlier, rviEarlier, 0];
    }
  }

  else if (DIAGNOSTIC_MODE === 4) {
    // RVI difference, stretched for inspection
    diagnosticValue = difference;

    if (!isFinite(difference)) {
      colour = [0.2, 0.2, 0.2];
    } else {
      const stretched = Math.max(
        0,
        Math.min(
          1,
          (difference - MIN_DIFFERENCE) /
            (MAX_DIFFERENCE - MIN_DIFFERENCE)
        )
      );

      colour = [1 - stretched, stretched, 0];
    }
  }

  else if (DIAGNOSTIC_MODE === 5) {
    // Latest VV backscatter
    diagnosticValue = latestVV;

    if (!isFinite(latestVV)) {
      colour = [0.2, 0.2, 0.2];
    } else {
      const stretched = Math.max(0, Math.min(1, latestVV / 1));
      colour = [stretched, stretched, stretched];
    }
  }

  else if (DIAGNOSTIC_MODE === 6) {
    // Latest VH backscatter
    diagnosticValue = latestVH;

    if (!isFinite(latestVH)) {
      colour = [0.2, 0.2, 0.2];
    } else {
      const stretched = Math.max(0, Math.min(1, latestVH / 0.5));
      colour = [stretched, stretched, stretched];
    }
  }

  else if (DIAGNOSTIC_MODE === 7) {
    // Latest VH / VV ratio
    diagnosticValue = latestRatio;

    if (!isFinite(latestRatio)) {
      colour = [0.2, 0.2, 0.2];
    } else {
      const stretched = Math.max(0, Math.min(1, latestRatio / 1));
      colour = [stretched, stretched, 0];
    }
  }

  else {
    // Unknown diagnostic mode
    diagnosticValue = -999;
    colour = [1, 0, 1];
  }

  return {
    default: colour,
    difference: [diagnosticValue]
  };
}
