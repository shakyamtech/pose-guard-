import numpy as np

def calculate_distance(p1, p2):
    """Calculate Euclidean distance between two MediaPipe landmark points in 2D space."""
    return np.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

def get_angle_vertical(p1, p2):
    """
    Calculate the angle (in degrees) of the line connecting p1 and p2 relative to the vertical.
    Typically used with p1 = Ear and p2 = Shoulder to detect neck leaning.
    An upright posture has a small angle (ear directly above shoulder).
    Leaning forward increases this angle.
    """
    dx = p2.x - p1.x
    dy = p2.y - p1.y
    # Use arctan2 to get angle relative to the vertical line
    angle = np.degrees(np.arctan2(abs(dx), abs(dy)))
    return angle

def analyze_posture(landmarks, baseline=None):
    """
    Analyze posture using current body landmarks.
    If baseline is provided, compares current metrics to baseline values to increase accuracy.
    
    Landmarks list structure should map to MediaPipe Pose landmarks:
    - 0: Nose
    - 7: Left Ear, 8: Right Ear
    - 11: Left Shoulder, 12: Right Shoulder
    """
    if len(landmarks) < 13:
        return {
            "status": "Unknown",
            "conditions": [],
            "metrics": {}
        }
        
    nose = landmarks[0]
    l_ear = landmarks[7]
    r_ear = landmarks[8]
    l_shoulder = landmarks[11]
    r_shoulder = landmarks[12]
    
    # Check landmarks visibility to avoid false triggers when tracking is poor
    min_visibility = 0.5
    if (nose.visibility < min_visibility or 
        l_shoulder.visibility < min_visibility or 
        r_shoulder.visibility < min_visibility):
        return {
            "status": "Tracking Lost",
            "conditions": ["Low visibility"],
            "metrics": {}
        }

    # --- 1. SITTING TOO CLOSE ---
    # Shoulder width in pixel-space (relative coordinates 0.0 to 1.0)
    shoulder_width = calculate_distance(l_shoulder, r_shoulder)
    
    # --- 2. NECK BENT FORWARD ---
    # Angle from ear to shoulder relative to vertical
    # If one side is more visible/tracked, use that, otherwise take average
    ear_angle = 0
    valid_ears = 0
    if l_ear.visibility > min_visibility:
        ear_angle += get_angle_vertical(l_ear, l_shoulder)
        valid_ears += 1
    if r_ear.visibility > min_visibility:
        ear_angle += get_angle_vertical(r_ear, r_shoulder)
        valid_ears += 1
        
    ear_angle_deg = ear_angle / valid_ears if valid_ears > 0 else get_angle_vertical(nose, r_shoulder)

    # --- 3. SLOUCHING (Upper body leaning forward or lowered head) ---
    # Distance from nose to shoulder midpoint normalized by shoulder width
    shoulder_midpoint_y = (l_shoulder.y + r_shoulder.y) / 2
    nose_to_shoulder_y = shoulder_midpoint_y - nose.y
    slouch_ratio = nose_to_shoulder_y / max(0.01, shoulder_width)

    # --- POSTURE EVALUATION ---
    conditions = []
    
    # Thresholds: either calibrated or fallback defaults
    if baseline:
        # Calibrated Mode
        # Too close: shoulder width increases significantly from baseline
        too_close_thresh = baseline["shoulder_width"] * 1.25
        # Neck bent forward: ear-shoulder angle increases significantly from baseline
        neck_angle_thresh = max(baseline["ear_angle_deg"] + 12.0, 25.0)
        # Slouching: nose-to-shoulder vertical distance ratio drops significantly
        slouch_ratio_thresh = baseline["slouch_ratio"] * 0.75
    else:
        # Default fallback thresholds
        too_close_thresh = 0.45  # If shoulders fill more than 45% of the frame width
        neck_angle_thresh = 22.0  # Angle in degrees relative to vertical
        slouch_ratio_thresh = 0.40  # Ratio of nose height to shoulder width

    # Detect conditions
    if shoulder_width > too_close_thresh:
        conditions.append("Sitting too close to the screen")
        
    if ear_angle_deg > neck_angle_thresh:
        conditions.append("Neck bent forward")
        
    if slouch_ratio < slouch_ratio_thresh:
        conditions.append("Slouching / rounded shoulders")

    status = "Correct" if len(conditions) == 0 else "Incorrect"

    return {
        "status": status,
        "conditions": conditions,
        "metrics": {
            "shoulder_width": float(shoulder_width),
            "ear_angle_deg": float(ear_angle_deg),
            "slouch_ratio": float(slouch_ratio)
        }
    }
