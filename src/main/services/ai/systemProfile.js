/**
 * systemProfile.js
 *
 * Hardware probe used to recommend a local model that will actually run on the
 * machine instead of the biggest one that fits on a developer laptop.
 *
 * Detection is intentionally dependency-free: `os` for memory and cores, and a
 * single short-lived PowerShell query for the graphics adapter. The GPU call is
 * best-effort and cached for the process lifetime; if it fails the profile is
 * still useful, only less precise.
 */

const os = require('os');
const { execFile } = require('child_process');

const GB = 1024 * 1024 * 1024;

/** Model tiers, ordered from lightest to heaviest. */
const TIERS = [
  {
    id: 'light',
    minRamGb: 0,
    minCores: 0,
    model: 'llama3.2:1b',
    labelKey: 'ai.tier_light',
    noteKey: 'ai.tier_light_note',
  },
  {
    id: 'balanced',
    minRamGb: 8,
    minCores: 4,
    model: 'llama3.2:3b',
    labelKey: 'ai.tier_balanced',
    noteKey: 'ai.tier_balanced_note',
  },
  {
    id: 'high',
    minRamGb: 16,
    minCores: 6,
    model: 'qwen2.5:7b',
    labelKey: 'ai.tier_high',
    noteKey: 'ai.tier_high_note',
  },
];

let cachedGpu;
let gpuProbe;

function probeGpu() {
  if (cachedGpu !== undefined) return Promise.resolve(cachedGpu);
  if (gpuProbe) return gpuProbe;

  gpuProbe = new Promise((resolve) => {
    const script = [
      '$ErrorActionPreference = "SilentlyContinue"',
      'Get-CimInstance Win32_VideoController |',
      '  Where-Object { $_.Name } |',
      '  Select-Object -First 1 -ExpandProperty Name',
    ].join(' ');

    const done = (value) => {
      cachedGpu = value || '';
      gpuProbe = null;
      resolve(cachedGpu);
    };

    try {
      const child = execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script],
        { timeout: 4000, windowsHide: true },
        (error, stdout) => done(error ? '' : String(stdout || '').trim())
      );
      // execFile's timeout kills the process; the callback still fires.
      child.on('error', () => done(''));
    } catch {
      done('');
    }
  });

  return gpuProbe;
}

function tierFor(ramGb, cores, gpu) {
  const hasDiscrete = /nvidia|geforce|radeon|arc\s|quadro|rtx|gtx/i.test(gpu || '');
  let chosen = TIERS[0];
  for (const tier of TIERS) {
    if (ramGb >= tier.minRamGb && cores >= tier.minCores) chosen = tier;
  }
  // A discrete GPU is useful for larger models even below the RAM threshold,
  // but only when the machine still has headroom (12 GB).
  if (hasDiscrete && ramGb >= 12 && chosen.id === 'balanced') {
    chosen = TIERS[2];
  }
  return { ...chosen, hasDiscrete };
}

async function profile({ force = false } = {}) {
  if (force) {
    cachedGpu = undefined;
    gpuProbe = null;
  }
  const gpu = await probeGpu();
  const totalRamGb = Math.round((os.totalmem() / GB) * 10) / 10;
  const freeRamGb = Math.round((os.freemem() / GB) * 10) / 10;
  const cores = os.cpus()?.length || 1;
  const arch = os.arch();
  const tier = tierFor(totalRamGb, cores, gpu);

  return {
    platform: os.platform(),
    arch,
    totalRamGb,
    freeRamGb,
    cores,
    gpu: gpu || '',
    cpu: os.cpus()?.[0]?.model || '',
    tier: {
      id: tier.id,
      labelKey: tier.labelKey,
      noteKey: tier.noteKey,
      model: tier.model,
    },
    canRunLocal: totalRamGb >= 4,
  };
}

module.exports = { profile, tierFor, TIERS };
