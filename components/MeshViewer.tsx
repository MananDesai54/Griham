"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export function MeshViewer({
  glbUrl,
  onClose,
}: {
  glbUrl: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl w-[96vw] h-[85vh] flex flex-col p-4">
        <DialogHeader>
          <DialogTitle>3D Model</DialogTitle>
        </DialogHeader>
        <div className="flex-1 rounded-lg overflow-hidden bg-[#111] min-h-0">
          <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <Suspense fallback={null}>
              <Model url={glbUrl} />
            </Suspense>
            <OrbitControls />
          </Canvas>
        </div>
      </DialogContent>
    </Dialog>
  );
}
