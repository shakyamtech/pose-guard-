import { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Camera, 
  Sliders, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Code, 
  Video, 
  Settings, 
  FileCode, 
  Copy, 
  Check, 
  Activity,
  Play,
  Square,
  Sparkles,
  Bell
} from 'lucide-react';

// Define TS declarations for globally loaded MediaPipe libraries
declare global {
  interface Window {
    Pose: any;
    Camera: any;
  }
}

// Coordinate connection indexes for upper body pose skeleton
const CONNECTIONS = [
  [11, 12], // Shoulder to shoulder
  [11, 13], [13, 15], // Left arm (shoulder-elbow-wrist)
  [12, 14], [14, 16], // Right arm (shoulder-elbow-wrist)
  // Face / Upper Neck lines
  [7, 5], [5, 0], [0, 2], [2, 8] // Left ear -> Left eye -> Nose -> Right eye -> Right ear
];

// Content for Python Code Companion Viewer
const PYTHON_FILES = [
  {
    name: 'app.py',
    language: 'python',
    code: `import streamlit as st
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

# Audio Player Helper
def play_alarm():
    if AUDIO_AVAILABLE:
        alarm_path = "alarm.wav"
        if os.path.exists(alarm_path):
            try:
                pygame.mixer.music.load(alarm_path)
                pygame.mixer.music.play()
            except Exception as e:
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
            st.rerun()
            
    st.markdown("</div>", unsafe_allow_html=True)

with col1:
    frame_holder = st.empty()
    status_holder = st.empty()
    
    if not st.session_state.monitoring:
        st.info("👈 Press the 'Start Monitor' button on the sidebar to launch your webcam.")
    else:
        mp_pose = mp.solutions.pose
        mp_drawing = mp.solutions.drawing_utils
        mp_drawing_styles = mp.solutions.drawing_styles
        
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            st.error("Could not access your webcam.")
            st.session_state.monitoring = False
        else:
            bad_posture_start_time = None
            alert_active = False
            
            with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5, model_complexity=1) as pose:
                while cap.isOpened() and st.session_state.monitoring:
                    success, frame = cap.read()
                    if not success:
                        break
                        
                    frame = cv2.flip(frame, 1)
                    h, w, c = frame.shape
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = pose.process(rgb_frame)
                    
                    posture_status = "Good"
                    conditions = []
                    
                    if results.pose_landmarks:
                        landmarks = results.pose_landmarks.landmark
                        
                        if calibrate_btn:
                            # Perform calibration calculations (save baseline metrics)
                            shoulder_width = np.sqrt((landmarks[11].x - landmarks[12].x)**2 + (landmarks[11].y - landmarks[12].y)**2)
                            # ... (calculate and save baseline dictionary in st.session_state.baseline)
                            st.session_state.calibrated = True
                            st.rerun()

                        analysis = analyze_posture(landmarks, st.session_state.baseline)
                        posture_status = analysis["status"]
                        conditions = analysis["conditions"]
                        
                        mp_drawing.draw_landmarks(
                            frame,
                            results.pose_landmarks,
                            mp_pose.POSE_CONNECTIONS,
                            landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style()
                        )
                    
                    if posture_status == "Incorrect":
                        if bad_posture_start_time is None:
                            bad_posture_start_time = time.time()
                        if time.time() - bad_posture_start_time >= 3.0:
                            if not alert_active:
                                alert_active = True
                                play_alarm()
                    else:
                        bad_posture_start_time = None
                        if alert_active:
                            alert_active = False
                            stop_alarm()
                            
                    border_color = (0, 0, 255) if alert_active else (0, 255, 0)
                    cv2.rectangle(frame, (0, 0), (w, h), border_color, 10)
                    
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frame_holder.image(frame_rgb, use_container_width=True)
                    time.sleep(0.01)
            cap.release()
`
  },
  {
    name: 'posture.py',
    language: 'python',
    code: `import numpy as np

def calculate_distance(p1, p2):
    """Calculate Euclidean distance between two MediaPipe landmark points in 2D space."""
    return np.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)

def get_angle_vertical(p1, p2):
    """Calculate the angle (in degrees) of the ear-to-shoulder line relative to the vertical axis."""
    dx = p2.x - p1.x
    dy = p2.y - p1.y
    angle = np.degrees(np.arctan2(abs(dx), abs(dy)))
    return angle

def analyze_posture(landmarks, baseline=None):
    """Analyze posture using current body landmarks and compare with calibrated baselines."""
    if len(landmarks) < 13:
        return {"status": "Unknown", "conditions": [], "metrics": {}}
        
    nose = landmarks[0]
    l_ear = landmarks[7]
    r_ear = landmarks[8]
    l_shoulder = landmarks[11]
    r_shoulder = landmarks[12]
    
    min_visibility = 0.5
    if nose.visibility < min_visibility or l_shoulder.visibility < min_visibility or r_shoulder.visibility < min_visibility:
        return {"status": "Tracking Lost", "conditions": ["Low visibility"], "metrics": {}}

    # 1. Distance tracking via shoulder width
    shoulder_width = calculate_distance(l_shoulder, r_shoulder)
    
    # 2. Neck leaning angle
    ear_angle = 0
    valid_ears = 0
    if l_ear.visibility > min_visibility:
        ear_angle += get_angle_vertical(l_ear, l_shoulder)
        valid_ears += 1
    if r_ear.visibility > min_visibility:
        ear_angle += get_angle_vertical(r_ear, r_shoulder)
        valid_ears += 1
    ear_angle_deg = ear_angle / valid_ears if valid_ears > 0 else get_angle_vertical(nose, r_shoulder)

    # 3. Slouch ratio (Nose height to shoulder width ratio)
    shoulder_midpoint_y = (l_shoulder.y + r_shoulder.y) / 2
    nose_to_shoulder_y = shoulder_midpoint_y - nose.y
    slouch_ratio = nose_to_shoulder_y / max(0.01, shoulder_width)

    conditions = []
    
    if baseline:
        too_close_thresh = baseline["shoulder_width"] * 1.25
        neck_angle_thresh = max(baseline["ear_angle_deg"] + 12.0, 25.0)
        slouch_ratio_thresh = baseline["slouch_ratio"] * 0.75
    else:
        too_close_thresh = 0.45
        neck_angle_thresh = 22.0
        slouch_ratio_thresh = 0.40

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
`
  },
  {
    name: 'requirements.txt',
    language: 'text',
    code: `streamlit>=1.30.0
opencv-python>=4.8.0
mediapipe>=0.10.0
numpy>=1.24.0
pygame>=2.5.0`
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'code'>('monitor');
  const [sidebarTab, setSidebarTab] = useState<'dials' | 'adjustments' | 'alarm'>('dials');
  const [alarmSound, setAlarmSound] = useState<'chime' | 'beep' | 'siren' | 'ping' | 'pulsar' | 'buzzing'>('buzzing');
  const [alarmVolume, setAlarmVolume] = useState<number>(0.3);
  const [alarmDelay, setAlarmDelay] = useState<number>(3);
  const [alarmRepeat, setAlarmRepeat] = useState<'once' | 'repeat_3s' | 'repeat_5s' | 'repeat_10s'>('repeat_5s');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Calibration state
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [baseline, setBaseline] = useState<{
    shoulderWidth: number;
    earAngle: number;
    slouchRatio: number;
  }>({
    shoulderWidth: 0.28,
    earAngle: 10.0,
    slouchRatio: 0.55
  });

  // Current metric values
  const [metrics, setMetrics] = useState({
    shoulderWidth: 0.0,
    earAngle: 0.0,
    slouchRatio: 0.0
  });

  // Adjustable detection thresholds (deltas from baseline)
  const [thresholds, setThresholds] = useState({
    tooCloseMultiplier: 1.25, // multiplied by baseline shoulder width
    neckAngleDelta: 12.0,     // degrees added to baseline ear angle
    slouchRatioMultiplier: 0.75 // multiplied by baseline slouch ratio
  });

  // Alert toggles
  const [tests, setTests] = useState({
    neckLeaning: true,
    slouching: true,
    tooClose: true
  });

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [cameraState, setCameraState] = useState<'off' | 'starting' | 'active' | 'error'>('off');
  const [conditions, setConditions] = useState<string[]>([]);
  const [postureState, setPostureState] = useState<'good' | 'warning'>('good');
  const [trackingConfidence, setTrackingConfidence] = useState<number>(0);
  
  // Accumulated bad posture timer
  const [badPostureTime, setBadPostureTime] = useState<number>(0);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraInstanceRef = useRef<any>(null);
  const poseInstanceRef = useRef<any>(null);
  const isCalibratingRef = useRef(false);

  // Exponential moving average for posture stabilization
  const smoothedMetricsRef = useRef({
    shoulderWidth: 0.0,
    earAngle: 0.0,
    slouchRatio: 0.0
  });

  // Tracking consecutive posture states for 3s alert logic
  const badPostureStartRef = useRef<number | null>(null);
  const goodPostureStartRef = useRef<number | null>(null);
  const lastAlertActiveRef = useRef(false);
  const lastAlertPlayTimeRef = useRef<number | null>(null);

  // Web Audio Synth for playing a customizable warning beep (no static asset required)
  const playWebBeep = (soundType?: 'chime' | 'beep' | 'siren' | 'ping' | 'pulsar' | 'buzzing', volumeLevel?: number) => {
    if (!audioEnabled) return;
    try {
      const activeSound = soundType || alarmSound;
      const activeVol = volumeLevel !== undefined ? volumeLevel : alarmVolume;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (activeSound === 'chime') {
        // Double polite chime
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        gain1.gain.setValueAtTime(activeVol, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.25);

        setTimeout(() => {
          try {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(783.99, audioCtx.currentTime); // G5
            gain2.gain.setValueAtTime(activeVol, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.25);
          } catch (err) {
            console.error('Audio secondary beep error:', err);
          }
        }, 150);
      } else if (activeSound === 'beep') {
        // Standard monophonic sharp beep
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain.gain.setValueAtTime(activeVol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (activeSound === 'siren') {
        // Alerting siren
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(950, audioCtx.currentTime + 0.15);
        osc.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(activeVol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.32);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (activeSound === 'ping') {
        // High resonance sonar ping
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1150, audioCtx.currentTime);
        gain.gain.setValueAtTime(activeVol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.55);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      } else if (activeSound === 'pulsar') {
        // High-paced triple pulsator
        [0, 100, 200].forEach((delay) => {
          setTimeout(() => {
            try {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(950, audioCtx.currentTime);
              gain.gain.setValueAtTime(activeVol, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.09);
            } catch (err) {}
          }, delay);
        });
      } else if (activeSound === 'buzzing') {
        // High-intensity industrial retro warning buzzer that plays for exactly 5 seconds
        const duration = 5.0; // 5 seconds
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const osc3 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const filterNode = audioCtx.createBiquadFilter();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(140, audioCtx.currentTime); // Deep buzz base
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(142, audioCtx.currentTime); // Detuned chorus
        osc3.type = 'square';
        osc3.frequency.setValueAtTime(280, audioCtx.currentTime); // Upper octave piercing ring
        
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(1200, audioCtx.currentTime);
        
        // Manual Gain Pulsing: ON for 0.3s, OFF for 0.2s over 5.0 seconds
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        for (let t = 0; t < duration; t += 0.5) {
          gainNode.gain.setValueAtTime(0, audioCtx.currentTime + t);
          gainNode.gain.linearRampToValueAtTime(activeVol, audioCtx.currentTime + t + 0.05);
          gainNode.gain.setValueAtTime(activeVol, audioCtx.currentTime + t + 0.3);
          gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + t + 0.35);
        }
        
        osc1.connect(filterNode);
        osc2.connect(filterNode);
        osc3.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc1.start();
        osc2.start();
        osc3.start();
        osc1.stop(audioCtx.currentTime + duration);
        osc2.stop(audioCtx.currentTime + duration);
        osc3.stop(audioCtx.currentTime + duration);
      }
    } catch (e) {
      console.error('Web Audio Synth Error:', e);
    }
  };

  // Trigger manual sound test
  const triggerAudioTest = () => {
    playWebBeep(alarmSound, alarmVolume);
  };

  // Clipboard copy function for Code companion
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedFile(PYTHON_FILES[selectedFileIndex].name);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  // Calibration action triggered by user
  const handleCalibrate = () => {
    isCalibratingRef.current = true;
  };

  // Process a frame result from MediaPipe Pose
  const onResults = (results: any) => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width = videoRef.current.videoWidth || 640;
    const height = canvas.height = videoRef.current.videoHeight || 480;

    // Clear and draw mirrored camera frame onto canvas
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, width, height);

    // If landmarks exist, analyze them
    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;
      
      const nose = landmarks[0];
      const lEar = landmarks[7];
      const rEar = landmarks[8];
      const lShoulder = landmarks[11];
      const rShoulder = landmarks[12];

      // Check visibility of critical upper body landmarks
      const minVisibility = 0.5;
      const isUpperBodyVisible = 
        nose && lShoulder && rShoulder &&
        nose.visibility > minVisibility && 
        lShoulder.visibility > minVisibility && 
        rShoulder.visibility > minVisibility;

      if (isUpperBodyVisible) {
        setTrackingConfidence(Math.round(((nose.visibility + lShoulder.visibility + rShoulder.visibility) / 3) * 100));

        // 1. Distance Metric (Euclidean distance between shoulders)
        const currentShoulderWidth = Math.sqrt(
          Math.pow(lShoulder.x - rShoulder.x, 2) + 
          Math.pow(lShoulder.y - rShoulder.y, 2)
        );

        // 2. Neck angle metric (Ear to shoulder vertical deflection)
        const calcEarAngleVertical = (ear: any, shoulder: any) => {
          const dx = shoulder.x - ear.x;
          const dy = shoulder.y - ear.y;
          return Math.abs(Math.atan2(dx, dy) * (180 / Math.PI));
        };

        let currentEarAngle = 0;
        let validEarsCount = 0;
        if (lEar && lEar.visibility > minVisibility) {
          currentEarAngle += calcEarAngleVertical(lEar, lShoulder);
          validEarsCount++;
        }
        if (rEar && rEar.visibility > minVisibility) {
          currentEarAngle += calcEarAngleVertical(rEar, rShoulder);
          validEarsCount++;
        }
        const earAngleDeg = validEarsCount > 0 ? (currentEarAngle / validEarsCount) : calcEarAngleVertical(nose, rShoulder);

        // 3. Slouch ratio (vertical head height above shoulders relative to shoulder width)
        const shoulderMidpointY = (lShoulder.y + rShoulder.y) / 2;
        const noseToShoulderY = shoulderMidpointY - nose.y;
        const currentSlouchRatio = noseToShoulderY / Math.max(0.01, currentShoulderWidth);

        // --- EXPONENTIAL MOVING AVERAGE (EMA) FILTER FOR EXTREME ACCURACY & STABILITY ---
        const alpha = 0.15; // 15% new data weight filters high-frequency noise perfectly
        if (smoothedMetricsRef.current.shoulderWidth === 0.0) {
          smoothedMetricsRef.current = {
            shoulderWidth: currentShoulderWidth,
            earAngle: earAngleDeg,
            slouchRatio: currentSlouchRatio
          };
        } else {
          smoothedMetricsRef.current.shoulderWidth = alpha * currentShoulderWidth + (1 - alpha) * smoothedMetricsRef.current.shoulderWidth;
          smoothedMetricsRef.current.earAngle = alpha * earAngleDeg + (1 - alpha) * smoothedMetricsRef.current.earAngle;
          smoothedMetricsRef.current.slouchRatio = alpha * currentSlouchRatio + (1 - alpha) * smoothedMetricsRef.current.slouchRatio;
        }

        const stableShoulderWidth = smoothedMetricsRef.current.shoulderWidth;
        const stableEarAngle = smoothedMetricsRef.current.earAngle;
        const stableSlouchRatio = smoothedMetricsRef.current.slouchRatio;

        // Update live metrics state for reactive dials using stable, jitter-free values
        setMetrics({
          shoulderWidth: stableShoulderWidth,
          earAngle: stableEarAngle,
          slouchRatio: stableSlouchRatio
        });

        // HANDLE CALIBRATION TRIGGER using stabilized data
        if (isCalibratingRef.current) {
          setBaseline({
            shoulderWidth: stableShoulderWidth,
            earAngle: stableEarAngle,
            slouchRatio: stableSlouchRatio
          });
          setIsCalibrated(true);
          isCalibratingRef.current = false;
        }

        // POSTURE DECISION ENGINE
        const currentConditions: string[] = [];

        // Threshold parameters loaded dynamically
        const tooCloseLimit = isCalibrated 
          ? baseline.shoulderWidth * thresholds.tooCloseMultiplier 
          : 0.42;

        const neckAngleLimit = isCalibrated 
          ? baseline.earAngle + thresholds.neckAngleDelta 
          : 22.0;

        const slouchLimit = isCalibrated 
          ? baseline.slouchRatio * thresholds.slouchRatioMultiplier 
          : 0.38;

        // Perform active test validations with stabilized metrics
        if (tests.tooClose && stableShoulderWidth > tooCloseLimit) {
          currentConditions.push("Sitting too close to screen");
        }
        if (tests.neckLeaning && stableEarAngle > neckAngleLimit) {
          currentConditions.push("Neck bent forward");
        }
        if (tests.slouching && stableSlouchRatio < slouchLimit) {
          currentConditions.push("Slouching / rounded shoulders");
        }

        setConditions(currentConditions);

        // DYNAMIC ALARM AND TRIGGER LOGIC WITH HYSTERESIS RESETS
        if (currentConditions.length > 0) {
          // Reset good posture timer because they are currently in a bad posture
          goodPostureStartRef.current = null;

          if (badPostureStartRef.current === null) {
            badPostureStartRef.current = Date.now();
          }
          const elapsed = (Date.now() - badPostureStartRef.current) / 1000;
          setBadPostureTime(Math.min(alarmDelay, Number(elapsed.toFixed(1))));

          if (elapsed >= alarmDelay) {
            setPostureState('warning');
            
            // Check repeat interval
            let shouldPlay = false;
            if (!lastAlertActiveRef.current) {
              // First alarm trigger
              lastAlertActiveRef.current = true;
              shouldPlay = true;
            } else if (alarmRepeat !== 'once') {
              // Determine repeat milliseconds
              const repeatIntervalMs = 
                alarmRepeat === 'repeat_3s' ? 3000 :
                alarmRepeat === 'repeat_5s' ? 5000 : 10000;
              
              if (lastAlertPlayTimeRef.current === null || (Date.now() - lastAlertPlayTimeRef.current) >= repeatIntervalMs) {
                shouldPlay = true;
              }
            }

            if (shouldPlay) {
              playWebBeep();
              lastAlertPlayTimeRef.current = Date.now();
            }
          }
        } else {
          // Good posture detected. Require a consecutive 0.8s "good" window to prevent jittery resets.
          if (badPostureStartRef.current !== null) {
            if (goodPostureStartRef.current === null) {
              goodPostureStartRef.current = Date.now();
            }
            
            const goodElapsed = (Date.now() - goodPostureStartRef.current) / 1000;
            if (goodElapsed >= 0.8) {
              // Solidly correct posture! Commit the reset.
              badPostureStartRef.current = null;
              goodPostureStartRef.current = null;
              setBadPostureTime(0);
              setPostureState('good');
              lastAlertActiveRef.current = false;
              lastAlertPlayTimeRef.current = null;
            }
          } else {
            // Already fully reset
            goodPostureStartRef.current = null;
            setBadPostureTime(0);
            setPostureState('good');
            lastAlertActiveRef.current = false;
            lastAlertPlayTimeRef.current = null;
          }
        }

        // RENDER POSTURE SKELETON
        // Determine coloring and glow intensity based on posture warning state
        const drawColor = postureState === 'warning' ? '#f43f5e' : '#10b981';
        const fillDotColor = postureState === 'warning' ? '#e11d48' : '#059669';

        ctx.lineWidth = 4;
        ctx.strokeStyle = drawColor;
        ctx.fillStyle = fillDotColor;
        ctx.shadowColor = drawColor;
        ctx.shadowBlur = 12;

        // Draw upper body bones
        CONNECTIONS.forEach(([i, j]) => {
          const pt1 = landmarks[i];
          const pt2 = landmarks[j];
          if (pt1 && pt2 && pt1.visibility > minVisibility && pt2.visibility > minVisibility) {
            ctx.beginPath();
            ctx.moveTo(pt1.x * width, pt1.y * height);
            ctx.lineTo(pt2.x * width, pt2.y * height);
            ctx.stroke();
          }
        });

        // Draw shiny joints
        const keyJoints = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16];
        keyJoints.forEach((idx) => {
          const joint = landmarks[idx];
          if (joint && joint.visibility > minVisibility) {
            ctx.beginPath();
            ctx.arc(joint.x * width, joint.y * height, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      } else {
        setTrackingConfidence(0);
        setConditions(["Upper body not fully visible"]);
      }
    } else {
      setTrackingConfidence(0);
    }

    ctx.restore();
  };

  // Initialize MediaPipe Pose and Camera Instance
  const startCameraStream = async () => {
    if (!videoRef.current) return;
    setCameraState('starting');

    try {
      // 1. Initialize Pose module with WASM assets from CDN
      const pose = new window.Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onResults);
      poseInstanceRef.current = pose;

      // 2. Setup camera streaming loop
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await pose.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480
      });

      await camera.start();
      cameraInstanceRef.current = camera;
      setCameraState('active');
    } catch (error) {
      console.error('Camera initialization failure:', error);
      setCameraState('error');
    }
  };

  // Disassemble streaming loop and camera capture hooks
  const stopCameraStream = () => {
    if (cameraInstanceRef.current) {
      cameraInstanceRef.current.stop();
      cameraInstanceRef.current = null;
    }
    if (poseInstanceRef.current) {
      poseInstanceRef.current.close();
      poseInstanceRef.current = null;
    }
    setCameraState('off');
    setTrackingConfidence(0);
    setConditions([]);
    setPostureState('good');
    setBadPostureTime(0);
    badPostureStartRef.current = null;
    lastAlertActiveRef.current = false;
  };

  // Clean-up on unmount
  useEffect(() => {
    return () => {
      if (cameraInstanceRef.current) {
        cameraInstanceRef.current.stop();
      }
    };
  }, []);

  return (
    <div id="office_posture_monitor_app" className="min-h-screen bg-slate-950 flex flex-col relative text-slate-100">
      {/* Dynamic Colored Ambient Outer Border */}
      <div 
        className={`fixed inset-0 pointer-events-none transition-all duration-300 z-50 border-[6px] md:border-[10px] ${
          cameraState === 'active' 
            ? postureState === 'warning' 
              ? 'border-rose-500/80 shadow-[inset_0_0_40px_rgba(244,63,94,0.15)]' 
              : 'border-emerald-500/60 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'
            : 'border-slate-800'
        }`}
      />

      {/* Main Top Header */}
      <header id="main_header" className="px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl transition-all ${postureState === 'warning' ? 'bg-rose-500/10 text-rose-400 animate-pulse' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-50 to-slate-300 bg-clip-text text-transparent">
              Office Posture Monitor
            </h1>
            <p className="text-xs text-slate-400">
              Webcam ergonomics tracking & posture alignment engine
            </p>
          </div>
        </div>

        {/* Stop Recording/Monitor Header Button */}
        {cameraState === 'active' && (
          <button
            id="header_stop_recording"
            onClick={stopCameraStream}
            className="md:ml-auto px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:scale-95 text-white transition-all shadow-lg flex items-center gap-2 border border-rose-500/30"
          >
            <Square className="w-3.5 h-3.5 fill-current text-white" />
            Stop Recording
          </button>
        )}

        {/* Floating Top Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800/80 self-start md:self-auto">
          <button
            id="tab_monitor"
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'monitor' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-4 h-4" />
            Live Monitor
          </button>
          <button
            id="tab_code"
            onClick={() => setActiveTab('code')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'code' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4" />
            Python Code
          </button>
        </div>
      </header>

      {/* Primary Layout Segment */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* --- TAB 1: LIVE WEBCAM MONITOR --- */}
        {activeTab === 'monitor' && (
          <>
            {/* Left Frame Window - takes up 8 of 12 columns */}
            <section id="camera_stage_section" className="lg:col-span-8 flex flex-col gap-4 relative">
              <div className="relative flex-1 min-h-[400px] md:min-h-[500px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xl flex flex-col items-center justify-center">
                
                {/* Hidden camera raw video element */}
                <video 
                  ref={videoRef} 
                  className="hidden" 
                  playsInline 
                  muted 
                />

                {/* Main Mirrored Interactive Canvas */}
                <canvas 
                  ref={canvasRef} 
                  className={`w-full h-full object-cover aspect-video md:aspect-auto ${cameraState === 'active' ? 'block' : 'hidden'}`}
                />

                {/* Pre-flight Camera Trigger and State Screens */}
                {cameraState === 'off' && (
                  <div className="p-8 text-center max-w-md flex flex-col items-center gap-5 z-20">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 shadow-lg animate-bounce">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">Webcam Inactive</h3>
                      <p className="text-sm text-slate-400 mt-1">
                        We need webcam access to run real-time local MediaPipe pose tracking. No video leaves your browser.
                      </p>
                    </div>
                    <button
                      id="btn_start_cam"
                      onClick={startCameraStream}
                      className="px-6 py-2.5 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 transition-all shadow-lg flex items-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Start Webcam Feed
                    </button>
                  </div>
                )}

                {cameraState === 'starting' && (
                  <div className="p-8 text-center flex flex-col items-center gap-4 z-20">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-emerald-400 animate-spin" />
                    <div>
                      <h3 className="text-base font-semibold text-slate-200">Initializing MediaPipe Engine...</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Please grant camera access when prompted by your browser.
                      </p>
                    </div>
                  </div>
                )}

                {cameraState === 'error' && (
                  <div className="p-8 text-center max-w-sm flex flex-col items-center gap-4 z-20">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shadow-md">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">Camera Initialization Failed</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Please ensure you have granted camera permissions, or check that no other browser tab is using your webcam.
                      </p>
                    </div>
                    <button
                      onClick={startCameraStream}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 transition-all border border-slate-700"
                    >
                      Retry Connection
                    </button>
                  </div>
                )}

                {/* FLOATING CORNER STATUS BADGES (Visible when monitoring) */}
                {cameraState === 'active' && (
                  <>
                    {/* Top Left Status Box */}
                    <div id="floating_status_panel" className="absolute top-4 left-4 p-3.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800/80 shadow-xl flex items-center gap-3 select-none pointer-events-none max-w-[280px]">
                      <div className={`w-3.5 h-3.5 rounded-full ${postureState === 'warning' ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                      <div>
                        <div className={`text-sm font-bold ${postureState === 'warning' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {postureState === 'warning' ? 'Fix Your Posture!' : 'Good Posture ✓'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {conditions.length > 0 ? conditions[0] : 'Workstation aligned'}
                        </div>
                      </div>
                    </div>

                    {/* Top Right Tracking Health Panel */}
                    <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800/80 shadow-md text-xs font-mono flex items-center gap-2 select-none pointer-events-none text-slate-300">
                      <div className="text-[10px] uppercase text-slate-500">Pose tracking:</div>
                      <span className={trackingConfidence > 50 ? 'text-emerald-400 font-bold' : 'text-yellow-500'}>
                        {trackingConfidence}%
                      </span>
                    </div>

                    {/* Bottom Centered Posture Delay Warning (Countdown bar) */}
                    {conditions.length > 0 && badPostureTime > 0 && postureState === 'good' && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-72 p-3 bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl flex flex-col gap-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-slate-300">
                          <span>Bad posture detected...</span>
                          <span className="font-bold text-rose-400">{badPostureTime}s / {alarmDelay}s</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-rose-500 transition-all duration-100 rounded-full"
                            style={{ width: `${(badPostureTime / alarmDelay) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Quick Controls Toolbar */}
              {cameraState === 'active' && (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <button
                      id="btn_calibrate_inline"
                      onClick={handleCalibrate}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Calibrate Base
                    </button>
                    {isCalibrated ? (
                      <span className="text-[11px] px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                        Custom Baseline Loaded
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-1 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20">
                        Default Baseline Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      id="btn_toggle_audio"
                      onClick={() => setAudioEnabled(!audioEnabled)}
                      className={`p-2.5 rounded-lg border transition-all ${
                        audioEnabled 
                          ? 'bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}
                      title={audioEnabled ? "Mute audio warning" : "Unmute audio warning"}
                    >
                      {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>
                    <button
                      id="btn_sound_test"
                      onClick={triggerAudioTest}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      Test Sound
                    </button>
                    <button
                      id="btn_stop_cam"
                      onClick={stopCameraStream}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Stop Recording
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Right Control & Diagnostics Panel - takes up 4 of 12 columns */}
            <aside id="diagnostics_section" className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Card 1: Main Status Summary */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xl">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-400" />
                  Status Panel
                </h3>

                {cameraState !== 'active' ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-slate-500">Launch webcam feed to stream analysis data.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {postureState === 'warning' ? (
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                          <AlertTriangle className="w-4.5 h-4.5" />
                          BAD POSTURE DETECTED
                        </div>
                        <p className="text-xs text-rose-300">
                          Keep your back straight and your computer screen at eye-level to maintain healthy biomechanics.
                        </p>
                        {conditions.length > 0 && (
                          <div className="mt-1 pt-2 border-t border-rose-500/10 flex flex-col gap-1 text-[11px] text-rose-400 font-mono">
                            {conditions.map((cond, index) => (
                              <div key={index} className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                                {cond}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                          <CheckCircle className="w-4.5 h-4.5" />
                          Good Posture Active
                        </div>
                        <p className="text-xs text-emerald-300">
                          Excellent sitting posture! Your head position, slouch level, and screen distances are in perfect alignment.
                        </p>
                      </div>
                    )}

                    {/* Prominent Stop Recording Button on Status Card */}
                    <button
                      id="btn_status_stop_recording"
                      onClick={stopCameraStream}
                      className="mt-2 w-full py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all border border-rose-500/20 flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop Recording
                    </button>
                  </div>
                )}
              </div>

              {/* Card 2: Interactive Options Panel (Dials, Configurations, or Alarm - Tabbed to avoid scrolling) */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    {sidebarTab === 'dials' ? (
                      <Sliders className="w-4 h-4 text-slate-400" />
                    ) : sidebarTab === 'adjustments' ? (
                      <Settings className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Bell className="w-4 h-4 text-slate-400 animate-pulse" />
                    )}
                    {sidebarTab === 'dials' ? 'Real-time Dials' : sidebarTab === 'adjustments' ? 'Trigger Adjustments' : 'Alarm Config'}
                  </h3>

                  <div className="flex gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      id="tab_sidebar_dials"
                      onClick={() => setSidebarTab('dials')}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all ${
                        sidebarTab === 'dials'
                          ? 'bg-slate-800 text-slate-100 shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Dials
                    </button>
                    <button
                      type="button"
                      id="tab_sidebar_adjust"
                      onClick={() => setSidebarTab('adjustments')}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all ${
                        sidebarTab === 'adjustments'
                          ? 'bg-slate-800 text-slate-100 shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Adjust
                    </button>
                    <button
                      type="button"
                      id="tab_sidebar_alarm"
                      onClick={() => setSidebarTab('alarm')}
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all ${
                        sidebarTab === 'alarm'
                          ? 'bg-slate-800 text-slate-100 shadow'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Alarm
                    </button>
                  </div>
                </div>

                {sidebarTab === 'alarm' ? (
                  <div className="flex flex-col gap-4">
                    {/* Alarm sound selection */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium font-sans uppercase tracking-wider">Alarm Sound</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['chime', 'beep', 'siren', 'ping', 'pulsar', 'buzzing'] as const).map((sound) => (
                          <button
                            key={sound}
                            type="button"
                            onClick={() => {
                              setAlarmSound(sound);
                              playWebBeep(sound, alarmVolume);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold capitalize border transition-all text-center flex items-center justify-center ${
                              alarmSound === sound
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            {sound === 'pulsar' ? 'Pulsar Beep' : sound === 'buzzing' ? 'Buzzing (5s)' : sound}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Volume setting */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>Alarm Volume:</span>
                        <span className="text-slate-200 font-bold">{Math.round(alarmVolume * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.05" 
                        max="1.0" 
                        step="0.05"
                        value={alarmVolume}
                        onChange={(e) => {
                          const vol = Number(e.target.value);
                          setAlarmVolume(vol);
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                    </div>

                    {/* Delay setting */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>Hold Time (Delay):</span>
                        <span className="text-slate-200 font-bold">{alarmDelay} seconds</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        step="1"
                        value={alarmDelay}
                        onChange={(e) => setAlarmDelay(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                    </div>

                    {/* Repeat interval setting */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium font-sans uppercase tracking-wider">Alarm Repeat</span>
                      <div className="grid grid-cols-2 gap-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => setAlarmRepeat('once')}
                          className={`py-1 px-1.5 rounded text-[10px] font-semibold border transition-all ${
                            alarmRepeat === 'once'
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                          }`}
                        >
                          Play Once
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlarmRepeat('repeat_3s')}
                          className={`py-1 px-1.5 rounded text-[10px] font-semibold border transition-all ${
                            alarmRepeat === 'repeat_3s'
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                          }`}
                        >
                          Every 3s
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlarmRepeat('repeat_5s')}
                          className={`py-1 px-1.5 rounded text-[10px] font-semibold border transition-all ${
                            alarmRepeat === 'repeat_5s'
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                          }`}
                        >
                          Every 5s
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlarmRepeat('repeat_10s')}
                          className={`py-1 px-1.5 rounded text-[10px] font-semibold border transition-all ${
                            alarmRepeat === 'repeat_10s'
                              ? 'bg-slate-800 border-slate-700 text-slate-200'
                              : 'bg-slate-950 border-slate-900 text-slate-500 hover:text-slate-400'
                          }`}
                        >
                          Every 10s
                        </button>
                      </div>
                    </div>

                    {/* Test Audio button */}
                    <button
                      type="button"
                      onClick={triggerAudioTest}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-850 text-slate-200 hover:text-white transition-all border border-slate-800 flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
                    >
                      <Bell className="w-3.5 h-3.5 text-emerald-400" />
                      Test Alarm Tone
                    </button>
                  </div>
                ) : cameraState !== 'active' ? (
                  <div className="text-center py-6 text-sm text-slate-500">
                    Metrics populate here during camera streaming.
                  </div>
                ) : sidebarTab === 'dials' ? (
                  <div className="flex flex-col gap-3">
                    {/* Metric A: Neck Tilt Angle */}
                    {tests.neckLeaning && (
                      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/50">
                        <div className="flex justify-between text-xs text-slate-400 font-medium">
                          <span>Neck Leaning Angle</span>
                          <span className={metrics.earAngle > (baseline.earAngle + thresholds.neckAngleDelta) ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                            {metrics.earAngle.toFixed(1)}°
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all rounded-full ${
                              metrics.earAngle > (baseline.earAngle + thresholds.neckAngleDelta) ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (metrics.earAngle / 45) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Baseline: {baseline.earAngle.toFixed(1)}°</span>
                          <span>Trigger: &gt; {(baseline.earAngle + thresholds.neckAngleDelta).toFixed(1)}°</span>
                        </div>
                      </div>
                    )}

                    {/* Metric B: Slouch Ratio */}
                    {tests.slouching && (
                      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/50">
                        <div className="flex justify-between text-xs text-slate-400 font-medium">
                          <span>Slouch Ratio (Nose-Shoulders)</span>
                          <span className={metrics.slouchRatio < (baseline.slouchRatio * thresholds.slouchRatioMultiplier) ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                            {metrics.slouchRatio.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all rounded-full ${
                              metrics.slouchRatio < (baseline.slouchRatio * thresholds.slouchRatioMultiplier) ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (metrics.slouchRatio / 1.0) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Baseline: {baseline.slouchRatio.toFixed(2)}</span>
                          <span>Trigger: &lt; {(baseline.slouchRatio * thresholds.slouchRatioMultiplier).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Metric C: Screen Distance (Shoulder Width) */}
                    {tests.tooClose && (
                      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800/50">
                        <div className="flex justify-between text-xs text-slate-400 font-medium">
                          <span>Shoulder Proximity (Width)</span>
                          <span className={metrics.shoulderWidth > (baseline.shoulderWidth * thresholds.tooCloseMultiplier) ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                            {metrics.shoulderWidth.toFixed(3)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all rounded-full ${
                              metrics.shoulderWidth > (baseline.shoulderWidth * thresholds.tooCloseMultiplier) ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, (metrics.shoulderWidth / 0.8) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Baseline: {baseline.shoulderWidth.toFixed(3)}</span>
                          <span>Trigger: &gt; {(baseline.shoulderWidth * thresholds.tooCloseMultiplier).toFixed(3)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Test Selector checkboxes */}
                    <div className="grid grid-cols-3 gap-2 border-b border-slate-800 pb-3 text-center">
                      <button
                        type="button"
                        onClick={() => setTests(prev => ({ ...prev, neckLeaning: !prev.neckLeaning }))}
                        className={`py-1 px-2 rounded text-[10px] font-semibold border transition-all ${
                          tests.neckLeaning 
                            ? 'bg-slate-800 border-slate-700 text-slate-200' 
                            : 'bg-slate-950 border-slate-900 text-slate-600'
                        }`}
                      >
                        Neck Tilt
                      </button>
                      <button
                        type="button"
                        onClick={() => setTests(prev => ({ ...prev, slouching: !prev.slouching }))}
                        className={`py-1 px-2 rounded text-[10px] font-semibold border transition-all ${
                          tests.slouching 
                            ? 'bg-slate-800 border-slate-700 text-slate-200' 
                            : 'bg-slate-950 border-slate-900 text-slate-600'
                        }`}
                      >
                        Slouching
                      </button>
                      <button
                        type="button"
                        onClick={() => setTests(prev => ({ ...prev, tooClose: !prev.tooClose }))}
                        className={`py-1 px-2 rounded text-[10px] font-semibold border transition-all ${
                          tests.tooClose 
                            ? 'bg-slate-800 border-slate-700 text-slate-200' 
                            : 'bg-slate-950 border-slate-900 text-slate-600'
                        }`}
                      >
                        Proximity
                      </button>
                    </div>

                    {/* Slider 1 */}
                    {tests.neckLeaning && (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>Neck Angle Threshold:</span>
                          <span className="text-slate-200 font-bold">+{thresholds.neckAngleDelta}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="5" 
                          max="25" 
                          step="1"
                          value={thresholds.neckAngleDelta}
                          onChange={(e) => setThresholds(prev => ({ ...prev, neckAngleDelta: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>
                    )}

                    {/* Slider 2 */}
                    {tests.slouching && (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>Slouch Sensitivity:</span>
                          <span className="text-slate-200 font-bold">{(thresholds.slouchRatioMultiplier * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="0.95" 
                          step="0.05"
                          value={thresholds.slouchRatioMultiplier}
                          onChange={(e) => setThresholds(prev => ({ ...prev, slouchRatioMultiplier: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>
                    )}

                    {/* Slider 3 */}
                    {tests.tooClose && (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>Proximity Boundary:</span>
                          <span className="text-slate-200 font-bold">{(thresholds.tooCloseMultiplier * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="1.05" 
                          max="1.40" 
                          step="0.05"
                          value={thresholds.tooCloseMultiplier}
                          onChange={(e) => setThresholds(prev => ({ ...prev, tooCloseMultiplier: Number(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

            </aside>
          </>
        )}

        {/* --- TAB 2: PYTHON CODE COMPANION --- */}
        {activeTab === 'code' && (
          <section id="code_explorer_panel" className="lg:col-span-12 flex flex-col gap-5 rounded-2xl bg-slate-900 border border-slate-800/80 p-5 md:p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-850 text-slate-200 border border-slate-700/60">
                  <FileCode className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 flex items-center gap-1.5">
                    Python Office Posture Monitor Code
                    <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700 font-mono">v1.0</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    This matching, lightweight Streamlit script can be run locally on your laptop with full webcam support.
                  </p>
                </div>
              </div>

              {/* File Selector Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {PYTHON_FILES.map((file, i) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedFileIndex(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedFileIndex === i 
                        ? 'bg-slate-800 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {file.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Board */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
              
              {/* Copy button */}
              <button
                id="btn_copy_file_content"
                onClick={() => handleCopyCode(PYTHON_FILES[selectedFileIndex].code)}
                className="absolute top-3 right-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:text-white transition-all flex items-center gap-1.5"
              >
                {copiedFile === PYTHON_FILES[selectedFileIndex].name ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Code
                  </>
                )}
              </button>

              <pre className="p-4 md:p-6 overflow-x-auto text-xs md:text-sm text-slate-300 font-mono leading-relaxed max-h-[500px]">
                <code>{PYTHON_FILES[selectedFileIndex].code}</code>
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 leading-relaxed flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-300">Run locally in 3 steps:</span> Install Python, execute <code className="bg-slate-850 px-1 py-0.5 rounded border border-slate-700 text-slate-300">pip install -r requirements.txt</code> in your terminal, and run <code className="bg-slate-850 px-1 py-0.5 rounded border border-slate-700 text-slate-300">streamlit run app.py</code>. A browser window will boot automatically and capture your webcam coordinates natively! Refer to <span className="text-emerald-400 underline cursor-pointer" onClick={() => setSelectedFileIndex(2)}>README.md</span> inside the files panel for complete guidelines.
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Main Bottom Footer */}
      <footer className="py-4 bg-slate-950 text-center border-t border-slate-900 mt-auto text-[11px] text-slate-600 font-mono select-none">
        Office Posture Monitor &copy; 2026 • Client-Side MediaPipe Engine
      </footer>
    </div>
  );
}
