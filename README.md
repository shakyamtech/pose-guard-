# 💻 Office Posture Monitor

A real-time computer vision application that helps users maintain healthy sitting posture using webcam-based pose estimation. The application detects poor posture, provides instant visual feedback, and alerts users to correct their posture before discomfort develops.

## ✨ Features

* 📷 Real-time webcam posture monitoring
* 🦴 Live MediaPipe pose skeleton visualization
* ⚠️ Detects:

  * Neck bent forward
  * Slouching
  * Sitting too close to the screen
* 🔔 Audio alarm when poor posture is maintained
* 🟢 Green indicator for good posture
* 🔴 Red warning for incorrect posture
* ⚡ Lightweight and responsive interface

## 🛠️ Tech Stack

* React
* TypeScript
* Vite
* Python
* OpenCV
* MediaPipe Pose

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/shakyamtech/pose-guard-.git
cd Office-Posture-Monitor
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Open the local URL displayed in your terminal (typically `http://localhost:5173`).

## 🧠 How It Works

The application uses MediaPipe Pose to detect body landmarks from the webcam feed. Using these landmarks, it analyzes body posture in real time by checking:

* Head position relative to the shoulders
* Shoulder alignment
* Upper-body posture
* Distance from the camera

When poor posture is detected continuously for a short period, the application displays a warning and plays an audio alert. Once the user corrects their posture, the warning is automatically removed.

## 📌 Future Improvements

* Posture history and analytics
* Daily posture reports
* Adjustable sensitivity
* Break reminders
* Multi-user support

## 👩‍💻 Author

**Mahesh Shakya** ([@shakyamtech](https://github.com/shakyamtech))

If you found this project interesting, feel free to star ⭐ the repository or share your feedback.
