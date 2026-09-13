# CrowdSense V2.1 REST API Contract & Specification

**Document Version:** 2.1.0  
**Base URL:** `http://127.0.0.1:8000` (Local) / `/api`  
**Protocol:** HTTP/1.1 with JSON payloads and MJPEG/MP4 binary streaming  
**Data Sources:**
- **Regional Density Feed:** Derived from `sample_crowd.mp4` (wide-angle overhead perspective).
- **Demographic Explorer Feed:** Derived from `close_range_crowd.mp4` (face/body recognition corridor).
- **AI Model Provenance:** YOLOv8 (spatial density tracking), FairFace (demographic attributes), and HSV color clustering.

---

## 1. System Run Status Lifecycle

CrowdSense models execution status as first-class states across the overview and density endpoints:

| State | Description |
| :--- | :--- |
| `live` / `running` | Detection engine actively processing video frames or recent heartbeat active (< 10s). |
| `paused` | Engine process active but frame advancement paused by operator. |
| `stopped` | Process terminated prior to end of video file. |
| `completed` | Full video sequence successfully processed through final frame. |
| `idle` | System awaiting new processing task; no active process detected. |

---

## 2. API Endpoints Summary

| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, file availability, and hardware status | None |
| `GET` | `/api/overview` | Aggregated executive KPIs across density and demographics | None |
| `GET` | `/api/regions/density` | Live spatial region occupancy, thresholds, and run metadata | None |
| `GET` | `/api/density/history` | Rolling chronological density history for time-series charts | None |
| `POST` | `/api/search` | Natural-language and multi-attribute demographic search | None |
| `GET` | `/api/people/summary` | Demographic statistical aggregations (gender, age, race, colors) | None |
| `GET` | `/api/persons/{person_id}` | Detailed telemetry profile for a single tracked individual | None |
| `GET` | `/api/persons/{person_id}/crop` | High-resolution cropped JPEG image of tracked individual | None |
| `GET` | `/api/video/density` | HTTP byte-range MP4 stream of density camera video | None |
| `GET` | `/api/video/demographics` | HTTP byte-range MP4 stream of demographics camera video | None |
| `GET` | `/api/stream/density` | Real-time MJPEG live camera stream with spatial overlays | None |

---

## 3. Detailed Endpoint Specifications

### 3.1 Health Check
**`GET /api/health`**

Inspects backend availability, verifying database/file stores and GPU/CPU detection.

#### Response: `200 OK`
```json
{
  "status": "healthy",
  "data_files": {
    "density": true,
    "demographics": true
  },
  "counts": {
    "persons_indexed": 27
  },
  "timestamp": "2026-09-13T20:50:00.000000Z"
}
```

---

### 3.2 System Overview
**`GET /api/overview`**

Provides consolidated top-level telemetry uniting both independent video analysis pipelines.

#### Response: `200 OK`
```json
{
  "density": {
    "current_total": 14,
    "peak_total": 21,
    "region_count": 6,
    "trend_direction": "stable",
    "updated_at": "2026-09-13T20:49:55.123456Z",
    "busiest_region": "center_plaza",
    "run_status": "completed",
    "run_id": "run_20260913_184512",
    "frame_index": 450,
    "source_video": "sample_crowd.mp4",
    "video_fps": 30.0
  },
  "demographics": {
    "total_detected": 27,
    "gender_breakdown": {
      "Male": 18,
      "Female": 9
    },
    "male_pct": 66.7,
    "female_pct": 33.3,
    "top_age_bracket": "20-29",
    "top_clothing_color": "black",
    "data_quality": {
      "settled": 12,
      "best_raw": 10,
      "last_resort": 5
    },
    "provenance": "Derived from close-range demographic camera (close_range_crowd.mp4)"
  },
  "architecture_note": "Density and demographic metrics originate from distinct camera perspectives and must not be conflated."
}
```

---

### 3.3 Regional Density Telemetry
**`GET /api/regions/density`**

Returns spatial occupancy for each defined polygonal region along with threshold classifications.

#### Response: `200 OK`
```json
{
  "regions": [
    {
      "region_id": "zone_a",
      "name": "North Entrance",
      "count": 4,
      "density_level": "medium",
      "status": "MEDIUM"
    },
    {
      "region_id": "zone_b",
      "name": "Main Corridor",
      "count": 8,
      "density_level": "high",
      "status": "HIGH"
    }
  ],
  "current_total": 12,
  "peak_total": 18,
  "trend_direction": "rising",
  "thresholds": {
    "low": 3,
    "high": 8
  },
  "busiest_region": "Main Corridor",
  "run_id": "run_20260913_184512",
  "run_status": "completed",
  "source_video": "sample_crowd.mp4",
  "video_fps": 30.0,
  "frame_index": 450,
  "started_at": "2026-09-13T18:45:12.000000Z",
  "updated_at": "2026-09-13T18:48:30.000000Z",
  "completed_at": "2026-09-13T18:48:30.000000Z"
}
```

---

### 3.4 Density History Time-Series
**`GET /api/density/history`**

Retrieves a rolling buffer of density snapshots for trend visualization.

