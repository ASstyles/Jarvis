import React, { useState, useEffect } from 'react';
import { Terminal, Shield, Cpu, Activity, Zap, Play, RotateCcw, Award } from 'lucide-react';

export default function JarvisDashboard() {
  const [logs, setLogs] = useState([
    { id: 1, text: 'JARVIS OS initialized successfully. Memory Matrix active.', type: 'info', time: '10:00:01' },
    { id: 2, text: 'All core subroutines operating at 100% capacity.', type: 'success', time: '10:00:03' },
    { id: 3, text: 'Security guard active. Threat level: Zero.', type: 'secure', time: '10:00:05' }
  ]);
  const [systemLoad, setSystemLoad] = useState(14);
  const [activeTab, setActiveTab] = useState('overview');
  const [commandInput, setCommandInput] = useState('');
  const [reactorState, setReactorState] = useState('STABLE');

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLoad(prev => Math.min(95, Math.max(10, prev + (Math.floor(Math.random() * 9) - 4))));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleCommand = (e) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    const newLog = {
      id: Date.now(),
      text: `> ${commandInput}`,
      type: 'cmd',
      time: new Date().toLocaleTimeString()
    };
    const responseLog = {
      id: Date.now() + 1,
      text: `[JARVIS]: Executing directive "${commandInput}"... Success.`,
      type: 'success',
      time: new Date().toLocaleTimeString()
    };
    setLogs(prev => [newLog, responseLog, ...prev]);
    setCommandInput('');
  };

  const toggleReactor = () => {
    setReactorState(prev => prev === 'STABLE' ? 'OVERCLOCKED' : 'STABLE');
    setLogs(prev => [{
      id: Date.now(),
      text: `ARC Reactor state toggled to ${reactorState === 'STABLE' ? 'OVERCLOCKED' : 'STABLE'}.`,
      type: 'info',
      time: new Date().toLocaleTimeString()
    }, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-cyan-400 font-mono p-6 flex flex-col gap-6 select-none">
      {/* Top Navigation Bar */}
      <header className="flex justify-between items-center border-b border-cyan-500/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-cyan-950/50 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-cyan-200">JARVIS OS</h1>
            <p className="text-xs text-cyan-600">Autonomous Neural Interface v4.2</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-cyan-500/20">
            <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Load: {systemLoad}%</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-cyan-500/20">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Shields: {reactorState}</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        {/* Left Column: Diagnostics & Controls */}
        <div className="bg-slate-900/60 border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold tracking-wide text-cyan-300 uppercase flex items-center gap-2">
            <Zap className="w-4 h-4" /> System Controls
          </h2>
          <div className="flex flex-col gap-3">
            <button 
              onClick={toggleReactor}
              className="w-full py-2.5 px-4 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 rounded text-cyan-200 font-semibold transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" /> Toggle Reactor Power
            </button>
            <button 
              onClick={() => setLogs([{ id: Date.now(), text: 'System logs cleared.', type: 'info', time: new Date().toLocaleTimeString() }])}
              className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 border border-slate-700 rounded text-slate-400 font-semibold transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Purge Cache & Logs
            </button>
          </div>

          <div className="mt-auto border-t border-cyan-500/20 pt-4">
            <div className="text-xs text-cyan-600 mb-1">CORE STATUS</div>
            <div className="w-full bg-slate-950 rounded-full h-2.5 border border-cyan-500/30 overflow-hidden">
              <div className="bg-cyan-400 h-2.5 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" style={{ width: `${systemLoad}%` }}></div>
            </div>
          </div>
        </div>

        {/* Center/Right Column: Terminal & Logs */}
        <div className="md:col-span-2 bg-slate-900/60 border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-4">
          <h2 className="text-sm font-semibold tracking-wide text-cyan-300 uppercase flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Terminal & Neural Stream
          </h2>

          <div className="flex-1 bg-slate-950 border border-cyan-500/20 rounded p-3 overflow-y-auto max-h-[350px] flex flex-col-reverse gap-2 font-mono text-xs">
            {logs.map(log => (
              <div key={log.id} className="flex gap-3 items-start border-l-2 border-cyan-500/40 pl-2">
                <span className="text-cyan-700">{log.time}</span>
                <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'cmd' ? 'text-cyan-200' : 'text-cyan-400'}>
                  {log.text}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleCommand} className="flex gap-2">
            <input 
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Enter command (e.g. 'run diagnostic', 'scan perimeter')..."
              className="flex-1 bg-slate-950 border border-cyan-500/30 rounded px-3 py-2 text-cyan-300 focus:outline-none focus:border-cyan-400 text-sm"
            />
            <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded transition-all text-sm">
              Execute
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
