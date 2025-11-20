/**
 * Servicio de MediaPipe Hands para detección de manos en tiempo real
 */
export class MediaPipeService {
  private hands: any = null;
  private isInitialized = false;
  private scriptPromise: Promise<void> | null = null;

  /**
   * Inicializa MediaPipe Hands
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const HandsCtor = await this.loadHandsConstructor();

    this.hands = new HandsCtor({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.isInitialized = true;
    console.log('✅ MediaPipe Hands inicializado');
  }

  /**
   * Carga dinámica del constructor de MediaPipe Hands (compatibilidad web/expo)
   */
  private async loadHandsConstructor(): Promise<any> {
    if (typeof window === 'undefined') {
      throw new Error('MediaPipe Hands solo está disponible en entornos con DOM');
    }

    if ((window as any).Hands) {
      return (window as any).Hands;
    }

    if (!this.scriptPromise) {
      this.scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar el script de MediaPipe Hands'));
        document.body.appendChild(script);
      });
    }

    await this.scriptPromise;

    if ((window as any).Hands) {
      return (window as any).Hands;
    }

    throw new Error('No se pudo cargar MediaPipe Hands');
  }

  /**
   * Procesa un frame de video y extrae landmarks
   */
  async processFrame(videoElement: HTMLVideoElement): Promise<number[] | null> {
    if (!this.hands || !this.isInitialized) {
      throw new Error('MediaPipe no está inicializado');
    }

    return new Promise((resolve) => {
      this.hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = this.extractFeatures(results.multiHandLandmarks[0]);
          resolve(landmarks);
        } else {
          resolve(null); // No se detectó mano
        }
      });

      this.hands.send({ image: videoElement });
    });
  }

  /**
   * Extrae las 95 features de los landmarks de MediaPipe
   */
  private extractFeatures(handLandmarks: any[]): number[] {
    // Validación básica
    if (!handLandmarks || handLandmarks.length !== 21) {
      return new Array(95).fill(0);
    }

    // 1) Normalizar mano: palma al origen y escalar por tamaño medio de la mano
    const lm = this.normalizeHand(handLandmarks); // (21, 3)

    // 2) 63 coordenadas base
    const base = this.flattenLandmarks(lm); // 63

    // 3) Distancias tal como en compute_distances del entrenamiento (~13)
    const dists = this.computeDistancesNormalized(lm);

    // 4) Ángulos tal como en compute_angles (10)
    const angles = this.computeAnglesNormalized(lm);

    // 5) Vectores clave tal como en compute_vectors (9)
    const vectors = this.computeVectors(lm);

    let features = [...base, ...dists, ...angles, ...vectors];

    // Asegurar longitud exacta 95 como en el entrenamiento
    if (features.length < 95) {
      while (features.length < 95) {
        features.push(0);
      }
    } else if (features.length > 95) {
      features = features.slice(0, 95);
    }

    return features;
  }

  /**
   * Normaliza la mano: traslada la palma al origen y escala por tamaño medio.
   * Equivalente a normalize_hand en el código de entrenamiento.
   */
  private normalizeHand(handLandmarks: any[]): number[][] {
    const lm: number[][] = handLandmarks.map((p: any) => [
      typeof p.x === 'number' ? p.x : 0,
      typeof p.y === 'number' ? p.y : 0,
      typeof p.z === 'number' ? p.z : 0,
    ]);

    const palm = lm[0];
    const centered = lm.map(([x, y, z]) => [
      x - palm[0],
      y - palm[1],
      z - palm[2],
    ]);

    const fingerTips = [4, 8, 12, 16, 20];
    const dists = fingerTips.map((idx) => this.vectorNorm(centered[idx]));
    const meanDist = dists.reduce((sum, d) => sum + d, 0) / dists.length;
    const scale = meanDist + 1e-6;

    return centered.map(([x, y, z]) => [x / scale, y / scale, z / scale]);
  }

  private flattenLandmarks(lm: number[][]): number[] {
    return lm.flat();
  }

  private vectorNorm(v: number[]): number {
    const [x, y, z] = v;
    return Math.sqrt(x * x + y * y + z * z);
  }

  /**
   * Distancias normalizadas entre palma/puntas y puntas vecinas, como compute_distances.
   */
  private computeDistancesNormalized(lm: number[][]): number[] {
    const fingers = [4, 8, 12, 16, 20];
    const palm = 0;
    const features: number[] = [];

    // palma ↔ cada punta
    for (const f of fingers) {
      features.push(this.euclideanArray(lm[f], lm[palm]));
    }

    // puntas vecinas
    for (let i = 0; i < fingers.length - 1; i++) {
      features.push(this.euclideanArray(lm[fingers[i]], lm[fingers[i + 1]]));
    }

    // pares adicionales (mismos índices que en compute_distances)
    const pairs: Array<[number, number]> = [
      [4, 8],
      [8, 12],
      [12, 16],
      [16, 20],
    ];

    for (const [a, b] of pairs) {
      features.push(this.euclideanArray(lm[a], lm[b]));
    }

    return features;
  }

  private euclideanArray(a: number[], b: number[]): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Ángulos en dos articulaciones por dedo, como compute_angles.
   */
  private computeAnglesNormalized(lm: number[][]): number[] {
    const features: number[] = [];

    const fingers: Record<string, [number, number, number, number]> = {
      thumb: [1, 2, 3, 4],
      index: [5, 6, 7, 8],
      middle: [9, 10, 11, 12],
      ring: [13, 14, 15, 16],
      pinky: [17, 18, 19, 20],
    };

    Object.values(fingers).forEach(([p0, p1, p2, p3]) => {
      features.push(this.angleArray(lm[p0], lm[p1], lm[p2]));
      features.push(this.angleArray(lm[p1], lm[p2], lm[p3]));
    });

    return features;
  }

  private angleArray(a: number[], b: number[], c: number[]): number {
    const ba = this.subVec(a, b);
    const bc = this.subVec(c, b);

    const denom = this.vectorNorm(ba) * this.vectorNorm(bc) + 1e-6;
    const cosang = Math.max(-1, Math.min(1, this.dot3(ba, bc) / denom));
    return Math.acos(cosang);
  }

  private dot3(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  /**
   * Vectores clave palma→índice, palma→pulgar y normal del plano palma-índice-medio.
   * Equivalente a compute_vectors.
   */
  private computeVectors(lm: number[][]): number[] {
    const palm = lm[0];
    const idxTip = lm[8];
    const thumbTip = lm[4];

    const v1 = this.subVec(idxTip, palm);
    const v2 = this.subVec(thumbTip, palm);

    const idxMcp = lm[5];
    const midMcp = lm[9];
    const normal = this.cross3(this.subVec(idxMcp, palm), this.subVec(midMcp, palm));

    return [...v1, ...v2, ...normal];
  }

  private subVec(a: number[], b: number[]): number[] {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  private cross3(a: number[], b: number[]): number[] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  /**
   * Calcula distancias entre puntos clave de la mano
   */
  private calculateDistances(landmarks: any[]): number[] {
    const distances: number[] = [];
    
    // Distancias de la muñeca (0) a las puntas de los dedos
    const fingerTips = [4, 8, 12, 16, 20]; // Pulgar, índice, medio, anular, meñique
    
    for (const tip of fingerTips) {
      const dist = this.euclideanDistance(landmarks[0], landmarks[tip]);
      distances.push(dist);
    }

    // Distancias entre puntas de dedos consecutivos
    for (let i = 0; i < fingerTips.length - 1; i++) {
      const dist = this.euclideanDistance(landmarks[fingerTips[i]], landmarks[fingerTips[i + 1]]);
      distances.push(dist);
    }

    return distances.slice(0, 8);
  }

  /**
   * Calcula ángulos entre segmentos de dedos
   */
  private calculateAngles(landmarks: any[]): number[] {
    const angles: number[] = [];
    
    // Ángulos de cada dedo (base, medio, punta)
    const fingers = [
      [1, 2, 3, 4],   // Pulgar
      [5, 6, 7, 8],   // Índice
      [9, 10, 11, 12], // Medio
      [13, 14, 15, 16], // Anular
      [17, 18, 19, 20], // Meñique
    ];

    for (const finger of fingers) {
      if (finger.length >= 3) {
        const angle = this.calculateAngle(
          landmarks[finger[0]],
          landmarks[finger[1]],
          landmarks[finger[2]]
        );
        angles.push(angle);
      }
    }

    // Rellenar hasta 8 ángulos
    while (angles.length < 8) {
      angles.push(0);
    }

    return angles.slice(0, 8);
  }

  /**
   * Calcula el centro geométrico de la mano
   */
  private calculateCenter(landmarks: any[]): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;

    for (const landmark of landmarks) {
      sumX += landmark.x;
      sumY += landmark.y;
    }

    return {
      x: sumX / landmarks.length,
      y: sumY / landmarks.length,
    };
  }

  /**
   * Calcula el área aproximada de la mano
   */
  private calculateArea(landmarks: any[]): number {
    // Usar el rectángulo delimitador
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const landmark of landmarks) {
      minX = Math.min(minX, landmark.x);
      maxX = Math.max(maxX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxY = Math.max(maxY, landmark.y);
    }

    return (maxX - minX) * (maxY - minY);
  }

  /**
   * Calcula la orientación de la mano
   */
  private calculateOrientation(landmarks: any[]): number {
    // Ángulo entre muñeca y dedo medio
    const wrist = landmarks[0];
    const middleFinger = landmarks[12];
    
    return Math.atan2(middleFinger.y - wrist.y, middleFinger.x - wrist.x);
  }

  /**
   * Calcula features adicionales
   */
  private calculateAdditionalFeatures(landmarks: any[]): number[] {
    const features: number[] = [];

    // Ratios entre distancias
    const wristToIndex = this.euclideanDistance(landmarks[0], landmarks[8]);
    const wristToMiddle = this.euclideanDistance(landmarks[0], landmarks[12]);
    features.push(wristToIndex / (wristToMiddle + 0.0001));

    // Spread de los dedos
    const indexToMiddle = this.euclideanDistance(landmarks[8], landmarks[12]);
    const middleToRing = this.euclideanDistance(landmarks[12], landmarks[16]);
    features.push(indexToMiddle, middleToRing);

    // Altura relativa de dedos
    for (const tip of [4, 8, 12, 16, 20]) {
      features.push(landmarks[tip].y - landmarks[0].y);
    }

    // Rellenar hasta tener suficientes features
    while (features.length < 12) {
      features.push(0);
    }

    return features.slice(0, 12);
  }

  /**
   * Distancia euclidiana entre dos puntos
   */
  private euclideanDistance(p1: any, p2: any): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = (p2.z || 0) - (p1.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calcula el ángulo entre tres puntos
   */
  private calculateAngle(p1: any, p2: any, p3: any): number {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    return Math.acos(dot / (mag1 * mag2 + 0.0001));
  }

  /**
   * Limpia los recursos
   */
  dispose(): void {
    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }
    this.isInitialized = false;
  }
}

// Singleton
export const mediaPipeService = new MediaPipeService();
