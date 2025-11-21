from pathlib import Path
from typing import List

import cv2
import mediapipe as mp
import numpy as np


class VideoProcessorService:
    TARGET_FRAMES = 40
    FEATURES_PER_FRAME = 95

    def __init__(self) -> None:
        self._mp_hands = mp.solutions.hands

    def extract_landmarks_from_video(self, file_path: str | Path) -> List[List[float]]:
        path = Path(file_path)
        if not path.exists():
            raise ValueError(f"El archivo de video no existe: {path}")

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise ValueError("No se pudo abrir el archivo de video")

        try:
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
            if frame_count <= 0:
                raise ValueError("El video no contiene frames válidos")

            indices = np.linspace(0, frame_count - 1, self.TARGET_FRAMES, dtype=int)
            zero_frame = [0.0] * self.FEATURES_PER_FRAME
            frames_features: List[List[float]] = []

            with self._mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=1,
                model_complexity=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            ) as hands:
                for idx in indices:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                    success, frame = cap.read()
                    if not success or frame is None:
                        frames_features.append(zero_frame.copy())
                        continue

                    features = self._extract_features_from_frame(frame, hands)
                    frames_features.append(features)

            return frames_features
        finally:
            cap.release()

    def _extract_features_from_frame(self, frame: np.ndarray, hands: mp.solutions.hands.Hands) -> List[float]:
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(image_rgb)

        if not results.multi_hand_landmarks:
            return [0.0] * self.FEATURES_PER_FRAME

        hand_landmarks = results.multi_hand_landmarks[0]
        landmarks = [[lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark]
        features = self._extract_features(landmarks)

        if len(features) < self.FEATURES_PER_FRAME:
            features = features + [0.0] * (self.FEATURES_PER_FRAME - len(features))
        elif len(features) > self.FEATURES_PER_FRAME:
            features = features[: self.FEATURES_PER_FRAME]

        return features

    def _extract_features(self, landmarks: List[List[float]]) -> List[float]:
        normalized = self._normalize_hand(landmarks)
        base = self._flatten_landmarks(normalized)
        dists = self._compute_distances_normalized(normalized)
        angles = self._compute_angles_normalized(normalized)
        vectors = self._compute_vectors(normalized)
        return base + dists + angles + vectors

    def _normalize_hand(self, hand_landmarks: List[List[float]]) -> List[List[float]]:
        lm = [[float(x), float(y), float(z)] for x, y, z in hand_landmarks]
        palm = lm[0]
        centered = [[x - palm[0], y - palm[1], z - palm[2]] for x, y, z in lm]

        finger_tips = [4, 8, 12, 16, 20]
        dists = [self._vector_norm(centered[idx]) for idx in finger_tips]
        mean_dist = float(sum(dists) / len(dists)) if dists else 1.0
        scale = mean_dist + 1e-6

        return [[x / scale, y / scale, z / scale] for x, y, z in centered]

    def _flatten_landmarks(self, lm: List[List[float]]) -> List[float]:
        return [coord for point in lm for coord in point]

    def _vector_norm(self, v: List[float]) -> float:
        x, y, z = v
        return float(np.sqrt(x * x + y * y + z * z))

    def _compute_distances_normalized(self, lm: List[List[float]]) -> List[float]:
        fingers = [4, 8, 12, 16, 20]
        palm = 0
        features: List[float] = []

        for f in fingers:
            features.append(self._euclidean_array(lm[f], lm[palm]))

        for i in range(len(fingers) - 1):
            features.append(self._euclidean_array(lm[fingers[i]], lm[fingers[i + 1]]))

        pairs = [
            (4, 8),
            (8, 12),
            (12, 16),
            (16, 20),
        ]

        for a, b in pairs:
            features.append(self._euclidean_array(lm[a], lm[b]))

        return features

    def _euclidean_array(self, a: List[float], b: List[float]) -> float:
        dx = a[0] - b[0]
        dy = a[1] - b[1]
        dz = a[2] - b[2]
        return float(np.sqrt(dx * dx + dy * dy + dz * dz))

    def _compute_angles_normalized(self, lm: List[List[float]]) -> List[float]:
        features: List[float] = []

        fingers = {
            "thumb": (1, 2, 3, 4),
            "index": (5, 6, 7, 8),
            "middle": (9, 10, 11, 12),
            "ring": (13, 14, 15, 16),
            "pinky": (17, 18, 19, 20),
        }

        for p0, p1, p2, p3 in fingers.values():
            features.append(self._angle_array(lm[p0], lm[p1], lm[p2]))
            features.append(self._angle_array(lm[p1], lm[p2], lm[p3]))

        return features

    def _angle_array(self, a: List[float], b: List[float], c: List[float]) -> float:
        ba = self._sub_vec(a, b)
        bc = self._sub_vec(c, b)

        denom = self._vector_norm(ba) * self._vector_norm(bc) + 1e-6
        dot = self._dot3(ba, bc)
        cosang = max(-1.0, min(1.0, dot / denom))
        return float(np.arccos(cosang))

    def _dot3(self, a: List[float], b: List[float]) -> float:
        return float(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])

    def _compute_vectors(self, lm: List[List[float]]) -> List[float]:
        palm = lm[0]
        idx_tip = lm[8]
        thumb_tip = lm[4]

        v1 = self._sub_vec(idx_tip, palm)
        v2 = self._sub_vec(thumb_tip, palm)

        idx_mcp = lm[5]
        mid_mcp = lm[9]
        normal = self._cross3(self._sub_vec(idx_mcp, palm), self._sub_vec(mid_mcp, palm))

        return [
            *v1,
            *v2,
            *normal,
        ]

    def _sub_vec(self, a: List[float], b: List[float]) -> List[float]:
        return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

    def _cross3(self, a: List[float], b: List[float]) -> List[float]:
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
        ]
