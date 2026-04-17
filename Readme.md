# Sentinel: Smart Video Surveillance System

## Overview

This project implements an end-to-end **AI-powered video surveillance system** that processes security camera footage to:

* Detect people in video frames
* Track individuals across frames with unique IDs
* Identify events of interest such as intrusion, loitering, and crowd formation
* Provide real-time analytics through a dashboard

The system is designed using a **modular pipeline architecture**, enabling scalability, configurability, and near real-time performance.

---

## Objectives

* Build a robust **person detection and tracking system**
* Implement **zone-based event detection**
* Generate **annotated video outputs and logs**
* Support **multi-video (multi-camera) processing**
* Provide a **frontend dashboard for monitoring**
* Include **evaluation and model comparison**

---

## Setup & Installation

Follow these steps to get the system running locally.

### 1. Prerequisites
* **Python:** 3.9 or higher
* **Node.js:** 18.x or higher
* **NPM:** 9.x or higher

### 2. Backend Setup (Flask)
The backend handles detection, tracking, and video processing.

```bash
# Navigate to the root folder
cd Video_Surveillance

# (Optional) Create a virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### 3. Running the System
You can run the system in two modes:

#### API Mode (Web Dashboard)
This is the recommended way to use the system with a full UI.
```bash
# Start the Flask server
python app.py
```
Then follow the **Frontend Setup** below to start the dashboard.

#### CLI Mode (Terminal Only)
Process a single video directly from the command line without the UI.

**Step 1: Draw detection zones** (Optional)
If you aren't using the dashboard, use this tool to define your restricted zones first:
```bash
python draw_zone.py video.mp4
```
*Click to add points, press ESC to save.*

**Step 2: Start processing**
```bash
python app.py --run video.mp4
```

### 4. Frontend Setup (React/Vite)
The frontend provides the user interface for monitoring and zone drawing.

```bash
# Navigate to the frontend folder
cd vigilant-view

# Install dependencies
npm install

# Start the development server
npm run dev
```
The dashboard will be available at `http://localhost:8080`.

---

## System Architecture

### Pipeline Flow

```text
Video Input
   |
Frame Extraction (OpenCV)
   |
Person Detection (YOLOv8)
   |
Multi-Object Tracking (ByteTrack)
   |
Zone-Based Event Detection
   |
Visualization (Bounding Boxes + Labels)
   |
Logging (CSV / API)
   |
Output Video + Dashboard
```

---

## Technologies Used

| Component        | Technology |
| ---------------- | ---------- |
| Detection        | YOLOv8     |
| Tracking         | ByteTrack  |
| Video Processing | OpenCV     |
| Geometry         | Shapely    |
| Backend          | Flask      |
| Frontend         | React      |
| State Management | Zustand    |
| Data Handling    | Pandas     |

---

## Event Definitions

### Intrusion
A person enters a predefined restricted zone.

### Loitering
A person stays inside a zone longer than a defined time threshold.

### Crowd Alert
Multiple people are present inside a zone beyond a defined threshold.

---

## Output Generation

### Annotated Video
* Bounding boxes, Track IDs, Event labels, and Zone overlay.

### Logs (CSV)
Detailed logs including `frame_number`, `person_id`, `event_type`, `timestamp`, and `bounding_box`.

---

## Frontend Dashboard Features

* **Multi-video upload:** Process several cameras at once.
* **Zone drawing tool:** Draw custom detection polygons directly on the video.
* **Live event updates:** Real-time alert stream as processing happens.
* **Configurable parameters:** Adjust confidence and loitering thresholds per video.

---

## Limitations
* **Occlusion:** Tracking IDs may swap if people cross paths closely.
* **Hardware:** High-resolution videos require a decent CPU/GPU for real-time performance.

---

## Conclusion
Sentinel demonstrates a complete **AI-based surveillance pipeline**, combining state-of-the-art detection (YOLOv8) and tracking (ByteTrack) with a modern, user-friendly dashboard.
