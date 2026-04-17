import os
import cv2
import json
import time
import threading
import argparse
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from ultralytics import YOLO
import supervision as sv
from shapely.geometry import Point, Polygon

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
LOG_FOLDER = "logs"
ZONE_FOLDER = "zones"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(LOG_FOLDER, exist_ok=True)
os.makedirs(ZONE_FOLDER, exist_ok=True)

import subprocess

# 🔥 GLOBAL STATE
STATE = {
    "processing": "idle",
    "current_video": None,
    "results": {} # video_name -> { stats, logs, progress, etc }
}

def get_video_state(video_name):
    if video_name not in STATE["results"]:
        STATE["results"][video_name] = {
            "progress": 0,
            "current_frame": 0,
            "total_frames": 0,
            "fps": 0,
            "total_people": 0,
            "intrusions": 0,
            "loitering": 0,
            "crowd_alerts": 0,
            "logs": []
        }
    return STATE["results"][video_name]

# Live frame for streaming
LATEST_FRAME = None
FRAME_LOCK = threading.Lock()

# Load model globally to avoid reloading
model = YOLO("yolov8n.pt") # Using nano for speed

# 🚀 PROCESS FUNCTION
def process_video(video_name, config):
    global LATEST_FRAME
    STATE["current_video"] = video_name

    video_path = os.path.join(UPLOAD_FOLDER, video_name)
    if not os.path.exists(video_path):
        STATE["processing"] = "error"
        return

    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        STATE["processing"] = "error"
        return

    width = int(cap.get(3))
    height = int(cap.get(4))
    fps_video = cap.get(cv2.CAP_PROP_FPS) or 30

    # We use a temporary raw output and then convert with ffmpeg for web compatibility
    raw_output_path = os.path.join(OUTPUT_FOLDER, f"raw_{video_name}")
    output_basename = os.path.splitext(video_name)[0] + ".mp4"
    final_output_path = os.path.join(OUTPUT_FOLDER, f"processed_{output_basename}")

    # mp4v is generally supported for writing by OpenCV, even if not by browsers
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(raw_output_path, fourcc, fps_video, (width, height))

    # Load zone(s)
    zone_file = os.path.join(ZONE_FOLDER, f"{video_name}.json")
    zones = []
    if os.path.exists(zone_file):
        with open(zone_file) as f:
            data = json.load(f)
            # Use points_normalised and scale to video resolution
            raw_pts = data.get("points_normalised") or data.get("points")
            if raw_pts:
                pts = [[p["x"] * width, p["y"] * height] for p in raw_pts]
                zones.append({
                    "polygon": Polygon(pts),
                    "pts_array": np.array(pts, np.int32).reshape((-1, 1, 2))
                })

    tracker = sv.ByteTrack()

    frame_count = 0
    loiter_start = {}
    previous_inside = {} # track_id -> bool
    last_log_frame = {}  # (track_id, event) -> last_frame
    LOG_GAP = 30 # deduplication gap (approx 1 second at 30fps)
    
    # Get per-video state
    vstate = get_video_state(video_name)
    vstate["progress"] = 0
    vstate["current_frame"] = 0
    vstate["total_frames"] = total_frames
    vstate["total_people"] = 0
    vstate["intrusions"] = 0
    vstate["loitering"] = 0
    vstate["crowd_alerts"] = 0
    vstate["logs"] = []

    t0 = time.time()

    while True:
        # --- Pause / Stop Logic ---
        if STATE["processing"] == "paused":
            time.sleep(0.1)
            continue
        if STATE["processing"] == "idle": # Force stop
            break

        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        
        # Real FPS calculation
        elapsed = time.time() - t0
        actual_fps = frame_count / elapsed if elapsed > 0 else 0
        
        vstate["current_frame"] = frame_count
        vstate["progress"] = frame_count / total_frames
        vstate["fps"] = round(actual_fps, 2)

        # Draw zones on frame
        for z in zones:
            cv2.polylines(frame, [z["pts_array"]], True, (255, 0, 0), 2)

        # Inference
        results = model(frame, verbose=False)[0]

        boxes = []
        scores = []

        for box in results.boxes:
            if int(box.cls[0]) == 0: # person class
                conf = float(box.conf[0])
                if conf > config["confidence"]:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    boxes.append([x1, y1, x2, y2])
                    scores.append(conf)

        if boxes:
            detections = sv.Detections(
                xyxy=np.array(boxes),
                confidence=np.array(scores),
                class_id=np.zeros(len(boxes), dtype=int)
            )
            tracks = tracker.update_with_detections(detections)
        else:
            tracks = sv.Detections.empty()

        current_people_ids = set()
        zone_people_count = 0
        
        for i in range(len(tracks)):
            x1, y1, x2, y2 = tracks.xyxy[i].astype(int)
            track_id = int(tracks.tracker_id[i])
            current_people_ids.add(track_id)

            cx, cy = (x1+x2)//2, (y1+y2)//2
            point = Point(cx, cy)

            event = "tracking"
            inside_any_zone = False

            for z in zones:
                if z["polygon"].contains(point):
                    inside_any_zone = True
                    zone_people_count += 1
                    
                    if track_id not in loiter_start:
                        loiter_start[track_id] = frame_count

                    duration = frame_count - loiter_start[track_id]
                    duration_sec = duration / fps_video

                    if duration_sec > config["loiter"]:
                        event = "loitering"
                    else:
                        event = "intrusion"

            # Exit detection
            if previous_inside.get(track_id, False) and not inside_any_zone:
                event = "exit"
            
            # Update history for next frame
            previous_inside[track_id] = inside_any_zone
            if not inside_any_zone and track_id in loiter_start:
                del loiter_start[track_id]

            # Colors
            color = (0, 255, 0) # Green (Tracking)
            if event == "intrusion": color = (0, 165, 255) # Orange
            if event == "loitering": color = (0, 0, 255)    # Red
            if event == "exit":      color = (255, 255, 0)  # Cyan/Yellow

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, f"{event.upper()} ID {track_id}", (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            # DEDUPLICATED LOGGING
            log_key = (track_id, event)
            if frame_count - last_log_frame.get(log_key, -999) > LOG_GAP:
                if event != "tracking" or log_key not in last_log_frame:
                    vstate["logs"].append({
                        "id": len(vstate["logs"]) + 1,
                        "frame": frame_count,
                        "person_id": track_id,
                        "event_type": event.capitalize(),
                        "timestamp": time.strftime("%H:%M:%S", time.gmtime(frame_count / fps_video))
                    })
                    last_log_frame[log_key] = frame_count
                    
                    if event == "intrusion": vstate["intrusions"] += 1
                    if event == "loitering": vstate["loitering"] += 1

        vstate["total_people"] = len(current_people_ids)
        if zone_people_count >= config.get("crowd_threshold", 5):
            vstate["crowd_alerts"] += 1
            cv2.putText(frame, "CROWD ALERT!", (50, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        out.write(frame)

        # Update streaming frame
        with FRAME_LOCK:
            LATEST_FRAME = frame.copy()

    cap.release()
    out.release()

    # --- Convert to Web-Friendly MP4 using FFmpeg ---
    print(f"Finalising video: {final_output_path}")
    try:
        # -y (overwrite), -c:v libx264 (H.264), -pix_fmt yuv420p (broad compatibility), -movflags +faststart (streamable)
        cmd = [
            'ffmpeg', '-y', '-i', raw_output_path,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast', '-crf', '23',
            '-movflags', '+faststart',
            final_output_path
        ]
        subprocess.run(cmd, check=True)
        # Clean up raw temp file
        if os.path.exists(raw_output_path):
            os.remove(raw_output_path)
    except Exception as e:
        print(f"FFmpeg conversion failed: {e}")
        # If ffmpeg fails, rename raw to processed as fallback
        if os.path.exists(raw_output_path):
            os.rename(raw_output_path, final_output_path)

    STATE["processing"] = "completed"


# ================= API =================

@app.route("/upload", methods=["POST"])
def upload():
    # Handle both "files" and "files[]"
    files = request.files.getlist("files") or request.files.getlist("files[]")
    names = []

    for f in files:
        if f.filename:
            path = os.path.join(UPLOAD_FOLDER, f.filename)
            f.save(path)
            names.append(f.filename)

    return jsonify({"filenames": names})


@app.route("/zones", methods=["POST"])
def save_zone():
    data = request.json
    video = data.get("video")
    if not video:
        return jsonify({"error": "No video specified"}), 400

    # Save exactly what React sends
    with open(os.path.join(ZONE_FOLDER, f"{video}.json"), "w") as f:
        json.dump(data, f)

    return jsonify({"ok": True})


@app.route("/process", methods=["POST"])
def process():
    data = request.json

    config = {
        "confidence": data.get("confidence_threshold", 0.3),
        "loiter": data.get("loitering_time", 5),
        "crowd_threshold": data.get("crowd_threshold", 5)
    }

    videos = data.get("videos", [])
    if not videos:
        return jsonify({"error": "No videos provided"}), 400
        
    if STATE["processing"] == "processing":
        return jsonify({"error": "Already processing. Please wait or pause first."}), 400

    STATE["processing"] = "processing"
    STATE["current_video"] = None

    def run_all():
        try:
            video_configs = data.get("video_configs", {})
            for v in videos:
                # Check if still processing (might have been paused/stopped)
                if STATE["processing"] != "processing":
                    break
                
                try:
                    v_cfg_raw = video_configs.get(v, data)
                    v_cfg = {
                        "confidence": v_cfg_raw.get("confidence_threshold", 0.3),
                        "loiter": v_cfg_raw.get("loitering_time", 5),
                        "crowd_threshold": v_cfg_raw.get("crowd_threshold", 5)
                    }
                    process_video(v, v_cfg)
                    # Clear current video after it finishes
                    STATE["current_video"] = None
                except Exception as e:
                    print(f"Error processing video {v}: {e}")
                    # Allow it to continue to next video
                    STATE["current_video"] = None
        finally:
            if STATE["processing"] == "processing":
                STATE["processing"] = "completed"
                STATE["current_video"] = None
    
    threading.Thread(target=run_all).start()

    return jsonify({"ok": True})


@app.route("/status")
def status():
    # Return the state based on active video parameter
    video_name = request.args.get("video")
    if not video_name:
        return jsonify({
            "state": STATE["processing"],
            "progress": 0,
            "current_frame": 0,
            "total_frames": 0,
            "fps": 0,
            "total_people": 0,
            "intrusions": 0,
            "loitering": 0,
            "crowd_alerts": 0
        })
    
    vstate = get_video_state(video_name)
    return jsonify({
        "state": STATE["processing"],
        "current_video": STATE["current_video"],
        "progress": vstate["progress"],
        "current_frame": vstate["current_frame"],
        "total_frames": vstate["total_frames"],
        "fps": vstate["fps"],
        "total_people": vstate["total_people"],
        "intrusions": vstate["intrusions"],
        "loitering": vstate["loitering"],
        "crowd_alerts": vstate["crowd_alerts"]
    })


@app.route("/logs")
def logs():
    video_name = request.args.get("video")
    if not video_name:
        return jsonify([])
    vstate = get_video_state(video_name)
    return jsonify(vstate["logs"][-100:])


@app.route("/pause", methods=["POST"])
def pause():
    if STATE["processing"] == "processing":
        STATE["processing"] = "paused"
    return jsonify({"ok": True, "state": STATE["processing"]})


@app.route("/resume", methods=["POST"])
def resume():
    if STATE["processing"] == "paused":
        STATE["processing"] = "processing"
    return jsonify({"ok": True, "state": STATE["processing"]})


@app.route("/stream")
def stream():
    def generate():
        while True:
            with FRAME_LOCK:
                if LATEST_FRAME is None:
                    time.sleep(0.1)
                    continue
                ret, buffer = cv2.imencode('.jpg', LATEST_FRAME)
                if not ret:
                    continue
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            time.sleep(0.03) # ~30fps
    return Flask.response_class(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route("/video")
def video():
    name = request.args.get("name")
    if not name:
        return jsonify({"error": "No name provided"}), 400
    
    # Try processed first (always .mp4 now)
    base_name = os.path.splitext(name)[0]
    processed_path = os.path.join(OUTPUT_FOLDER, f"processed_{base_name}.mp4")
    
    if os.path.exists(processed_path):
        # Force attachment for download if requested
        as_attachment = request.args.get("download") == "1"
        return send_file(processed_path, mimetype="video/mp4", 
                         as_attachment=as_attachment, 
                         download_name=f"processed_{base_name}.mp4")
    
    # Fallback to original upload
    upload_path = os.path.join(UPLOAD_FOLDER, name)
    if os.path.exists(upload_path):
        # Determine mimetype
        ext = os.path.splitext(name)[1].lower()
        mtype = "video/mp4"
        if ext == ".avi": mtype = "video/x-msvideo"
        elif ext == ".mov": mtype = "video/quicktime"
        elif ext == ".webm": mtype = "video/webm"
        return send_file(upload_path, mimetype=mtype)

    return jsonify({"error": "File not found"}), 404


# ================= CLI =================

def run_cli(video):
    print(f"Running CLI mode for {video}...")
    process_video(video, {
        "confidence": 0.3,
        "loiter": 5,
        "crowd_threshold": 5
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", help="Run single video CLI")
    args = parser.parse_args()

    if args.run:
        run_cli(args.run)
    else:
        app.run(host="0.0.0.0", port=5000, debug=True)