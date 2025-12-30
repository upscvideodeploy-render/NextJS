'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [examDate, setExamDate] = useState('');
  const [targetHours, setTargetHours] = useState(6);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    const res = await fetch('/api/schedule/me');
    const data = await res.json();
    setSchedule(data.schedule);
    setTasks(data.tasks || []);
    setLoading(false);
  };

  const generateSchedule = async () => {
    setGenerating(true);
    const res = await fetch('/api/schedule/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_date: examDate,
        target_hours_per_day: targetHours,
      }),
    });

    if (res.ok) {
      await fetchSchedule();
    }
    setGenerating(false);
  };

  const toggleTask = async (taskId: string, isCompleted: boolean) => {
    await fetch(`/api/schedule/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !isCompleted }),
    });
    fetchSchedule();
  };

  const exportSchedule = () => {
    window.open('/api/schedule/export', '_blank');
  };

  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.task_date]) acc[task.task_date] = [];
    acc[task.task_date].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">AI Study Schedule Builder</h1>

      {!schedule ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create Your Study Schedule</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Exam Date</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Target Study Hours Per Day: {targetHours}h
              </label>
              <input
                type="range"
                min="2"
                max="12"
                step="0.5"
                value={targetHours}
                onChange={(e) => setTargetHours(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              onClick={generateSchedule}
              disabled={!examDate || generating}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {generating ? 'Generating...' : 'Generate AI Schedule'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Your Study Schedule</h2>
                <p className="text-gray-600">
                  Exam Date: {new Date(schedule.exam_date).toLocaleDateString()} | 
                  Target: {schedule.target_hours_per_day}h/day
                </p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={exportSchedule}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Export to Calendar
                </button>
                <button
                  onClick={() => setSchedule(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(groupedTasks).map(([date, dateTasks]) => (
              <div key={date} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                <div className="space-y-3">
                  {(dateTasks as any[]).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start space-x-3 p-3 border rounded hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={task.is_completed}
                        onChange={() => toggleTask(task.id, task.is_completed)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            task.task_type === 'study' ? 'bg-blue-100 text-blue-800' :
                            task.task_type === 'revision' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {task.task_type.toUpperCase()}
                          </span>
                          <span className="font-medium">{task.topic}</span>
                          <span className="text-sm text-gray-500">
                            ({task.duration_minutes} min)
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
