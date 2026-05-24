"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Node = {
  x: number;
  y: number;
  z: number;
};

function Network() {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const target = useRef({ x: 0, y: 0 });
  const { camera } = useThree();

  const nodes = useMemo<Node[]>(() => {
    return Array.from({ length: 200 }, (_, index) => {
      const spread = 22;
      const angle = index * 1.618;
      const radius = Math.sqrt(index / 200) * spread;

      return {
        x: Math.cos(angle) * radius + (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 12,
        z: Math.sin(angle) * radius + (Math.random() - 0.5) * 9,
      };
    });
  }, []);

  const linePositions = useMemo(() => {
    const positions: number[] = [];
    const threshold = 4.2;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const distance = Math.sqrt(
          (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2,
        );

        if (distance < threshold) {
          positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }

    return new Float32Array(positions);
  }, [nodes]);

  useEffect(() => {
    const dummy = new THREE.Object3D();

    nodes.forEach((node, index) => {
      dummy.position.set(node.x, node.y, node.z);
      const scale = 0.035 + (index % 4) * 0.01;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });

    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [nodes]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      target.current = {
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: (event.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y += 0.0003;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.05;
    }

    camera.position.x += (target.current.x * 1.2 - camera.position.x) * 0.025;
    camera.position.y += (-target.current.y * 0.8 - camera.position.y) * 0.025;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, nodes.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#00ffb2" transparent opacity={0.82} />
      </instancedMesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#00ffb2" transparent opacity={0.14} />
      </lineSegments>
    </group>
  );
}

export default function ParticleField() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 18], fov: 55 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Network />
      </Canvas>
    </div>
  );
}
