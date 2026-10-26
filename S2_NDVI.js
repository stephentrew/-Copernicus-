//VERSION=3
// Sentinel-2 L2A: show only significant NDVI or NBR loss anomalies.
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

// Maximum permitted cloud/shadow cover for a pixel, as a percentage
// across all available acquisitions in the selected time range.
// Set to 100 to disable this extra pixel-level cloud check.
const MAX_PIXEL_CLOUD_COVER_PERCENT = 50;

// DIAGNOSTIC_MODE:
// 0 = anomaly map: only significant negative anomalies are visible
// 1 = number of valid baseline scenes
// 2 = latest NDVI or NBR
// 3 = baseline mean
// 4 = baseline standard deviation
// 5 = z-score
// 6 = pixel cloud-cover percentage

const DIAGNOSTIC_MODE = 0;

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

function isCloudOrShadow(scene) {
  return (
    scene.SCL === 3 || // cloud shadow
    scene.SCL === 8 || // cloud medium probability
    scene.SCL === 9 || // cloud high probability
    scene.SCL === 10 // cirrus
  );
}

function isInvalid(scene) {
  return (
    scene.dataMask !== 1 ||
    scene.SCL === 0 || // no data
    scene.SCL === 1 || // saturated / defective
    scene.SCL === 11 // snow / ice
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
  const totalScenes = samples.length;

  if (totalScenes === 0) {
    return {
      default: [0, 0, 0, 0],
      anomaly: [NaN]
    };
  }

  // Calculate cloud/shadow percentage for this pixel
  let cloudCount = 0;

  for (let i = 0; i < totalScenes; i++) {
    if (samples[i].dataMask === 1 && isCloudOrShadow(samples[i])) {
      cloudCount++;
    }
  }

  const cloudCoverPercent = (cloudCount / totalScenes) * 100;

  // Exclude pixels that are too often cloudy or shadowed
  if (cloudCoverPercent > MAX_PIXEL_CLOUD_COVER_PERCENT) {
    return {
      default: [0, 0, 0, 0],
      anomaly: [NaN]
    };
  }

  // Keep only clear, usable acquisitions
  const validScenes = samples.filter(
    scene => scene.dataMask === 1 && !isCloudOrShadow(scene) && !isInvalid(scene)
  );

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
  // -2 SD = orange-red
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
