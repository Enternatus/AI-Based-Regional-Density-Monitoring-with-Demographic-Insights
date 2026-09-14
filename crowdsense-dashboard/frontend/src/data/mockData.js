export const runData = {
  run_id: "cs-run-20240914-0047",
  run_status: "live",
  source_video: "sample_crowd.mp4",
  video_fps: 30,
  frame_index: 450,
  started_at: "2026-09-14T08:04:11Z",
  updated_at: "2026-09-14T09:59:43Z",
  completed_at: null,
};

export const kpiData = {
  current_total: 14,
  peak_session: 21,
  busiest_zone: "Zone A — North Entrance",
  people_analyzed: 27,
};

export const regions = [
  {
    id: "zone_a",
    label: "Zone A",
    sublabel: "North Entrance",
    current: 4,
    session_avg: 4,
    peak: 7,
    trend: 1,
    density_state: "moderate",
    threshold_low: 3,
    threshold_high: 8,
  },
  {
    id: "zone_b",
    label: "Zone B",
    sublabel: "Central Plaza",
    current: 7,
    session_avg: 6,
    peak: 10,
    trend: 2,
    density_state: "moderate",
    threshold_low: 3,
    threshold_high: 8,
  },
  {
    id: "zone_c",
    label: "Zone C",
    sublabel: "South Corridor",
    current: 3,
    session_avg: 3,
    peak: 5,
    trend: -1,
    density_state: "low",
    threshold_low: 3,
    threshold_high: 8,
  },
];

export const trendSnapshots = [
  { frame: 120, time: "12:00", total: 8, zone_a: 2, zone_b: 4, zone_c: 2 },
  { frame: 180, time: "12:05", total: 11, zone_a: 3, zone_b: 5, zone_c: 3 },
  { frame: 240, time: "12:10", total: 13, zone_a: 4, zone_b: 6, zone_c: 3 },
  { frame: 300, time: "12:15", total: 15, zone_a: 5, zone_b: 7, zone_c: 3 },
  { frame: 360, time: "12:20", total: 18, zone_a: 6, zone_b: 8, zone_c: 4 },
  { frame: 420, time: "12:25", total: 14, zone_a: 4, zone_b: 7, zone_c: 3 },
];

export const demographicSnapshot = {
  predominant_gender: "Male",
  gender_dist: { male: 67, female: 33 },
  primary_age_bracket: "20-29",
  age_dist: [
    { range: "10-19", pct: 7 },
    { range: "20-29", pct: 52 },
    { range: "30-39", pct: 30 },
    { range: "40-49", pct: 11 },
  ],
  appearance_group: "White",
  common_clothing_color: "Black",
};

export const inferenceTypes = [
  {
    key: "confirmed",
    label: "Confirmed / Settled",
    count: 12,
    color: "live",
    description: "Multi-frame temporally smoothed prediction passing quality and stability gates.",
  },
  {
    key: "best_available",
    label: "Best Available",
    count: 10,
    color: "warning",
    description: "Highest-confidence raw prediction when track was not observed long enough to settle.",
  },
  {
    key: "low_quality",
    label: "Low-Quality Estimate",
    count: 5,
    color: "critical",
    description: "Filtered low-quality observation. Kept for visibility, treat as indicative only.",
  },
];