#### Query Parameters:
- `limit` *(integer, optional, default: 30)*: Number of chronological snapshots to retrieve (1–200).

#### Response: `200 OK`
```json
{
  "snapshots": [
    {
      "timestamp": "2026-09-13T18:45:15.000000Z",
      "frame_index": 30,
      "total_count": 8,
      "region_counts": {
        "zone_a": 3,
        "zone_b": 5
      }
    }
  ],
  "count": 1,
  "run_status": "completed"
}
```

---

### 3.5 Demographic Search & Exploration
**`POST /api/search`**

Executes multi-attribute NLP and structured filter queries over tracked individual records.

#### Request Body Schema:
```json
{
  "text": "woman in a black shirt",
  "gender": "Female",
  "age": null,
  "race": null,
  "clothing_color": "black",
  "source": "settled",
  "match_mode": "all"
}
```

#### Request Fields:
- `text` *(string)*: Freeform natural language query (e.g. `"young man in blue shirt"`).
- `gender` *(string, optional)*: `"Male"` or `"Female"`.
- `age` *(string, optional)*: Age bracket (e.g. `"20-29"`).
- `race` *(string, optional)*: Appearance group (`"White"`, `"East Asian"`, `"Indian"`, `"Middle Eastern"`, `"Hispanic / Latino"`).
- `clothing_color` *(string, optional)*: Shirt color keyword.
- `source` *(string, optional)*: Quality filter (`"settled"`, `"best_raw"`, `"last_resort"`).
- `match_mode` *(string, optional, default: `"all"`)*:
  - `"all"`: Strict boolean AND logic (must satisfy all specified criteria).
  - `"any"`: Flexible boolean OR logic (matches any criteria with scoring priority).

#### Response: `200 OK`
```json
{
  "results": [
    {
      "person_id": 16,
      "gender": "Female",
      "gender_conf": 92.4,
      "age": "20-29",
      "age_conf": 84.1,
      "race": "White",
      "race_conf": 78.5,
      "clothing_color": "black",
      "source": "settled",
      "first_seen_frame": 120,
      "last_seen_frame": 240,
      "crop_available": true
    }
  ],
  "result_count": 1,
  "query_text": "woman in a black shirt",
  "match_mode": "all",
  "parsed_filters": {
    "gender": "Female",
    "clothing_color": "black"
  }
}
```

---

### 3.6 Demographic Population Summary
**`GET /api/people/summary`**

Aggregates demographic distribution across the indexed cohort.

#### Response: `200 OK`
```json
{
  "total": 27,
  "gender": {
    "Male": 18,
    "Female": 9
  },
  "age_groups": {
    "10-19": 2,
    "20-29": 14,
    "30-39": 8,
    "40-49": 3
  },
  "appearance_groups": {
    "White": 11,
    "East Asian": 6,
    "Indian": 5,
    "Middle Eastern": 3,
    "Latino_Hispanic": 2
  },
  "clothing_colors": {
    "black": 10,
    "grey": 7,
    "white": 4,
    "blue": 3,
    "red": 2,
    "green": 1
  },
  "data_quality": {
    "settled": 12,
    "best_raw": 10,
    "last_resort": 5
  }
}
```

---

### 3.7 Individual Profile Telemetry
**`GET /api/persons/{person_id}`**

Retrieves multi-frame observation history and confidence scores for a tracked track ID.

#### Path Parameters:
- `person_id` *(integer, required)*: The unique integer track identifier.

#### Response: `200 OK`
```json
{
  "person_id": 16,
  "gender": "Female",
  "gender_conf": 92.4,
  "age": "20-29",
  "age_conf": 84.1,
  "race": "White",
  "race_conf": 78.5,
  "clothing_color": "black",
  "source": "settled",
  "first_seen_frame": 120,
  "last_seen_frame": 240,
  "total_frames_tracked": 120,
  "crop_available": true
}
```

#### Errors:
- `404 Not Found`: Person ID not in indexed dataset.

---

### 3.8 Individual Crop Image
**`GET /api/persons/{person_id}/crop`**

Serves high-resolution face/upper-body JPEG image crops with secure traversal protection.

#### Path Parameters:
- `person_id` *(integer, required)*: Integer track identifier.

#### Response: `200 OK`
- **Content-Type:** `image/jpeg`
- Binary JPEG data.

#### Errors:
- `404 Not Found`: Person ID or corresponding crop image file does not exist.

---

### 3.9 Video Media Streaming Endpoints
- **`GET /api/video/density`**: Stream MP4 video for wide-angle regional density surveillance.
- **`GET /api/video/demographics`**: Stream MP4 video for close-range demographic evaluation.
- **`GET /api/stream/density`**: Real-time `multipart/x-mixed-replace; boundary=frame` MJPEG stream with detection bounding boxes and zone overlays.

---

## 4. Error Representation

Standard HTTP error responses conform to FastAPI JSON error schemas:

```json
{
  "detail": "Person ID 999 not found"
}
```

Common status codes:
- `200 OK`: Request succeeded.
- `400 Bad Request`: Malformed parameters or invalid payload.
- `404 Not Found`: Resource or file not located.
- `500 Internal Server Error`: Backend execution fault.
