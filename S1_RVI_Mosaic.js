//VERSION=3
// Sentinel-1 IW Monthly Mosaic RVI change:
// latest available monthly mosaic minus earliest available monthly mosaic
// within the selected Copernicus Browser time range.

// DIAGNOSTIC_MODE:
// 0 = final RVI difference map
// 1 = number of monthly mosaics found
// 2 = latest RVI
// 3 = earliest RVI
// 4 = RVI difference, stretched
// 5 = latest VV
// 6 = latest VH
// 7 = latest VH / VV ratio

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
  // Use every IW Monthly Mosaic in the selected Browser time range.
  // The script compares the earliest and latest available mosaics.
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
  // Keep only valid mosaic pixels
  const validScenes = samples.filter(scene => scene.dataMask === 1);
  const mosaicCount = validScenes.length;

  let earlier = null;
  let later = null;
  let rviEarlier = NaN;
  let rviLater = NaN;
  let difference = NaN;

  if (mosaicCount >= 2) {
    earlier = validScenes[0];
    later = validScenes[mosaicCount - 1];

    rviEarlier = getRvi(earlier);
    rviLater = getRvi(later);

    if (isFinite(rviEarlier) && isFinite(rviLater)) {
      difference = rviLater - rviEarlier;
    }
  }

  // Values from the latest valid monthly mosaic
  const latestScene = mosaicCount > 0 ? validScenes[mosaicCount - 1] : null;
  const latestVV = latestScene ? latestScene.VV : NaN;
  const latestVH = latestScene ? latestScene.VH : NaN;
  const latestRatio = latestScene ? latestVH / latestVV : NaN;
  const latestRVI = latestScene ? getRvi(latestScene) : NaN;

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
    // How many monthly mosaics were found?
    diagnosticValue = mosaicCount;

    if (mosaicCount === 0) {
      r = 0; g = 0; b = 0; // black = no mosaics
    } else if (mosaicCount === 1) {
      r = 1; g = 0.6; b = 0; // orange = only one mosaic
    } else {
      r = 0; g = 0.8; b = 0; // green = two or more mosaics
    }
  }

  else if (DIAGNOSTIC_MODE === 2) {
    // Latest monthly mosaic RVI
    diagnosticValue = latestRVI;

    if (!isFinite(latestRVI)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      r = 1 - latestRVI;
      g = latestRVI;
      b = 0;
    }
  }

  else if (DIAGNOSTIC_MODE === 3) {
    // Earliest monthly mosaic RVI
    diagnosticValue = rviEarlier;

    if (!isFinite(rviEarlier)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      r = 1 - rviEarlier;
      g = rviEarlier;
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
    // Latest VV backscatter
    diagnosticValue = latestVV;

    if (!isFinite(latestVV)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      const stretched = Math.max(0, Math.min(1, latestVV / 1));
      r = stretched;
      g = stretched;
      b = stretched;
    }
  }

  else if (DIAGNOSTIC_MODE === 6) {
    // Latest VH backscatter
    diagnosticValue = latestVH;

    if (!isFinite(latestVH)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      const stretched = Math.max(0, Math.min(1, latestVH / 0.5));
      r = stretched;
      g = stretched;
      b = stretched;
    }
  }

  else if (DIAGNOSTIC_MODE === 7) {
    // Latest VH / VV ratio
    diagnosticValue = latestRatio;

    if (!isFinite(latestRatio)) {
      r = 0.2; g = 0.2; b = 0.2;
    } else {
      const stretched = Math.max(0, Math.min(1, latestRatio / 1));
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
