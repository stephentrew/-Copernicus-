//VERSION=3
// Sentinel-2 NDWI anomaly:
// latest acquisition compared with up to 5 previous valid acquisitions.
// Detects values more than 2 SD from the earlier baseline.

// ANOMALY_DIRECTION:
// -1 = detect unusually low NDWI
// 1 = detect unusually high NDWI
// 0 = detect either unusually low or high NDWI

const DIAGNOSTIC_MODE = 0;
const ANOMALY_DIRECTION = 0;
const SD_THRESHOLD = 2.0;
const MAX_BASELINE_SCENES = 5;

function setup() {
  return {
    input: ["B03", "B08", "SCL", "dataMask"],
    mosaicking: "ORBIT",
    output: [
      { id: "default", bands: 3, sampleType: "AUTO" },
      { id: "anomaly", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}

function isValid(scene) {
  return (
    scene.dataMask === 1 &&
    scene.SCL !== 0 &&
    scene.SCL !== 1 &&
    scene.SCL !== 3 &&
    scene.SCL !== 8 &&
    scene.SCL !== 9 &&
    scene.SCL !== 10 &&
    scene.SCL !== 11
  );
}

function getNdwi(scene) {
  const green = scene.B03;
  const nir = scene.B08;

  if (!isFinite(green) || !isFinite(nir) || green + nir === 0) {
    return NaN;
  }

  return (green - nir) / (green + nir);
}

function evaluatePixel(samples) {
  const validScenes = samples.filter(isValid);
  const sceneCount = validScenes.length;

  if (sceneCount < 2) {
    return {
      default: [0.15, 0.15, 0.15],
      anomaly: [NaN]
    };
  }

  const latest = validScenes[sceneCount - 1];
  const latestNdwi = getNdwi(latest);

  const baselineScenes = validScenes
    .slice(0, sceneCount - 1)
    .slice(-MAX_BASELINE_SCENES);

  let sum = 0;
  let sumSquares = 0;
  let validCount = 0;

  for (let i = 0; i < baselineScenes.length; i++) {
    const value = getNdwi(baselineScenes[i]);

    if (isFinite(value)) {
      sum += value;
      sumSquares += value * value;
      validCount++;
    }
  }

  if (validCount < 2 || !isFinite(latestNdwi)) {
    return {
      default: [0.15, 0.15, 0.15],
      anomaly: [NaN]
    };
  }

  const mean = sum / validCount;
  const variance = (sumSquares / validCount) - (mean * mean);
  const sd = Math.sqrt(Math.max(0, variance));

  const zScore = sd > 0 ? (latestNdwi - mean) / sd : 0;

  let isAnomaly = false;

  if (ANOMALY_DIRECTION === -1) {
    isAnomaly = zScore < -SD_THRESHOLD;
  } else if (ANOMALY_DIRECTION === 1) {
    isAnomaly = zScore > SD_THRESHOLD;
  } else {
    isAnomaly = Math.abs(zScore) > SD_THRESHOLD;
  }

  let diagnosticValue = NaN;
  let r = 0;
  let g = 0;
  let b = 0;

  if (DIAGNOSTIC_MODE === 0) {
    diagnosticValue = zScore;

    if (isAnomaly && zScore > 0) {
      r = 0.05; g = 0.35; b = 0.85; // unusually wet / more water - blue
    } else if (isAnomaly && zScore < 0) {
      r = 0.85; g = 0.05; b = 0.10; // unusually dry / less water - red
    } else if (Math.abs(zScore) > 1.0) {
      r = 0.95; g = 0.75; b = 0.25; // near threshold - orange
    } else {
      r = 0.90; g = 0.90; b = 0.90; // normal - pale grey
    }
  }

  else if (DIAGNOSTIC_MODE === 1) {
    diagnosticValue = validCount;

    if (validCount < 2) {
      r = 0; g = 0; b = 0;
    } else if (validCount < 5) {
      r = 1; g = 0.6; b = 0;
    } else {
      r = 0; g = 0.8; b = 0;
    }
  }

  else if (DIAGNOSTIC_MODE === 2) {
    diagnosticValue = latestNdwi;
    const stretched = Math.max(0, Math.min(1, (latestNdwi + 1) / 2));
    r = 1 - stretched;
    g = stretched;
    b = 0;
  }

  else if (DIAGNOSTIC_MODE === 3) {
    diagnosticValue = mean;
    const stretched = Math.max(0, Math.min(1, (mean + 1) / 2));
    r = 1 - stretched;
    g = stretched;
    b = 0;
  }

  else if (DIAGNOSTIC_MODE === 4) {
    diagnosticValue = sd;
    const stretched = Math.max(0, Math.min(1, sd / 0.2));
    r = stretched;
    g = stretched;
    b = stretched;
  }

  else if (DIAGNOSTIC_MODE === 5) {
    diagnosticValue = zScore;
    const stretched = Math.max(0, Math.min(1, (zScore + 3) / 6));
    r = 1 - stretched;
    g = stretched;
    b = 0;
  }

  else {
    diagnosticValue = -999;
    r = 1; g = 0; b = 1;
  }

  return {
    default: [r, g, b],
    anomaly: [diagnosticValue]
  };
}
