"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export function MeshViewer({ glbUrl, onClose }: { glbUrl: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "90%", height: "90%", background: "#111", borderRadius: 8, position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>Close</button>
        <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <Suspense fallback={null}>
            <Model url={glbUrl} />
          </Suspense>
          <OrbitControls />
        </Canvas>
      </div>
    </div>
  );
}
