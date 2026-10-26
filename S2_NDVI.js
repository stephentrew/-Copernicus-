//VERSION=3
// Sentinel-2 L2A: show only significant vegetation-loss anomalies.
// Compares the latest valid acquisition with up to 5 previous valid acquisitions.

// ============================
// SETTINGS
// ============================

// INDEX_TYPE:
// 0 = NDVI
// 1 = NBR
const INDEX_TYPE = 0;

// SD_THRESHOLD:
// 2 = show values more than 2 SD below baseline
// 3 = show values more than 3 SD below baseline
const SD_THRESHOLD = 2;

// Maximum number of earlier valid acquisitions used as baseline
const MAX_BASELINE_SCENES = 5;

// ============================
// SCRIPT
// ============================

function setup() {
  return {
    input: ["B04", "B08", "B12", "SCL", "dataMask"],
    mosaicking: "ORBIT",
    output: [
      { id: "default", bands: 4, sampleType: "AUTO" },
      { id: "anomaly", bands: 1, sampleType: "FLOAT32" }
    ]
  };
}

function isValid(scene) {
  return (
    scene.dataMask === 1 &&
    scene.SCL !== 0 && // no data
    scene.SCL !== 1 && // saturated / defective
    scene.SCL !== 3 && // cloud shadow
    scene.SCL !== 8 && // cloud medium probability
    scene.SCL !== 9 && // cloud high probability
    scene.SCL !== 10 && // cirrus
    scene.SCL !== 11 // snow / ice
  );
}

function getIndex(scene) {
  if (INDEX_TYPE === 0) {
    // NDVI = (NIR - Red) / (NIR + Red)
    const red = scene.B04;
    const nir = scene.B08;

    if (!isFinite(red) || !isFinite(nir) || red + nir === 0) {
      return NaN;
    }

    return (nir - red) / (nir + red);
  }

  if (INDEX_TYPE === 1) {
    // NBR = (NIR - SWIR) / (NIR + SWIR)
    const nir = scene.B08;
    const swir = scene.B12;

    if (!isFinite(nir) || !isFinite(swir) || nir + swir === 0) {
      return NaN;
    }

    return (nir - swir) / (nir + swir);
  }

  return NaN;
}

function evaluatePixel(samples) {
  const validScenes = samples.filter(isValid);
  const sceneCount = validScenes.length;

  if (sceneCount < 2) {
    return {
      default: [0, 0, 0, 0],
      anomaly: [NaN]
    };
  }

  // Most recent valid acquisition
  const latest = validScenes[sceneCount - 1];
  const latestValue = getIndex(latest);

  // Up to five earlier valid acquisitions
  const baselineScenes = validScenes
    .slice(0, sceneCount - 1)
    .slice(-MAX_BASELINE_SCENES);

  let sum = 0;
  let sumSquares = 0;
  let baselineCount = 0;

  for (let i = 0; i < baselineScenes.length; i++) {
    const value = getIndex(baselineScenes[i]);

    if (isFinite(value)) {
      sum += value;
      sumSquares += value * value;
      baselineCount++;
    }
  }

  if (baselineCount < 2 || !isFinite(latestValue)) {
    return {
      default: [0, 0, 0, 0],
      anomaly: [NaN]
    };
  }

  const mean = sum / baselineCount;
  const variance = (sumSquares / baselineCount) - (mean * mean);
  const sd = Math.sqrt(Math.max(0, variance));

  const zScore = sd > 0 ? (latestValue - mean) / sd : 0;

  // Show only significant negative anomalies
  const isAnomaly = zScore < -SD_THRESHOLD;

  if (!isAnomaly) {
    return {
      default: [0, 0, 0, 0],
      anomaly: [NaN]
    };
  }

  // Colour by severity:
  // -2 SD = orange
  // -3 SD or stronger = dark red
  let r, g, b;

  if (zScore <= -3) {
    r = 0.65; g = 0.00; b = 0.05; // dark red: severe loss
  } else {
    r = 0.95; g = 0.45; b = 0.10; // orange-red: significant loss
  }

  return {
    default: [r, g, b, 1],
    anomaly: [zScore]
  };
}
