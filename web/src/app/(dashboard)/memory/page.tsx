'use client';

import { useState, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

interface MemoryNode {
  id: string;
  topic: string;
  fact: string;
  position: [number, number, number];
  color: string;
}

interface MemoryRoom {
  id: string;
  name: string;
  nodes: MemoryNode[];
  position: [number, number, number];
}

// Sample memory palace data
const INITIAL_ROOMS: MemoryRoom[] = [
  {
    id: 'room1',
    name: 'Constitution Hall',
    position: [0, 0, 0],
    nodes: [
      { id: 'n1', topic: 'Articles', fact: '448 Articles', position: [-2, 0, 0], color: '#00f3ff' },
      { id: 'n2', topic: 'Schedules', fact: '12 Schedules', position: [-1, 0, 0], color: '#bc13fe' },
      { id: 'n3', topic: 'Parts', fact: '22 Parts', position: [0, 0, 0], color: '#00ff9d' },
      { id: 'n4', topic: 'Amendments', fact: '104 Amendments', position: [1, 0, 0], color: '#ff006b' },
      { id: 'n5', topic: 'Fundamental Rights', fact: '6 Rights', position: [2, 0, 0], color: '#ff9500' },
    ],
  },
  {
    id: 'room2',
    name: 'Geography Wing',
    position: [10, 0, 0],
    nodes: [
      { id: 'n6', topic: 'States', fact: '28 States', position: [-2, 0, 0], color: '#00f3ff' },
      { id: 'n7', topic: 'UTs', fact: '8 Union Territories', position: [-1, 0, 0], color: '#bc13fe' },
      { id: 'n8', topic: 'Mountains', fact: '3 Ranges', position: [0, 0, 0], color: '#00ff9d' },
      { id: 'n9', topic: 'Rivers', fact: 'Major Rivers System', position: [1, 0, 0], color: '#ff006b' },
      { id: 'n10', topic: 'Climate', fact: '6 Seasons', position: [2, 0, 0], color: '#ff9500' },
    ],
  },
  {
    id: 'room3',
    name: 'History Chamber',
    position: [20, 0, 0],
    nodes: [
      { id: 'n11', topic: 'Ancient', fact: 'Harappan Civilization', position: [-2, 0, 0], color: '#00f3ff' },
      { id: 'n12', topic: 'Medieval', fact: 'Mughal Empire', position: [-1, 0, 0], color: '#bc13fe' },
      { id: 'n13', topic: 'Modern', fact: 'Independence 1947', position: [0, 0, 0], color: '#00ff9d' },
      { id: 'n14', topic: 'Freedom', fact: '1857-1947', position: [1, 0, 0], color: '#ff006b' },
      { id: 'n15', topic: 'Constitution', fact: 'Adopted 1950', position: [2, 0, 0], color: '#ff9500' },
    ],
  },
];

function MemorySphere({
  node,
  isHovered,
  onHover,
  onClick
}: {
  node: MemoryNode;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setLocalHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(hovered || isHovered ? 1.3 : 1);
      meshRef.current.rotation.y += 0.02;
    }
  });

  const finalHovered = hovered || isHovered;

  return (
    <group position={node.position}>
      <Sphere
        ref={meshRef}
        args={[0.4, 32, 32]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setLocalHovered(true);
          onHover(node.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setLocalHovered(false);
          onHover(null);
          document.body.style.cursor = 'default';
        }}
      >
        <meshStandardMaterial
          color={finalHovered ? '#ffffff' : node.color}
          emissive={finalHovered ? node.color : '#000000'}
          emissiveIntensity={finalHovered ? 0.5 : 0.2}
          transparent
          opacity={0.9}
        />
      </Sphere>

      {/* Connection line to center */}
      <Line
        points={[[0, 0, 0], [0, -1, 0]]}
        color={node.color}
        lineWidth={1}
        transparent
        opacity={0.3}
      />

      {/* Label */}
      <Html position={[0, 0.8, 0]} center distanceFactor={15}>
        <div className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
          finalHovered ? 'bg-slate-800 text-white' : 'bg-slate-900/80 text-gray-300'
        }`}>
          {node.topic}
        </div>
      </Html>
    </group>
  );
}

function RoomConnection({
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
      lineWidth={2}
      transparent
      opacity={0.5}
      dashed
      dashScale={2}
      dashSize={0.5}
    />
  );
}

function MemoryPalace({ rooms, onNodeClick }: {
  rooms: MemoryRoom[];
  onNodeClick: (node: MemoryNode) => void;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<MemoryRoom | null>(null);

  return (
    <>
      {/* Rooms */}
      {rooms.map((room) => (
        <group key={room.id} position={room.position}>
          {/* Room floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
            <circleGeometry args={[4, 32]} />
            <meshStandardMaterial
              color="#1a1a2e"
              transparent
              opacity={0.5}
            />
          </mesh>

          {/* Room label */}
          <Html position={[0, 3, 0]} center>
            <div className="px-3 py-1 bg-neon-blue/20 border border-neon-blue/50 rounded text-white text-sm whitespace-nowrap">
              {room.name}
            </div>
          </Html>

          {/* Memory nodes */}
          {room.nodes.map((node) => (
            <MemorySphere
              key={node.id}
              node={node}
              isHovered={hoveredNode === node.id}
              onHover={setHoveredNode}
              onClick={() => onNodeClick(node)}
            />
          ))}
        </group>
      ))}

      {/* Connections between rooms */}
      {rooms.slice(0, -1).map((room, index) => (
        <RoomConnection
          key={`conn-${room.id}`}
          start={[room.position[0] + 3, 0, 0]}
          end={[rooms[index + 1].position[0] - 3, 0, 0]}
        />
      ))}

      {/* Camera controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxPolarAngle={Math.PI / 1.5}
        minPolarAngle={Math.PI / 4}
        autoRotate={!hoveredNode}
        autoRotateSpeed={0.5}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#00f3ff" />
    </>
  );
}

function FloatingParticles() {
  const particles = useMemo(() => {
    const positions = [];
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 50;
      positions.push(x, y, z);
    }
    return new Float32Array(positions);
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#ffffff" transparent opacity={0.6} />
    </points>
  );
}

export default function MemoryPalacePage() {
  const [rooms] = useState<MemoryRoom[]>(INITIAL_ROOMS);
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [customFact, setCustomFact] = useState('');

  const handleAddMemory = () => {
    if (!customTopic.trim() || !customFact.trim()) {
      alert('Please enter both topic and fact');
      return;
    }
    alert('Memory added! In a full version, this would appear in the 3D visualization.');
    setCustomTopic('');
    setCustomFact('');
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none">
        <div className="max-w-6xl mx-auto pointer-events-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Memory Palace</h1>
          <p className="text-gray-400">Visualize facts using spatial memory techniques</p>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-purple-950">
        <Canvas camera={{ position: [0, 5, 20], fov: 60 }}>
          <color attach="background" args={['#0a0a1a']} />
          <MemoryPalace rooms={rooms} onNodeClick={setSelectedNode} />
          <FloatingParticles />
        </Canvas>
      </div>

      {/* Instructions Overlay */}
      <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-sm p-4 rounded-lg text-gray-400 text-sm">
          <p>Drag to rotate | Scroll to zoom | Click nodes for details</p>
        </div>
      </div>

      {/* Selected Node Panel */}
      {selectedNode && (
        <div className="absolute top-24 right-6 w-80 z-10">
          <div className="neon-glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{selectedNode.topic}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <span className="text-xs text-gray-500 uppercase">Remember This</span>
              <p className="text-2xl font-bold text-neon-blue mt-1">{selectedNode.fact}</p>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-gray-300 text-sm">
                Imagine this fact is written on a glowing sphere in front of you.
                The {selectedNode.color} color helps you remember this topic.
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Memory Tip</h4>
              <p className="text-gray-300 text-sm">
                Create a mental image connecting {selectedNode.topic} with {selectedNode.fact}.
                The weirder the image, the better you will remember!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add New Memory Panel */}
      <div className="absolute bottom-6 right-6 w-80 z-10">
        <div className="neon-glass p-6 rounded-xl">
          <h3 className="font-bold text-white mb-4">Add New Memory</h3>
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Topic (e.g., Five Year Plans)"
            className="w-full p-3 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm mb-3"
          />
          <input
            type="text"
            value={customFact}
            onChange={(e) => setCustomFact(e.target.value)}
            placeholder="Fact to remember (e.g., 12th Plan 2012-2017)"
            className="w-full p-3 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm mb-3"
          />
          <button
            onClick={handleAddMemory}
            className="w-full btn-primary"
          >
            Add to Palace
          </button>
        </div>
      </div>

      {/* Room Navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <div className="flex gap-2">
          {rooms.map((room) => (
            <button
              key={room.id}
              className="px-4 py-2 bg-slate-900/80 backdrop-blur-sm text-gray-300 rounded-lg text-sm hover:bg-neon-blue/20 hover:text-neon-blue transition-colors"
            >
              {room.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
