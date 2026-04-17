import cv2
import json
import numpy as np
import os
import sys

# Usage: python draw_zone.py <video_path>
if len(sys.argv) < 2:
    print("Error: Please provide a video path.")
    print("Usage: python draw_zone.py video.mp4")
    sys.exit(1)

video_path = sys.argv[1]
video_name = os.path.basename(video_path)
ZONES_FOLDER = "zones"
os.makedirs(ZONES_FOLDER, exist_ok=True)

points = []

def draw(event, x, y, flags, param):
    global points
    if event == cv2.EVENT_LBUTTONDOWN:
        points.append({"x": x / width, "y": y / height})
        print(f"Point added: {x}, {y} (Normalised)")

cap = cv2.VideoCapture(video_path)
ret, frame = cap.read()
if not ret:
    print("Error: Could not read video.")
    sys.exit(1)

height, width = frame.shape[:2]
cv2.namedWindow("Draw Zone - Sentinel")
cv2.setMouseCallback("Draw Zone - Sentinel", draw)

print("--- ZONE DRAWING MODE ---")
print("1. Click to add polygon points.")
print("2. Press ESC to save and exit.")

while True:
    temp_frame = frame.copy()
    
    # Draw points & lines
    px_points = [(int(p["x"] * width), int(p["y"] * height)) for p in points]
    for p in px_points:
        cv2.circle(temp_frame, p, 5, (0, 255, 255), -1)
    if len(px_points) > 1:
        cv2.polylines(temp_frame, [np.array(px_points)], True, (0, 255, 0), 2)

    cv2.imshow("Draw Zone - Sentinel", temp_frame)
    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()

if len(points) >= 3:
    save_path = os.path.join(ZONES_FOLDER, f"{video_name}.json")
    zone_data = {
        "points": points,
        "saved": True
    }
    with open(save_path, "w") as f:
        json.dump(zone_data, f, indent=4)
    print(f"Zone saved to {save_path}")
else:
    print("Ignored: At least 3 points required.")