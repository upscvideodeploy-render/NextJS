'use client';

/**
 * 3D Subject Rooms Component - Story 14.1 AC 4
 * 
 * Virtual 3D rooms per subject (Polity, History, Geography, etc.)
 * Uses CSS 3D transforms for performant visualization
 */

import { useState, useEffect } from 'react';

interface SubjectRoom {
  id: string;
  subject_code: string;
  name: string;
  description: string;
  theme_color: string;
  icon: string;
  display_order: number;
  progress: {
    visited: boolean;
    time_spent_minutes: number;
    completion_percentage: number;
  };
}

interface SubjectRoomsProps {
  onRoomSelect?: (room: SubjectRoom) => void;
}

export default function SubjectRooms({ onRoomSelect }: SubjectRoomsProps) {
  const [rooms, setRooms] = useState<SubjectRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<SubjectRoom | null>(null);
  const [rotateX, setRotateX] = useState(-15);
  const [rotateY, setRotateY] = useState(-30);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('/api/gamification?action=rooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const visitRoom = async (room: SubjectRoom) => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      await fetch('/api/gamification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'visit_room',
          room_id: room.id
        })
      });
      
      // Update local state
      setRooms(prev => prev.map(r => 
        r.id === room.id 
          ? { ...r, progress: { ...r.progress, visited: true } }
          : r
      ));
      
      setSelectedRoom(room);
      onRoomSelect?.(room);
    } catch (error) {
      console.error('Failed to visit room:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    setRotateY(prev => prev + deltaX * 0.5);
    setRotateX(prev => Math.max(-60, Math.min(60, prev - deltaY * 0.5)));
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white">Loading subject rooms...</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 3D Scene Container */}
      <div
        className="relative h-[500px] perspective-1000 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 3D Room Grid */}
        <div
          className="absolute inset-0 flex items-center justify-center transform-style-3d transition-transform duration-100"
          style={{
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
          }}
        >
          {/* Floor */}
          <div
            className="absolute w-[600px] h-[600px] bg-gradient-to-br from-gray-800 to-gray-900"
            style={{
              transform: 'rotateX(90deg) translateZ(-100px)',
              boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)'
            }}
          />

          {/* Subject Room Cubes */}
          <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
            {rooms.map((room, index) => {
              const angle = (index / rooms.length) * 360;
              const radius = 200;
              const x = Math.sin((angle * Math.PI) / 180) * radius;
              const z = Math.cos((angle * Math.PI) / 180) * radius;

              return (
                <div
                  key={room.id}
                  className="absolute cursor-pointer transition-all duration-300 hover:scale-110"
                  style={{
                    transform: `translate3d(${x}px, 0, ${z}px) rotateY(${-angle}deg)`,
                    transformStyle: 'preserve-3d'
                  }}
                  onClick={() => visitRoom(room)}
                >
                  {/* Room Cube */}
                  <div
                    className="relative w-24 h-24"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Front Face */}
                    <div
                      className={`absolute w-24 h-24 flex flex-col items-center justify-center rounded-lg transition-all ${
                        room.progress.visited ? 'opacity-100' : 'opacity-70'
                      }`}
                      style={{
                        backgroundColor: room.theme_color,
                        transform: 'translateZ(48px)',
                        boxShadow: `0 0 30px ${room.theme_color}40`
                      }}
                    >
                      <span className="text-3xl mb-1">{room.icon}</span>
                      <span className="text-xs text-white font-bold text-center px-1">
                        {room.name.split(' ')[0]}
                      </span>
                      {!room.progress.visited && (
                        <span className="absolute -top-2 -right-2 text-xl">🔒</span>
                      )}
                    </div>

                    {/* Back Face */}
                    <div
                      className="absolute w-24 h-24 rounded-lg"
                      style={{
                        backgroundColor: room.theme_color,
                        transform: 'rotateY(180deg) translateZ(48px)',
                        opacity: 0.8
                      }}
                    />

                    {/* Top Face */}
                    <div
                      className="absolute w-24 h-24 rounded-lg"
                      style={{
                        backgroundColor: room.theme_color,
                        transform: 'rotateX(90deg) translateZ(48px)',
                        opacity: 0.9
                      }}
                    />

                    {/* Bottom Face */}
                    <div
                      className="absolute w-24 h-24 rounded-lg"
                      style={{
                        backgroundColor: room.theme_color,
                        transform: 'rotateX(-90deg) translateZ(48px)',
                        opacity: 0.6
                      }}
                    />

                    {/* Left Face */}
                    <div
                      className="absolute w-24 h-24 rounded-lg"
                      style={{
                        backgroundColor: room.theme_color,
                        transform: 'rotateY(-90deg) translateZ(48px)',
                        opacity: 0.7
                      }}
                    />

                    {/* Right Face */}
                    <div
                      className="absolute w-24 h-24 rounded-lg"
                      style={{
                        backgroundColor: room.theme_color,
                        transform: 'rotateY(90deg) translateZ(48px)',
                        opacity: 0.7
                      }}
                    />

                    {/* Progress Ring */}
                    {room.progress.visited && (
                      <div
                        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-20 h-2 bg-black/30 rounded-full overflow-hidden"
                        style={{ transform: 'translateZ(48px) translateX(-50%)' }}
                      >
                        <div
                          className="h-full bg-green-400 transition-all"
                          style={{ width: `${room.progress.completion_percentage}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Center Pedestal */}
            <div
              className="absolute w-32 h-32 -translate-x-16 -translate-y-16"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div
                className="absolute w-32 h-32 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-full flex items-center justify-center"
                style={{ transform: 'rotateX(90deg) translateZ(-20px)' }}
              >
                <span className="text-4xl">📚</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drag Instructions */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-indigo-200 text-sm">
          Drag to rotate • Click a room to explore
        </div>
      </div>

      {/* Room Details Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4"
            style={{ boxShadow: `0 0 50px ${selectedRoom.theme_color}40` }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: selectedRoom.theme_color }}
              >
                {selectedRoom.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedRoom.name}
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  {selectedRoom.description}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Progress</span>
                <span className="text-gray-900 dark:text-white font-bold">
                  {selectedRoom.progress.completion_percentage}%
                </span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${selectedRoom.progress.completion_percentage}%`,
                    backgroundColor: selectedRoom.theme_color
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedRoom.progress.time_spent_minutes}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Minutes Studied</p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: selectedRoom.theme_color }}>
                  {selectedRoom.progress.visited ? '✓' : '○'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedRoom.progress.visited ? 'Visited' : 'Not Visited'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedRoom(null)}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </button>
              <button
                className="flex-1 py-3 rounded-lg text-white font-bold"
                style={{ backgroundColor: selectedRoom.theme_color }}
              >
                Start Learning
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Room Card Component (2D Fallback)
// ============================================================================

export function SubjectRoomCard({ room, onClick }: { room: SubjectRoom; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="relative p-6 rounded-xl cursor-pointer transition-all hover:scale-105 hover:shadow-xl"
      style={{ 
        backgroundColor: room.theme_color,
        boxShadow: `0 10px 30px ${room.theme_color}40`
      }}
    >
      {!room.progress.visited && (
        <div className="absolute top-2 right-2 text-2xl">🔒</div>
      )}
      
      <div className="text-4xl mb-3">{room.icon}</div>
      <h3 className="text-lg font-bold text-white">{room.name}</h3>
      <p className="text-sm text-white/70 mb-4">{room.description}</p>
      
      {/* Progress Bar */}
      <div className="h-2 bg-black/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-white/50 transition-all"
          style={{ width: `${room.progress.completion_percentage}%` }}
        />
      </div>
      <p className="text-xs text-white/70 mt-1 text-right">
        {room.progress.completion_percentage}% complete
      </p>
    </div>
  );
}

// ============================================================================
// Room Grid (2D Alternative)
// ============================================================================

export function SubjectRoomGrid({ onRoomSelect }: SubjectRoomsProps) {
  const [rooms, setRooms] = useState<SubjectRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch('/api/gamification?action=rooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center text-white py-8">Loading...</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {rooms.map(room => (
        <SubjectRoomCard
          key={room.id}
          room={room}
          onClick={() => onRoomSelect?.(room)}
        />
      ))}
    </div>
  );
}
