'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line, Html } from '@react-three/drei';
import { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';

interface SyllabusNode {
  id: string;
  code: string;
  name: string;
  paper: string;
  topic: string;
  children?: SyllabusNode[];
}

interface Props {
  nodes: SyllabusNode[];
  onNodeClick: (node: SyllabusNode) => void;
}

const PAPER_COLORS: Record<string, string> = {
  GS1: '#00f3ff',
  GS2: '#bc13fe',
  GS3: '#00ff9d',
  GS4: '#ff00ff',
  CSAT: '#ff9500',
  Essay: '#ff006b',
};

function NodeSphere({
  node,
  position,
  color,
  isSelected,
  onClick,
  isHovered,
  setHovered
}: {
  node: SyllabusNode;
  position: [number, number, number];
  color: string;
  isSelected: boolean;
  onClick: () => void;
  isHovered: boolean;
  setHovered: (hovered: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setLocalHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(hovered || isHovered ? 1.2 : 1);
      meshRef.current.rotation.y += 0.01;
    }
  });

  const finalHovered = hovered || isHovered;

  return (
    <group position={position}>
      <Sphere
        ref={meshRef}
        args={[0.3, 32, 32]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setLocalHovered(true);
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setLocalHovered(false);
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <meshStandardMaterial
          color={finalHovered ? '#ffffff' : color}
          emissive={finalHovered ? color : '#000000'}
          emissiveIntensity={finalHovered ? 0.5 : 0}
          transparent
          opacity={0.9}
        />
      </Sphere>

      {/* Progress ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.4, 32, 1, 0, Math.PI * 0.75]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>

      {/* Label */}
      <Html
        position={[0, 0.6, 0]}
        center
        style={{ pointerEvents: 'none' }}
        distanceFactor={10}
      >
        <div
          className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
            finalHovered ? 'bg-slate-800 text-white' : 'bg-slate-900/80 text-gray-300'
          }`}
        >
          {node.code}
        </div>
      </Html>
    </group>
  );
}

function ConnectionLine({
  start,
  end
}: {
  start: [number, number, number];
  end: [number, number, number];
}) {
  return (
    <Line
      points={[start, end]}
      color="#444"
      lineWidth={1}
      transparent
      opacity={0.3}
    />
  );
}

function CameraController() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 5, 15);
  }, [camera]);

  return null;
}

function TreeLayout({
  nodes,
  level = 0,
  x = 0,
  y = 3,
  z = 0,
  spread = 4,
  onNodeClick
}: {
  nodes: SyllabusNode[];
  level?: number;
  x?: number;
  y?: number;
  z?: number;
  spread?: number;
  onNodeClick: (node: SyllabusNode) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (nodes.length === 0) return null;

  const results: JSX.Element[] = [];
  const startX = x - ((nodes.length - 1) * spread) / 2;

  nodes.forEach((node, index) => {
    const nodeX = startX + index * spread;
    const nodeY = y - level * 2;
    const position: [number, number, number] = [nodeX, nodeY, z];

    results.push(
      <NodeSphere
        key={node.id}
        node={node}
        position={position}
        color={PAPER_COLORS[node.paper] || '#666'}
        isSelected={false}
        onClick={() => onNodeClick(node)}
        isHovered={hoveredId === node.id}
        setHovered={(h) => setHoveredId(h ? node.id : null)}
      />
    );

    if (node.children && node.children.length > 0) {
      const childSpread = spread / (node.children.length > 1 ? 1.5 : 1);
      const childStartX = nodeX - ((node.children.length - 1) * childSpread) / 2;

      node.children.forEach((child, childIndex) => {
        const childX = childStartX + childIndex * childSpread;
        const childPosition: [number, number, number] = [childX, nodeY - 2, z];

        // Draw connection line
        results.push(
          <ConnectionLine
            key={`line-${node.id}-${child.id}`}
            start={position}
            end={childPosition}
          />
        );
      });
    }
  });

  return <>{results}</>;
}

export default function SyllabusCanvas({ nodes, onNodeClick }: Props) {
  const router = useRouter();

  // Flatten nodes for display (limit to top-level for clarity)
  const topLevelNodes = nodes.filter(n => n.depth === 0);

  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-900 to-purple-950">
      <Canvas
        camera={{ position: [0, 5, 15], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#0a0a1a']} />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#00f3ff" />

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 4}
        />

        {/* Render nodes */}
        <TreeLayout
          nodes={topLevelNodes}
          onNodeClick={onNodeClick}
        />

        {/* Background stars/particles */}
        <Stars />
      </Canvas>

      {/* Overlay instructions */}
      <div className="absolute bottom-4 left-4 text-sm text-gray-500">
        <p>Drag to rotate • Scroll to zoom • Click node for details</p>
      </div>
    </div>
  );
}

function Stars() {
  const starsRef = useRef<THREE.Points>(null);

  const starPositions = useMemo(() => {
    const positions = [];
    for (let i = 0; i < 500; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = (Math.random() - 0.5) * 50;
      const z = (Math.random() - 0.5) * 50;
      positions.push(x, y, z);
    }
    return new Float32Array(positions);
  }, []);

  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[starPositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#ffffff" transparent opacity={0.6} />
    </points>
  );
}
