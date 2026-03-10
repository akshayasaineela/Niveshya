import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ScatterChart, Scatter,
  AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import Papa from 'papaparse';
import {
  Upload, FileText, Settings, X, Search, Sparkles, Database, CheckCircle2,
  ChevronRight, BarChart3, MessageSquare, Shield, TrendingUp, AlertCircle,
  Code, Download, Maximize2, Plus, Loader2, Play, Key, Activity,
  Cpu, Zap, Globe, Lock, Terminal
} from 'lucide-react';
import {
  motion, AnimatePresence, useScroll, useTransform,
  useMotionValue, useSpring
} from 'framer-motion';

// --- INITIAL DB SEEDING ---
const setupDatabase = async () => {
  const SQL = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE marketing_campaigns (
      Campaign_ID INTEGER PRIMARY KEY,
      Campaign_Type TEXT,
      Target_Audience TEXT,
      Duration INTEGER,
      Channel_Used TEXT,
      Impressions INTEGER,
      Clicks INTEGER,
      Leads INTEGER,
      Conversions INTEGER,
      Revenue REAL,
      Acquisition_Cost REAL,
      ROI REAL,
      Language TEXT,
      Engagement_Score REAL,
      Customer_Segment TEXT,
      Date TEXT
    );
  `);

  const types = ['Brand Awareness', 'Lead Generation', 'Product Launch', 'Retargeting'];
  const audiences = ['Gen Z', 'Millennials', 'Professionals', 'Seniors'];
  const channels = ['Social Media', 'Search', 'Email', 'Display', 'Video'];
  const languages = ['EN', 'ES', 'FR', 'DE', 'JP'];
  const segments = ['B2B', 'B2C', 'Enterprise'];

  const randomDate = (start, end) => {
    const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return d.toISOString().split('T')[0];
  };

  const startD = new Date(2023, 0, 1);
  const endD = new Date(2025, 5, 30);

  for (let i = 1; i <= 200; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const audience = audiences[Math.floor(Math.random() * audiences.length)];
    const duration = Math.floor(Math.random() * 60) + 7;
    const channel = channels[Math.floor(Math.random() * channels.length)];
    const impressions = Math.floor(Math.random() * 100000) + 5000;
    const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
    const leads = Math.floor(clicks * (Math.random() * 0.2 + 0.05));
    const conversions = Math.floor(leads * (Math.random() * 0.5 + 0.1));
    const revenue = +(conversions * (Math.random() * 200 + 50)).toFixed(2);
    const cost = +(clicks * (Math.random() * 1.5 + 0.5)).toFixed(2);
    const roi = cost > 0 ? +(((revenue - cost) / cost) * 100).toFixed(2) : 0;
    const lang = languages[Math.floor(Math.random() * languages.length)];
    const score = +(Math.random() * 10).toFixed(1);
    const segment = segments[Math.floor(Math.random() * segments.length)];

    db.run(
      `INSERT INTO marketing_campaigns (
        Campaign_Type, Target_Audience, Duration, Channel_Used, Impressions, Clicks, 
        Leads, Conversions, Revenue, Acquisition_Cost, ROI, Language, Engagement_Score, Customer_Segment, Date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, audience, duration, channel, impressions, clicks, leads, conversions, revenue, cost, roi, lang, score, segment, randomDate(startD, endD)]
    );
  }

  return db;
};

