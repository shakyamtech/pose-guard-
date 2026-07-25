import streamlit as st
import cv2
import mediapipe as mp
import time
import numpy as np
import os
from posture import analyze_posture

# Initialize pygame mixer for audio alerts if possible
try:
    import pygame
    pygame.mixer.init()
    AUDIO_AVAILABLE = True
except Exception:
    AUDIO_AVAILABLE = False

# Set Page Config
st.set_page_config(
    page_title="Office Posture Monitor",
    page_icon="💻",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# App Title & Custom Styling
st.markdown("""
<style>
    .reportview-container {
        background-color: #0f172a;
    }
    .status-card {
        padding: 1.5rem;
        border-radius: 1rem;
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(8px);
        margin-bottom: 1rem;
    }
    .good-text {
        color: #10b981;
        font-weight: 700;
        font-size: 1.5rem;
    }
    .bad-text {
        color: #ef4444;
        font-weight: 700;
        font-size: 1.5rem;
        animation: pulse 1s infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
</style>
""", unsafe_allow_html=True)

# App Headers
st.title("💻 Office Posture Monitor")
st.caption("A simple real-time Computer Vision application powered by MediaPipe Pose & Streamlit")

# Session State Setup
if "calibrated" not in st.session_state:
    st.session_state.calibrated = False
if "baseline" not in st.session_state:
    st.session_state.baseline = None
if "monitoring" not in st.session_state:
    st.session_state.monitoring = False
if "alarm_playing" not in st.session_state:
    st.session_state.alarm_playing = False

# Audio Player Helper
def play_alarm():
    if AUDIO_AVAILABLE:
        alarm_path = "alarm.wav"
        if os.path.exists(alarm_path):
            try:
                pygame.mixer.music.load(alarm_path)
                pygame.mixer.music.play()
            except Exception as e:
                # Fallback to sound generation if load fails
                pass

def stop_alarm():
    if AUDIO_AVAILABLE:
        pygame.mixer.music.stop()

# Layout
col1, col2 = st.columns([3, 1])

with col2:
    st.markdown("<div class='status-card'>", unsafe_allow_html=True)
    st.subheader("⚙️ Settings & Calibration")
    st.write("Calibrate your ideal sitting posture first to ensure maximum accuracy.")
    
    # Calibration Button
    calibrate_btn = st.button("Calibrate Good Posture", type="primary", use_container_width=True)
    
    if st.session_state.calibrated:
        st.success("✓ Custom calibration loaded!")
        with st.expander("Show Baselines"):
            st.json(st.session_state.baseline)
    else:
        st.info("⚠️ Using default fallback metrics. Press Calibrate to customize.")

    st.markdown("---")
    st.subheader("Controls")
    
    # Start / Stop Monitoring
    if not st.session_state.monitoring:
        if st.button("▶ Start Monitor", type="secondary", use_container_width=True):
            st.session_state.monitoring = True
            st.rerun()
    else:
        if st.button("⏹ Stop Monitor", type="primary", use_container_width=True):
            st.session_state.monitoring = False
            stop_alarm()
            st.session_state.alarm_playing = False
            st.rerun()
            
    st.markdown("</div>", unsafe_allow_html=True)
    
    # Guidelines Card
    st.markdown("""
    <div class='status-card'>
        <h4>📐 Posture Tips</h4>
        <ul style="font-size:0.9rem; padding-left:1.2rem;">
            <li>Keep the top of your screen at or slightly below eye level.</li>
            <li>Maintain a distance of about arm's length (50-70cm) from the screen.</li>
            <li>Keep your shoulders relaxed, not elevated or hunched forward.</li>
            <li>Sit all the way back in your chair for spinal support.</li>
        </ul>
    </div>
    """, unsafe_allow_html=True)

with col1:
    # Camera Holder
    frame_holder = st.empty()
    status_holder = st.empty()
    
    if not st.session_state.monitoring:
        # Beautiful fallback hero banner/instructions
        st.info("👈 Press the 'Start Monitor' button on the sidebar to launch your webcam.")
        st.image("https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1200&auto=format&fit=crop", 
                 caption="Sit tall, stay healthy.", use_container_width=True)
    else:
        # Initialize MediaPipe Pose
        mp_pose = mp.solutions.pose
        mp_drawing = mp.solutions.drawing_utils
        mp_drawing_styles = mp.solutions.drawing_styles
        
        # Open Camera
        cap = cv2.VideoCapture(0)
        
        # Check if camera opened correctly
        if not cap.isOpened():
            st.error("Could not access your webcam. Please make sure no other application is using it.")
            st.session_state.monitoring = False
        else:
            # Timing and State tracking
            bad_posture_start_time = None
            alert_active = False
            
            with mp_pose.Pose(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
                model_complexity=1
            ) as pose:
                while cap.isOpened() and st.session_state.monitoring:
                    success, frame = cap.read()
                    if not success:
                        st.warning("Failed to grab video frame.")
                        break
                        
                    # Flip the image horizontally for a mirrored selfie-view
                    frame = cv2.flip(frame, 1)
                    h, w, c = frame.shape
                    
                    # Convert BGR to RGB
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = pose.process(rgb_frame)
                    
                    # Process posture status
                    posture_status = "Good"
                    conditions = []
                    metrics = {}
                    
                    # Draw Pose Landmarks
                    if results.pose_landmarks:
                        # Extract landmarks list
                        landmarks = results.pose_landmarks.landmark
                        
                        # Handle Calibration Request
                        if calibrate_btn:
                            # Calculate metrics for calibration
                            nose = landmarks[0]
                            l_ear = landmarks[7]
                            r_ear = landmarks[8]
                            l_shoulder = landmarks[11]
                            r_shoulder = landmarks[12]
                            
                            # Geometric metrics for baseline
                            shoulder_width = np.sqrt((l_shoulder.x - r_shoulder.x)**2 + (l_shoulder.y - r_shoulder.y)**2)
                            
                            ear_angle = 0
                            valid_ears = 0
                            if l_ear.visibility > 0.5:
                                ear_angle += np.degrees(np.arctan2(abs(l_shoulder.x - l_ear.x), abs(l_shoulder.y - l_ear.y)))
                                valid_ears += 1
                            if r_ear.visibility > 0.5:
                                ear_angle += np.degrees(np.arctan2(abs(r_shoulder.x - r_ear.x), abs(r_shoulder.y - r_ear.y)))
                                valid_ears += 1
                            ear_angle_deg = ear_angle / valid_ears if valid_ears > 0 else 12.0
                            
                            shoulder_midpoint_y = (l_shoulder.y + r_shoulder.y) / 2
                            nose_to_shoulder_y = shoulder_midpoint_y - nose.y
                            slouch_ratio = nose_to_shoulder_y / max(0.01, shoulder_width)
                            
                            st.session_state.baseline = {
                                "shoulder_width": float(shoulder_width),
                                "ear_angle_deg": float(ear_angle_deg),
                                "slouch_ratio": float(slouch_ratio)
                            }
                            st.session_state.calibrated = True
                            st.session_state.monitoring = True
                            calibrate_btn = False
                            st.rerun()

                        # Analyze
                        analysis = analyze_posture(landmarks, st.session_state.baseline)
                        posture_status = analysis["status"]
                        conditions = analysis["conditions"]
                        metrics = analysis["metrics"]
                        
                        # Draw Pose skeleton overlay on the frame
                        mp_drawing.draw_landmarks(
                            frame,
                            results.pose_landmarks,
                            mp_pose.POSE_CONNECTIONS,
                            landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style()
                        )
                    
                    # Timers and alerts logic
                    if posture_status == "Incorrect":
                        if bad_posture_start_time is None:
                            bad_posture_start_time = time.time()
                        
                        elapsed_bad_time = time.time() - bad_posture_start_time
                        
                        # 3-Second threshold exceeded
                        if elapsed_bad_time >= 3.0:
                            if not alert_active:
                                alert_active = True
                                play_alarm()
                    else:
                        # Reset timer & stop alarm
                        bad_posture_start_time = None
                        if alert_active:
                            alert_active = False
                            stop_alarm()
                            
                    # Draw visual screen border based on state
                    border_color = (0, 0, 255) if alert_active else (0, 255, 0) # BGR
                    thickness = 10
                    cv2.rectangle(frame, (0, 0), (w, h), border_color, thickness)
                    
                    # Update status in frame overlay
                    status_text = "Fix Your Posture!" if alert_active else "Good Posture \u2713"
                    text_color = (0, 0, 255) if alert_active else (0, 255, 0)
                    cv2.putText(frame, status_text, (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, text_color, 3, cv2.LINE_AA)
                    
                    # Render Frame in Streamlit
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frame_holder.image(frame_rgb, use_container_width=True)
                    
                    # Update status board below feed
                    with status_holder.container():
                        st.markdown("<div class='status-card'>", unsafe_allow_html=True)
                        if alert_active:
                            st.markdown(f"<div class='bad-text'>⚠️ WARNING: Fix Your Posture!</div>", unsafe_allow_html=True)
                            st.write("**Triggered Warnings:**")
                            for c in conditions:
                                st.write(f"- 🔴 {c}")
                        else:
                            st.markdown("<div class='good-text'>✓ Good Posture Active</div>", unsafe_allow_html=True)
                            st.write("All metrics are within safe operational zones.")
                        st.markdown("</div>", unsafe_allow_html=True)
                        
                    # Yield CPU
                    time.sleep(0.01)
                    
            cap.release()