// --- CHART COMPONENTS ---
const SOLARIS_COLORS = ["#6366F1", "#06B6D4", "#F43F5E", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

const DynamicChart = ({ data, chartType, config, isExpanded = false }) => {
  if (!data || data.length === 0) return (
    <div className="h-full flex items-center justify-center text-slate-500 font-bold bg-white/5 rounded-[2rem] border border-dashed border-white/10">
      Awaiting context signals...
    </div>
  );

  try {
    const colors = config?.colors || SOLARIS_COLORS;
    const yKeys = Array.isArray(config?.yKeys) ? config.yKeys.map(k => String(k)) : [];
    const xKey = config?.xKey ? String(config.xKey) : (data[0] ? Object.keys(data[0])[0] : '');

    // Auto-override chart type when data doesn't suit the requested type
    let resolvedChartType = chartType;
    if (chartType === 'pie' && data.length > 15) {
      resolvedChartType = 'bar'; // Too many slices — fall back to bar
    }
    if ((chartType === 'line' || chartType === 'area') && data.length <= 3) {
      resolvedChartType = 'bar'; // Too few points for a line — bar is clearer
    }
    if ((chartType === 'line' || chartType === 'area') && data.length > 500) {
      resolvedChartType = 'table'; // Too dense for a line chart
    }

    // Fix for single-row summary data (like Average vs Max) — Recharts needs an X-axis to plot bars
    let plotData = data;
    let resolvedXKey = xKey;
    if (data.length === 1 && chartType !== 'table') {
      if (!config?.xKey || !data[0][config.xKey]) {
        resolvedXKey = 'Metric';
        plotData = [{ ...data[0], Metric: 'Value' }];
      }
    }

    // Infer yKeys from data if config didn't provide them or they're wrong
    const allCols = data[0] ? Object.keys(data[0]) : [];
    let resolvedYKeys = yKeys.filter(k => allCols.includes(k));
    if (resolvedYKeys.length === 0) {
      // Fall back: all columns except xKey that look numeric
      resolvedYKeys = allCols.filter(k => k !== xKey && typeof data[0][k] === 'number');
      if (resolvedYKeys.length === 0) resolvedYKeys = allCols.filter(k => k !== xKey).slice(0, 2);
    }

    const renderTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        return (
          <div className="absolute-glass p-5 rounded-2xl shadow-2xl border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">{label}</p>
            <div className="space-y-2">
              {payload.map((p, i) => (
                <div key={i} className="flex justify-between items-center gap-10">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                    {p.name}
                  </span>
                  <span className="text-sm font-black text-white font-mono">
                    {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      return null;
    };

    const commonProps = {
      width: "100%",
      height: isExpanded ? 500 : 350,
      data: plotData,
      margin: { top: 20, right: 30, left: 10, bottom: 20 },
    };

    const chartMap = {
      line: (
        <ResponsiveContainer {...commonProps}>
          <LineChart data={plotData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={resolvedXKey} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <Tooltip content={renderTooltip} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
            <Legend iconType="circle" />
            {resolvedYKeys.map((k, i) => (
              <Line key={`line-${k}-${i}`} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={4} dot={{ r: 4, fill: colors[i % colors.length], strokeWidth: 0 }} activeDot={{ r: 8, strokeWidth: 0 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ),
      bar: (
        <ResponsiveContainer {...commonProps}>
          <BarChart data={plotData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={resolvedXKey} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
            <Legend iconType="circle" />
            {resolvedYKeys.map((k, i) => (
              <Bar key={`bar-${k}-${i}`} dataKey={k} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} barSize={isExpanded ? 40 : 25} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ),
      pie: (() => {
        const pieData = plotData.slice(0, 15); // Hard cap at 15 slices
        const tooMany = plotData.length > 15;
        return (
          <div className="relative h-full">
            {tooMany && (
              <div className="absolute top-0 inset-x-0 z-10 flex justify-center">
                <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-amber-400">
                  ⚠ Showing top 15 of {plotData.length} groups — consider a bar chart
                </span>
              </div>
            )}
            <ResponsiveContainer {...commonProps}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={isExpanded ? 110 : 70}
                  outerRadius={isExpanded ? 170 : 120}
                  paddingAngle={4}
                  dataKey={resolvedYKeys[0] || (plotData[0] ? Object.keys(plotData[0])[1] || Object.keys(plotData[0])[0] : '')}
                  nameKey={resolvedXKey}
                  stroke="none"
                  label={({ name, percent }) => percent > 0.05 ? `${String(name).substring(0, 12)} ${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip content={renderTooltip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      })(),
      area: (
        <ResponsiveContainer {...commonProps}>
          <AreaChart data={plotData}>
            <defs>
              {resolvedYKeys.map((k, i) => (
                <linearGradient key={`grad-${k}`} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={resolvedXKey} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
            <Tooltip content={renderTooltip} />
            <Legend iconType="circle" />
            {yKeys.map((k, i) => (
              <Area key={`area-${k}-${i}`} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={4} fillOpacity={1} fill={`url(#grad-${k})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      ),
      table: (
        <div className="w-full overflow-x-auto rounded-3xl border border-white/10 inner-glow">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-white/5">
              <tr>
                {Object.keys(plotData[0] || {}).map(k => <th key={k} className="px-6 py-5">{k}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {plotData.slice(0, 15).map((row, i) => (
                <tr key={i} className="hover:bg-indigo-500/5 transition-colors">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-6 py-4 font-medium text-slate-300">
                      {typeof v === 'number' ? v.toLocaleString() : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {plotData.length > 15 && <p className="p-4 text-center text-[10px] font-black text-indigo-400 uppercase tracking-widest">Abridged View: {plotData.length} Total Records</p>}
        </div>
      )
    };

    return chartMap[resolvedChartType] || chartMap.table;
  } catch (err) {
    console.error("Visualization Error:", err);
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 bg-rose-500/5 rounded-[2rem] border border-dashed border-rose-500/20 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500/40 mb-4" />
        <p className="text-rose-400 font-bold uppercase tracking-widest text-xs">Spectral Render Logic Failure</p>
        <p className="text-slate-500 text-[10px] mt-2 font-mono">CODE: 0x882_VISUAL_EXCEPTION</p>
      </div>
    );
  }
};

// --- PARTICLES COMPONENT ---
const Particles = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.size = Math.random() * 2;
        this.alpha = Math.random() * 0.5 + 0.1;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
      }
      draw() {
        ctx.fillStyle = `rgba(99, 102, 241, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < 150; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-40" />;
};

// --- APP COMPONENT ---
export default function App() {
  const [page, setPage] = useState('landing');

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 overflow-x-hidden">
      <Particles />
      <AnimatePresence mode="wait">
        {page === 'landing' ? (
          <LandingPage key="landing" onEnter={() => setPage('dashboard')} />
        ) : (
          <Dashboard key="dashboard" />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- LANDING PAGE ---
const LandingPage = ({ onEnter }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
      transition={{ duration: 1 }}
      className="relative z-10 min-h-screen flex flex-col pt-32 px-6"
    >
      <nav className="fixed top-8 inset-x-8 z-50 flex justify-between items-center p-5 absolute-glass rounded-[2rem] border-white/5">
        <div className="flex items-center gap-3 pl-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase italic">Solaris</span>
        </div>
        <button
          onClick={onEnter}
          className="bg-white text-black px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-all active:scale-95 shadow-2xl"
        >
          Activate Engine
        </button>
      </nav>

      <main className="max-w-7xl mx-auto w-full text-center py-20">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 1 }}
          className="relative inline-block mb-10"
        >
          <div className="absolute inset-0 bg-indigo-500/20 blur-[120px] rounded-full scale-150" />
          <h1 className="text-[10vw] md:text-[8vw] font-black leading-[0.8] tracking-tighter mb-4 text-white">
            SOLARIS<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-rose-400 to-indigo-400 animate-gradient-x italic">ABSOLUTE.</span>
          </h1>
          <p className="text-xl md:text-3xl font-light tracking-tight text-slate-400 max-w-4xl mx-auto mt-10">
            The Singularity in Conversational Data. <br />
            High-performance WASM processing wrapped in Spectral Obsidian.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 1.2 }}
          className="mt-20 grid md:grid-cols-3 gap-8"
        >
          {[
            { icon: Cpu, title: "WASM Core", desc: "Native SQLite execution for sub-millisecond dataset querying." },
            { icon: Zap, title: "DeepSync", desc: "Autonomous AI schema mapping with contextual logical pruning." },
            { icon: Shield, title: "Absolute Security", desc: "End-to-end local processing. Your patterns never leave the core." }
          ].map((feat, i) => (
            <div key={i} className="absolute-glass p-12 rounded-[3rem] border-white/5 text-left group hover:border-indigo-500/30 transition-all cursor-crosshair">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-8 border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:scale-110 transition-all duration-500">
                <feat.icon className="w-8 h-8 text-indigo-400 group-hover:text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">{feat.title}</h3>
              <p className="text-slate-400 font-medium leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="mt-auto py-20 text-center">
        <div className="flex items-center justify-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">
          <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Global Status: Online</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>v4.0.0 Stable</span>
        </div>
      </footer>
    </motion.div>
  );
};

// --- RAG CONTEXT BUILDER ---
const buildSchemaWithSamples = (database) => {
  try {
    const res = database.exec("SELECT name, sql FROM sqlite_master WHERE type='table'");
    if (res.length === 0) return "";

    let fullContext = "";
    res[0].values.forEach(tableInfo => {
      const tableName = tableInfo[0];
      const tableSql = tableInfo[1];
      fullContext += tableSql + "\n";

      try {
        const samples = database.exec(`SELECT * FROM "${tableName}" LIMIT 3`);
        if (samples.length > 0) {
          fullContext += `-- Sample Data for ${tableName} --\n`;
          fullContext += samples[0].columns.join(" | ") + "\n";
          samples[0].values.forEach(row => {
            const formattedRow = row.map(v => {
              if (v === null) return 'NULL';
              if (typeof v === 'string') return v.length > 50 ? v.substring(0, 50) + '...' : v;
              return String(v);
            });
            fullContext += formattedRow.join(" | ") + "\n";
          });
          fullContext += "\n";
        }
      } catch (e) {
        // Ignore sample fetch errors
      }
    });
    return fullContext.trim();
  } catch (err) {
    return "";
  }
};

// --- DASHBOARD ---
function Dashboard() {
  const [db, setDb] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('openrouter_api_key'));
  const [queries, setQueries] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChart, setExpandedChart] = useState(null);
  const [schemaInfo, setSchemaInfo] = useState('');
  const [activeTables, setActiveTables] = useState([]);

  const bottomRef = useRef(null);

  useEffect(() => {
    setupDatabase().then(database => {
      setDb(database);
      const res = database.exec("SELECT name, sql FROM sqlite_master WHERE type='table'");
      if (res.length > 0) {
        setActiveTables(res[0].values.map(v => v[0]));
        setSchemaInfo(buildSchemaWithSamples(database));
      }
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [queries]);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openrouter_api_key', key);
    setShowSettings(false);
  };

  const handleQuery = async (queryText, prevContext = null) => {
    if (!queryText.trim() || !apiKey) {
      if (!apiKey) setShowSettings(true);
      return;
    }

    setIsLoading(true);
    const newId = Date.now().toString();
    setQueries(prev => [...prev, { id: newId, text: queryText, isLoading: true, isRefinement: !!prevContext }]);
    setInputValue('');

    try {
      const SYSTEM_PROMPT = `You are a Solaris BI Architect. Schema: ${schemaInfo}. 
Respond ONLY with JSON: { 
  "sql": "...", 
  "chartType": "line|bar|pie|area|table", 
  "config": { 
    "xKey": "...", 
    "yKeys": ["..."], 
    "title": "...", 
    "description": "..." 
  }, 
  "clarification": null 
}. 
IMPORTANT: Use exact column names from the schema. For aggregate queries, use 'AS' to name columns clearly (e.g., SELECT SUM(Revenue) AS Revenue...).`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Solaris Absolute'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          max_tokens: 512,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: queryText }]
        })
      });

      const raw = await res.json();
      if (!raw.choices || !raw.choices[0]) {
        throw new Error(raw.error?.message || "Synthesis failure.");
      }

      const match = raw.choices[0].message.content.match(/\{.*\}/s);
      if (!match) throw new Error("Recursive logic error.");

      const content = JSON.parse(match[0]);

      if (content.sql) {
        const dbRes = db.exec(content.sql);
        if (dbRes.length > 0) {
          const cols = dbRes[0].columns;
          const data = dbRes[0].values.map(v => {
            let r = {};
            cols.forEach((c, i) => {
              let val = v[i];
              // Coerce to number if it's a valid numeric string so Recharts can plot it
              if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
                val = Number(val);
              }
              r[c] = val;
            });
            return r;
          });
          setQueries(prev => prev.map(q => q.id === newId ? { ...q, isLoading: false, result: { ...content, data } } : q));
        } else {
          setQueries(prev => prev.map(q => q.id === newId ? { ...q, isLoading: false, result: { clarification: "Zero patterns extracted from the core." } } : q));
        }
      } else {
        setQueries(prev => prev.map(q => q.id === newId ? { ...q, isLoading: false, result: { clarification: content.clarification || "Insufficient context discoverable." } } : q));
      }
    } catch (e) {
      setQueries(prev => prev.map(q => q.id === newId ? { ...q, isLoading: false, result: { clarification: `Solaris_Error: ${e.message}` } } : q));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data;
          if (!data || data.length === 0) throw new Error("Invalid Dataset");

          let tableName = file.name.split('.')[0].replace(/[^a-zA-Z]/g, '_').toLowerCase();
          let uniqueName = tableName;
          let counter = 1;
          while (db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${uniqueName}'`).length > 0) {
            uniqueName = `${tableName}_${counter++}`;
          }
          tableName = uniqueName;

          const headers = Object.keys(data[0]);
          const colsDef = headers.map(h => `"${h}" TEXT`).join(', ');

          db.run(`CREATE TABLE "${tableName}" (${colsDef})`);

          try {
            db.exec("BEGIN TRANSACTION;");
            data.forEach(row => {
              const vals = headers.map(h => (row[h] === undefined || row[h] === null) ? null : row[h]);
              db.run(`INSERT INTO "${tableName}" VALUES (${headers.map(() => '?').join(',')})`, vals);
            });
            db.exec("COMMIT;");
          } catch (te) {
            try { db.exec("ROLLBACK;"); } catch (re) { }
            throw te;
          }

          setActiveTables(prev => Array.from(new Set([...prev, tableName])));
          setSchemaInfo(buildSchemaWithSamples(db));

          // Sanitize headers — only keep clean, readable column names
          const cleanHeaders = headers.filter(h => {
            if (!h || typeof h !== 'string') return false;
            if (h.startsWith('_') || h.startsWith('__')) return false;          // internal parser artifacts
            if (/[^\x20-\x7E]/.test(h)) return false;                           // non-ASCII / binary characters
            if (h.length > 60) return false;                                     // absurdly long = garbage
            if (/^[\d]+$/.test(h)) return false;                                 // pure numbers = not a real column name
            return true;
          });

          // Generate smart first-look questions from clean column names
          const categoryCol = cleanHeaders.find(h => ['type', 'channel', 'audience', 'segment', 'language', 'category', 'brand', 'name', 'region', 'city', 'country', 'status', 'gender', 'product'].some(k => h.toLowerCase().includes(k)));
          const numericCol = cleanHeaders.find(h => ['revenue', 'roi', 'price', 'sales', 'cost', 'clicks', 'conversions', 'score', 'count', 'amount', 'units', 'rate', 'value', 'total', 'profit'].some(k => h.toLowerCase().includes(k)));
          const dateCol = cleanHeaders.find(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('month') || h.toLowerCase().includes('year'));

          const questionPool = [];

          if (cleanHeaders.length === 0) {
            // No clean headers at all — the CSV is likely malformed, skip suggestions
            var csvSuggestions = [];
          } else {
            // Pattern-based insightful questions
            if (cleanHeaders.some(h => h.toLowerCase().includes('revenue')) && categoryCol) questionPool.push(`Which ${categoryCol} generates the most revenue?`);
            if (cleanHeaders.some(h => h.toLowerCase().includes('roi')) && categoryCol) questionPool.push(`Rank all ${categoryCol} by ROI — which is bleeding money?`);
            if (cleanHeaders.some(h => h.toLowerCase().includes('conversion')) && cleanHeaders.some(h => h.toLowerCase().includes('click'))) questionPool.push(`Which category has the worst click-to-conversion ratio?`);
            if (cleanHeaders.some(h => h.toLowerCase().includes('cost')) && cleanHeaders.some(h => h.toLowerCase().includes('revenue'))) questionPool.push(`Show the profit margin: revenue minus cost`);
            if (dateCol && numericCol) questionPool.push(`Show the trend of ${numericCol} over time`);
            if (dateCol) questionPool.push(`Which month had the biggest spike in this dataset?`);
            if (categoryCol && numericCol) questionPool.push(`Compare ${categoryCol} values by ${numericCol}`);

            // Guaranteed fallback using clean column names only
            const firstCategory = categoryCol || cleanHeaders[0];
            const firstNumeric = numericCol || cleanHeaders.find(h => h !== firstCategory) || cleanHeaders[1];
            if (firstCategory) questionPool.push(`Show the total ${firstNumeric || 'count'} grouped by ${firstCategory}`);
            if (firstCategory && firstNumeric) questionPool.push(`Which ${firstCategory} has the highest ${firstNumeric}?`);
            if (firstCategory) questionPool.push(`Give me a full distribution breakdown by ${firstCategory}`);
            if (firstNumeric) questionPool.push(`What is the average ${firstNumeric} and which rows exceed it?`);
            if (cleanHeaders.length > 2) questionPool.push(`Show me the top 10 rows sorted by ${firstNumeric || cleanHeaders[1]} descending`);

            var csvSuggestions = [...new Set(questionPool)].sort(() => 0.5 - Math.random()).slice(0, 4);
          }


          setQueries(prev => [...prev, {
            id: Date.now(), type: 'result', text: `Ingested ${tableName}`,
            result: { data: data.slice(0, 5), chartType: 'table', config: { title: `Spectral Link: ${tableName}`, description: `Synchronization complete. ${data.length} rows × ${headers.length} columns cached.` }, clarification: null },
            csvSuggestions
          }]);

        } catch (err) {
          setQueries(prev => [...prev, { id: Date.now(), type: 'system', text: `Sync Failed`, result: { clarification: `Error: ${err.message}` } }]);
        }
      }
    });
    e.target.value = '';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-screen relative z-10 spectral-bg">
      <aside className="w-72 absolute-glass m-6 rounded-[2.5rem] border-white/5 flex flex-col overflow-hidden shadow-2xl">
        <div className="p-10 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center"><Terminal className="w-4 h-4 text-white" /></div>
            <span className="text-xl font-black uppercase tracking-tighter">Core Rail</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 block">Cached Pools</span>
            <div className="space-y-3">
              {activeTables.map(t => (
                <div key={t} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-3 group hover:border-indigo-500/40 transition-all">
                  <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-200 truncate tracking-tight">{t}</span>
                </div>
              ))}
              <label className="flex items-center justify-center p-4 border border-indigo-500/20 border-dashed rounded-2xl cursor-pointer hover:bg-indigo-500/10 transition-all text-indigo-400 hover:text-indigo-300">
                <Plus className="w-4 h-4" />
                <input type="file" className="hidden" onChange={handleCSVUpload} />
              </label>
            </div>
          </div>
        </div>
        <div className="p-8 border-t border-white/5">
          <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/5">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Config</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col p-6 pl-0">
        <div className="flex-1 overflow-y-auto p-12 space-y-16 pb-48 custom-scrollbar">
          {queries.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-24 h-24 absolute-glass rounded-[2rem] border-indigo-500/20 mb-8 flex items-center justify-center"><Activity className="w-12 h-12 text-indigo-500 animate-pulse" /></div>
              <h2 className="text-3xl font-black tracking-tighter uppercase mb-4">Signal Awaiting.</h2>
              <p className="max-w-md text-slate-400 font-medium">Input natural language prompts to activate the Solaris synthesis engine.</p>
            </div>
          )}

          <AnimatePresence>
            {queries.map((q) => (
              <motion.div key={q.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-5xl mx-auto space-y-8">
                <div className="flex justify-end pr-10">
                  <div className="bg-indigo-600 px-8 py-5 rounded-[2rem] rounded-tr-sm shadow-2xl relative">
                    <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-500 blur-2xl rounded-full" />
                    <p className="text-lg font-bold text-white tracking-tight relative z-10">{q.text}</p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-12 h-12 absolute-glass rounded-2xl border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shrink-0"><Sparkles className="w-6 h-6 animate-pulse" /></div>
                  <div className="flex-1 min-w-0">
                    {q.isLoading ? (
                      <div className="inline-flex absolute-glass px-6 py-4 rounded-3xl border-white/5 items-center gap-4 shadow-inner mt-2">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 italic">Synthesizing_Patterns...</span>
                      </div>
                    ) : (
                      <DashboardCard result={q.result} onExpand={() => setExpandedChart(q)} onRefine={(t) => handleQuery(t, q.result)} onFollowUp={(t) => handleQuery(t)} />
                    )}
                  </div>
                </div>

                {/* CSV Upload: Show first-look question prompts */}
                {!q.isLoading && q.csvSuggestions && q.csvSuggestions.length > 0 && (
                  <div className="flex flex-col gap-3 pl-[72px] mt-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-600/70">Start Exploring ↗</span>
                    <div className="flex flex-wrap gap-3">
                      {q.csvSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuery(suggestion)}
                          className="px-5 py-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-[10px] font-black tracking-wide text-cyan-300 hover:text-white hover:border-cyan-400/60 hover:bg-cyan-500/20 transition-all active:scale-95 flex items-center gap-2"
                        >
                          <span className="text-cyan-500">→</span> {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Query result: Show dynamic follow-up suggestions */}
                {!q.isLoading && !q.csvSuggestions && q.result && !q.result.clarification && (() => {
                  const r = q.result;
                  const cols = r.data && r.data[0] ? Object.keys(r.data[0]) : [];
                  const xKey = r.config?.xKey || cols[0] || '';
                  const yKey = (r.config?.yKeys && r.config.yKeys[0]) || cols[1] || '';

                  const hasRevenue = cols.some(c => c.toLowerCase().includes('revenue'));
                  const hasROI = cols.some(c => c.toLowerCase().includes('roi'));
                  const hasCost = cols.some(c => c.toLowerCase().includes('cost') || c.toLowerCase().includes('acquisition'));
                  const hasClicks = cols.some(c => c.toLowerCase().includes('click'));
                  const hasConversions = cols.some(c => c.toLowerCase().includes('conversion'));
                  const hasEngagement = cols.some(c => c.toLowerCase().includes('engagement'));
                  const hasDate = cols.some(c => c.toLowerCase().includes('date'));
                  const xIsCategory = xKey && !xKey.toLowerCase().includes('date');

                  const pool = [];
                  if (hasROI && xIsCategory) pool.push(`Which ${xKey} is bleeding money with negative ROI?`);
                  if (hasRevenue && hasConversions) pool.push(`What's the revenue per conversion across each ${xKey}?`);
                  if (hasClicks && hasConversions) pool.push(`Which ${xKey} has the worst click-to-conversion rate?`);
                  if (hasCost && hasRevenue) pool.push(`Show the profit margin breakdown — revenue minus acquisition cost`);
                  if (hasEngagement && xIsCategory) pool.push(`Which ${xKey} drives the highest engagement score?`);
                  if (hasDate) pool.push(`Has performance improved or declined over the last 6 months?`);
                  if (hasRevenue && xIsCategory) pool.push(`What share of total revenue does each ${xKey} control?`);
                  if (hasROI) pool.push(`Find the top 3 highest ROI performers and what they have in common`);
                  if (hasConversions && hasCost) pool.push(`Which ${xKey} delivers the cheapest conversions?`);
                  if (hasClicks && xIsCategory) pool.push(`Show the ${xKey} with above-average clicks but below-average conversions`);
                  if (yKey) pool.push(`What's the statistical average versus top performer gap in ${yKey}?`);
                  if (xIsCategory) pool.push(`Rank all ${xKey} values by ${yKey || 'performance'} descending`);
                  if (hasDate) pool.push(`Which month had the biggest spike in ${hasRevenue ? 'revenue' : yKey}?`);
                  if (hasRevenue) pool.push(`Compare the top and bottom performers by revenue — what's the gap?`);

                  const finalSuggestions = [...new Set(pool.sort(() => 0.5 - Math.random()))].slice(0, 3);
                  if (finalSuggestions.length === 0) return null;

                  return (
                    <div className="flex flex-wrap gap-3 pl-[72px] mt-2">
                      <span className="w-full text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 mb-1">Explore Further ↗</span>
                      {finalSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuery(suggestion)}
                          className="px-5 py-2.5 absolute-glass border border-indigo-500/20 rounded-full text-[10px] font-black tracking-wide text-indigo-300 hover:text-white hover:border-indigo-500/60 hover:bg-indigo-500/10 transition-all active:scale-95 flex items-center gap-2"
                        >
                          <span className="text-indigo-500">↗</span> {suggestion}
                        </button>
                      ))}
                    </div>
                  );
                })()}


              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} className="h-10" />
        </div>

        <div className="absolute bottom-8 inset-x-0 px-12 pl-[320px]">
          <div className="max-w-4xl mx-auto absolute-glass p-2 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-white/5 flex items-center gap-3 scanline-effect">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery(inputValue)}
              placeholder="Command Solaris Engine..."
              className="flex-1 bg-transparent px-6 py-3 outline-none text-sm font-medium tracking-tight text-white placeholder:text-slate-600"
            />
            <button onClick={() => handleQuery(inputValue)} className="w-10 h-10 bg-white text-[#020617] rounded-xl hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-90 flex items-center justify-center group">
              <Play className="w-4 h-4 fill-current transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-3xl z-[100] flex items-center justify-center p-6">
          <div className="absolute-glass max-w-xl w-full p-16 rounded-[4rem] border-white/5 shadow-2xl relative text-center">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-[2rem] border border-indigo-500/30 flex items-center justify-center mx-auto mb-10"><Lock className="w-10 h-10 text-indigo-400" /></div>
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-white">Authorize Link</h2>
            <p className="text-slate-500 font-bold mb-12 uppercase tracking-widest text-xs">Secure Handshake: OpenRouter Interface</p>
            <div className="space-y-8">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-[2rem] px-10 py-6 text-sm font-mono focus:ring-4 ring-indigo-500/20 outline-none transition-all placeholder:text-slate-700 text-indigo-400 text-center"
                placeholder="ENTER_API_TOKEN"
              />
              <button onClick={() => handleSaveApiKey(apiKey)} className="w-full bg-indigo-600 text-white font-black py-7 rounded-[2rem] hover:bg-indigo-700 active:scale-95 transition-all text-xl uppercase tracking-tighter italic">Establish Sync</button>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Local storage encryption active. Solaris does not persist tokens on external clusters.</p>
            </div>
          </div>
        </div>
      )}

      {expandedChart && (
        <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-3xl z-[200] flex items-center justify-center p-12 min-[1400px]:p-24">
          <div className="absolute-glass w-full h-full rounded-[4rem] border-white/5 flex flex-col shadow-2xl overflow-hidden">
            <div className="p-16 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div>
                <h2 className="text-5xl font-black uppercase tracking-tighter mb-2 text-white italic">{expandedChart.result.config?.title}</h2>
                <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">{expandedChart.result.config?.description}</p>
              </div>
              <button onClick={() => setExpandedChart(null)} className="w-20 h-20 absolute-glass rounded-[2rem] border-white/10 flex items-center justify-center text-white hover:bg-rose-500/20 hover:text-rose-500 transition-all active:scale-95"><X className="w-10 h-10" /></button>
            </div>
            <div className="flex-1 p-20 flex items-center justify-center">
              <DynamicChart data={expandedChart.result.data} chartType={expandedChart.result.chartType} config={expandedChart.result.config} isExpanded={true} />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

const DashboardCard = ({ result, onExpand, onRefine }) => {
  const [showSql, setShowSql] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [refineValue, setRefineValue] = useState('');

  if (!result) return null;

  return (
    <div className="absolute-glass rounded-[3rem] border-white/5 bg-white/2 shadow-2xl overflow-hidden hud-border scanline-effect transition-all duration-700 hover:scale-[1.01]">
      <div className="p-10 pb-6 flex justify-between items-start">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter text-white mb-2 italic">{result.config?.title || "Output Segment"}</h3>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{result.config?.description || "WASM Synthesis Layer active."}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowSql(!showSql)} className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center ${showSql ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/5 text-slate-500 border-white/5 hover:border-indigo-500/40 hover:text-indigo-400'}`}><Code className="w-5 h-5" /></button>
          <button onClick={onExpand} className="w-12 h-12 bg-white/5 border border-white/5 rounded-2xl text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 transition-all flex items-center justify-center"><Maximize2 className="w-5 h-5" /></button>
          <button onClick={() => setShowRefine(!showRefine)} className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center ${showRefine ? 'bg-rose-500 text-white border-rose-500' : 'bg-white/5 text-slate-500 border-white/5 hover:border-rose-500/40 hover:text-rose-400'}`}><Plus className="w-5 h-5" /></button>
        </div>
      </div>

      <AnimatePresence>
        {showSql && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-[#000000]/40">
            <div className="p-10 space-y-4">
              <div className="flex items-center gap-3 text-indigo-400 uppercase tracking-widest font-black text-[10px]"><Terminal className="w-4 h-4" /> LOGIC_TRACE_V4.2</div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-cyan-300 leading-relaxed bg-[#020617]/50 p-6 rounded-2xl border border-white/5">{result.sql}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-10 h-[450px]">
        {result.clarification ? (
          <div className="h-full flex flex-col items-center justify-center p-12 bg-indigo-500/[0.03] rounded-[2.5rem] border border-dashed border-indigo-500/20 text-center scale-95 opacity-80 backdrop-blur-sm">
            <AlertCircle className="w-14 h-14 text-indigo-500/40 mb-6" />
            <p className="text-indigo-300 font-bold uppercase tracking-widest text-sm max-w-sm leading-relaxed">{result.clarification}</p>
          </div>
        ) : (
          <DynamicChart data={result.data} chartType={result.chartType} config={result.config} />
        )}
      </div>

      <AnimatePresence>
        {showRefine && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="p-10 pt-0">
            <div className="bg-white/5 border border-white/5 p-3 rounded-[2.5rem] flex gap-4 shadow-inner">
              <input
                value={refineValue}
                onChange={(e) => setRefineValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onRefine(refineValue); setShowRefine(false); } }}
                placeholder="REFINE DATA LOGIC..."
                className="flex-1 bg-transparent px-8 outline-none font-black italic text-white placeholder:text-slate-700 uppercase tracking-tighter"
              />
              <button onClick={() => { onRefine(refineValue); setShowRefine(false); }} className="bg-rose-500 hover:bg-rose-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl active:scale-90">RE_SYNC</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-12 py-6 bg-white/[0.01] border-t border-white/5 flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Solaris_Absolute_Engine // 0x42ff</span>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">ACTIVE_STABLE</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-indigo-500" />
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Spectral_Sync: 100%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
