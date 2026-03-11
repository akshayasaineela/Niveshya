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
  Cpu, Zap, Globe, Lock, Terminal, Moon, Sun, User, LayoutDashboard, History, Lightbulb
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
    <div className="h-full flex items-center justify-center text-[var(--text-muted)] font-medium bg-[var(--bg-secondary)] rounded-2xl border border-dashed border-[var(--border-color)]">
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
          <div className="enterprise-card p-4 rounded-xl shadow-[var(--shadow-elevated)] relative overflow-hidden z-50">
            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent-indigo)]"></div>
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 border-b border-[var(--border-color)] pb-2">{label}</p>
            <div className="space-y-2">
              {payload.map((p, i) => (
                <div key={i} className="flex justify-between items-center gap-8">
                  <span className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                    {p.name}
                  </span>
                  <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey={resolvedXKey} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
            <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--border-color)', strokeWidth: 2 }} />
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey={resolvedXKey} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--bg-tertiary)' }} />
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
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis dataKey={resolvedXKey} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-color)' }} />
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
  const [theme, setTheme] = useState(localStorage.getItem('solaris_theme') || 'light');

  useEffect(() => {
    localStorage.setItem('solaris_theme', theme);
  }, [theme]);

  return (
    <div className={`min-h-screen ${theme} bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden font-sans transition-colors duration-300`}>
      <AnimatePresence mode="wait">
        {page === 'landing' ? (
          <LandingPage key="landing" onEnter={() => setPage('dashboard')} theme={theme} setTheme={setTheme} />
        ) : (
          <Dashboard key="dashboard" theme={theme} setTheme={setTheme} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- LANDING PAGE ---
const LandingPage = ({ onEnter, theme, setTheme }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
      transition={{ duration: 0.8 }}
      className="relative z-10 min-h-screen flex flex-col pt-24 px-8"
    >
      <nav className="fixed top-6 inset-x-8 z-50 flex justify-between items-center px-8 py-4 enterprise-glass rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--accent-indigo)] rounded-xl flex items-center justify-center shadow-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-[var(--text-primary)] leading-none">SOLARIS</span>
            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Conversational BI</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-3 rounded-xl hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={onEnter}
            className="bg-[var(--accent-indigo)] text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-[var(--accent-indigo-hover)] transition-all shadow-sm"
          >
            Launch Workspace
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto w-full text-center py-32 flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mb-16"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[var(--text-primary)] mb-6">
            Enterprise Intelligence,<br />
            <span className="text-[var(--accent-indigo)]">Powered by AI.</span>
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
            Generate data insights, interactive dashboards, and actionable narratives by simply asking questions in natural language.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {[
            { icon: Database, title: "Seamless Integration", desc: "Instantly connect to your CSV datasets and analyze them locally." },
            { icon: Sparkles, title: "Natural Language", desc: "No SQL required. Ask complex analytical questions in plain English." },
            { icon: LayoutDashboard, title: "Dynamic Dashboards", desc: "Watch insights materialize into interactive, exportable charts." }
          ].map((feat, i) => (
            <div key={i} className="enterprise-card p-8 text-left hover:border-[var(--accent-indigo)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center mb-6 text-[var(--accent-indigo)]">
                <feat.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{feat.title}</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>
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
function Dashboard({ theme, setTheme }) {
  const [db, setDb] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_api_key') || '');
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('openrouter_api_key'));
  const [queries, setQueries] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChart, setExpandedChart] = useState(null);
  const [schemaInfo, setSchemaInfo] = useState('');
  const [activeTables, setActiveTables] = useState([]);
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'data-sources' | 'history' | 'insights'

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

            const askedQuestions = new Set(queries.map(q => q.text));
            var csvSuggestions = [...new Set(questionPool.filter(q => !askedQuestions.has(q)))].sort(() => 0.5 - Math.random()).slice(0, 4);
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-primary)] px-6 flex items-center justify-between shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--accent-indigo)] rounded-lg flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-[var(--text-primary)] leading-none">SOLARIS</span>
              <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Conversational BI</span>
            </div>
          </div>

          {/* Dataset Selector */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md">
            <Database className="w-4 h-4 text-[var(--text-secondary)]" />
            <select className="bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none border-none focus:ring-0 cursor-pointer w-32 truncate">
              {activeTables.map(t => <option key={t} value={t}>{t}</option>)}
              {activeTables.length === 0 && <option value="">No Data Sources</option>}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer">
            <User className="w-4 h-4" />
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col hidden md:flex shrink-0">
          <div className="p-4 space-y-1">
            <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${activeView === 'dashboard' ? 'bg-[var(--accent-indigo)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button onClick={() => setActiveView('data-sources')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${activeView === 'data-sources' ? 'bg-[var(--accent-indigo)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <Database className="w-4 h-4" /> Data Sources
            </button>
            <button onClick={() => setActiveView('history')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${activeView === 'history' ? 'bg-[var(--accent-indigo)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <History className="w-4 h-4" /> Query History
            </button>
            <button onClick={() => setActiveView('insights')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${activeView === 'insights' ? 'bg-[var(--accent-indigo)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <Lightbulb className="w-4 h-4" /> Insights
            </button>
          </div>
          <div className="mt-auto p-4 border-t border-[var(--border-color)] space-y-4">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-4 shadow-sm text-center">
              <p className="text-xs text-[var(--text-secondary)] font-medium mb-3">Add Dataset</p>
              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)] border-dashed rounded-md cursor-pointer transition-all text-[var(--text-primary)] text-sm">
                <Upload className="w-4 h-4" /> Upload CSV
                <input type="file" className="hidden" onChange={handleCSVUpload} />
              </label>
            </div>

            <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-3 px-4 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] rounded-lg font-medium text-sm transition-all">
              <Settings className="w-4 h-4" /> Settings
            </button>
          </div>
        </aside>

        {/* Main Interface */}
        <main className="flex-1 flex flex-col relative bg-[var(--bg-primary)] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-12 pb-32 custom-scrollbar">

            {activeView === 'data-sources' && (
              <div className="max-w-5xl mx-auto animation-fade-in">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">Data Sources</h2>
                  <p className="text-[var(--text-secondary)]">Manage your connected SQLite/CSV datasets.</p>
                </div>

                {activeTables.length === 0 ? (
                  <div className="enterprise-card p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4"><Database className="w-8 h-8 text-[var(--text-muted)]" /></div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Datasets Connected</h3>
                    <p className="text-[var(--text-secondary)] text-sm mb-6 max-w-sm">Upload a CSV file from the sidebar to create an in-memory SQLite database and start querying.</p>
                    <label className="bg-[var(--accent-indigo)] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[var(--accent-indigo-hover)] transition-colors cursor-pointer inline-flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Upload CSV
                      <input type="file" className="hidden" onChange={(e) => { handleCSVUpload(e); setActiveView('dashboard'); }} />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {activeTables.map(tableName => (
                      <div key={tableName} className="enterprise-card overflow-hidden">
                        <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[var(--accent-indigo)]/10 rounded-lg flex items-center justify-center text-[var(--accent-indigo)]"><Database className="w-5 h-5" /></div>
                            <div>
                              <h3 className="font-semibold text-[var(--text-primary)]">{tableName}</h3>
                              <p className="text-xs text-[var(--text-secondary)]">SQLite Local Table</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Connected</span>
                        </div>
                        <div className="p-6 bg-[var(--bg-primary)]">
                          <p className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider text-xs">Detected Schema Columns</p>
                          <div className="flex flex-wrap gap-2">
                            {/* We deduce columns from the schemaInfo string for this table specifically */}
                            {schemaInfo.split('-- Sample Data for').find(s => s.trim().startsWith(tableName))?.split('\n')[1]?.split('|').map((col, i) => (
                              <span key={i} className="px-3 py-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-md text-xs text-[var(--text-primary)] font-mono">{col.trim()}</span>
                            )) || <span className="text-sm text-[var(--text-muted)]">Schema details unavailable in preview.</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeView === 'history' && (
              <div className="max-w-5xl mx-auto animation-fade-in">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">Query History</h2>
                  <p className="text-[var(--text-secondary)]">Review and re-run past logic syntheses.</p>
                </div>

                {queries.length === 0 ? (
                  <div className="enterprise-card p-12 text-center flex flex-col items-center justify-center">
                    <History className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No History Yet</h3>
                    <p className="text-[var(--text-secondary)] text-sm mb-6">Ask a question in the dashboard to start generating your query history.</p>
                    <button onClick={() => setActiveView('dashboard')} className="text-[var(--accent-indigo)] hover:underline font-medium text-sm">Return to Dashboard →</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {queries.slice().reverse().map(q => (
                      <div key={q.id} className="enterprise-card p-6 flex items-start gap-4 hover:border-[var(--accent-indigo)] transition-colors group">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center shrink-0 mt-1">
                          <MessageSquare className="w-4 h-4 text-[var(--text-secondary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium text-[var(--text-primary)] mb-2">{q.text}</p>
                          {q.result && q.result.sql ? (
                            <pre className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)] p-3 rounded-lg overflow-x-auto border border-[var(--border-color)]">
                              {q.result.sql.split('\n')[0].substring(0, 100)}...
                            </pre>
                          ) : (
                            <p className="text-xs text-rose-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {q.result?.clarification || "Query failed"}</p>
                          )}
                        </div>
                        <button onClick={() => { setActiveView('dashboard'); handleQuery(q.text); }} className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--accent-indigo)] hover:text-white rounded-lg text-sm font-medium transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-2">
                          <Play className="w-3 h-3" /> Re-run
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeView === 'insights' && (
              <div className="max-w-5xl mx-auto animation-fade-in">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">AI Insights Feed</h2>
                  <p className="text-[var(--text-secondary)]">Consolidated narratives generated by Solaris.</p>
                </div>

                {queries.filter(q => q.result && q.result.config?.description).length === 0 ? (
                  <div className="enterprise-card p-12 text-center flex flex-col items-center justify-center">
                    <Lightbulb className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Insights Generated</h3>
                    <p className="text-[var(--text-secondary)] text-sm mb-6">Chart summaries and analytical descriptions will appear here.</p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    {queries.filter(q => q.result && q.result.config?.description).slice().reverse().map(q => (
                      <div key={q.id} className="enterprise-card p-6 border-l-4 border-l-[var(--accent-indigo)] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Sparkles className="w-16 h-16 text-[var(--accent-indigo)]" /></div>
                        <div className="relative z-10">
                          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{q.result.config.title}</h3>
                          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">{q.result.config.description}</p>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[var(--text-muted)] italic px-2 py-1 bg-[var(--bg-secondary)] rounded">"{q.text.substring(0, 30)}..."</span>
                            <button onClick={() => { setActiveView('dashboard'); setExpandedChart(q); }} className="text-[var(--accent-indigo)] font-semibold hover:underline">View Chart →</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeView === 'dashboard' && queries.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto mt-[-10vh]">
                <div className="w-16 h-16 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <Sparkles className="w-8 h-8 text-[var(--accent-indigo)]" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight mb-3 text-[var(--text-primary)]">Ask a question about your data</h2>
                <p className="text-[var(--text-secondary)] mb-8 text-center text-sm md:text-base">
                  Solaris AI will analyze your datasets, write the SQL, and generate an interactive dashboard instantly.
                </p>

                {/* Hero Input Box */}
                <div className="w-full relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                  <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuery(inputValue);
                    }}
                    placeholder="e.g., Show revenue by marketing channel..."
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl py-4 pl-12 pr-12 shadow-sm focus:ring-2 focus:ring-[var(--accent-indigo)] focus:border-transparent outline-none transition-all placeholder:text-[var(--text-muted)] text-base"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <button onClick={() => handleQuery(inputValue)} className="p-2 bg-[var(--accent-indigo)] text-white rounded-lg hover:bg-[var(--accent-indigo-hover)] transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] w-full text-center mb-2">Example Prompts</span>
                  {[
                    "Show revenue by marketing channel",
                    "Compare ROI across campaign types",
                    "Show revenue trend over time"
                  ].map((p, i) => (
                    <button key={i} onClick={() => handleQuery(p)} className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-indigo)] hover:bg-[var(--bg-primary)] rounded-full text-xs font-medium text-[var(--text-secondary)] transition-all">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeView === 'dashboard' && queries.length > 0 && (
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
                          <DashboardCard result={q.result} onExpand={() => setExpandedChart(q)} onRefine={(t) => handleQuery(t, q.result)} />
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

                      const askedQuestions = new Set(queries.map(q => q.text));
                      const finalSuggestions = [...new Set(pool.filter(q => !askedQuestions.has(q)).sort(() => 0.5 - Math.random()))].slice(0, 3);
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
            )}
            <div ref={bottomRef} className="h-10" />
          </div>

          {/* Global Hero Input (always visible at bottom) */}
          <div className="absolute bottom-6 inset-x-0 px-8 flex justify-center">
            <div className={`w-full max-w-4xl enterprise-card p-2 flex items-center gap-3 shadow-[var(--shadow-elevated)] bg-[var(--bg-primary)] transition-transform duration-300 ${activeView === 'dashboard' ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setActiveView('dashboard');
                    handleQuery(inputValue);
                  }
                }}
                placeholder="Message Solaris AI..."
                className="flex-1 bg-transparent px-4 py-2 outline-none text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
              <button
                onClick={() => {
                  setActiveView('dashboard');
                  handleQuery(inputValue);
                }}
                className="w-10 h-10 bg-[var(--accent-indigo)] text-white rounded-lg hover:bg-[var(--accent-indigo-hover)] transition-all flex items-center justify-center group"
              >
                <Play className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </main>
      </div> {/* Close the main area flex wrapper */}

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="enterprise-card max-w-md w-full p-8 shadow-2xl relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--accent-indigo)]/10 rounded-lg flex items-center justify-center"><Key className="w-5 h-5 text-[var(--accent-indigo)]" /></div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] leading-none">Settings</h2>
                    <p className="text-xs text-[var(--text-secondary)]">OpenRouter API Configuration</p>
                  </div>
                </div>
                {localStorage.getItem('openrouter_api_key') && (
                  <button onClick={() => setShowSettings(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">API Token</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3 text-sm focus:ring-2 ring-[var(--accent-indigo)]/30 outline-none transition-all placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
                    placeholder="sk-or-v1-..."
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-2">API keys are stored securely in your browser's local storage and never transmitted to our servers.</p>
                </div>
                <button onClick={() => handleSaveApiKey(apiKey)} className="w-full bg-[var(--accent-indigo)] text-white font-semibold py-3 rounded-lg hover:bg-[var(--accent-indigo-hover)] active:scale-95 transition-all text-sm shadow-sm">
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {expandedChart && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[var(--bg-primary)]/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 md:p-12">
            <div className="enterprise-card w-full h-full max-w-7xl shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 md:p-8 border-b border-[var(--border-color)] flex justify-between items-center bg-[var(--bg-secondary)]">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-1">{expandedChart.result.config?.title}</h2>
                  <p className="text-[var(--text-secondary)] font-medium text-sm">{expandedChart.result.config?.description}</p>
                </div>
                <button onClick={() => setExpandedChart(null)} className="w-12 h-12 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 p-8 md:p-12 flex items-center justify-center bg-[var(--bg-primary)]">
                <DynamicChart data={expandedChart.result.data} chartType={expandedChart.result.chartType} config={expandedChart.result.config} isExpanded={true} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const DashboardCard = ({ result, onExpand, onRefine }) => {
  const [showSql, setShowSql] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [refineValue, setRefineValue] = useState('');

  if (!result) return null;

  return (
    <div className="enterprise-card overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-elevated)]">
      <div className="p-6 md:p-8 flex justify-between items-start border-b border-[var(--border-color)]">
        <div>
          <h3 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
            {result.config?.title || "Analytical Insights"}
          </h3>
          <p className="text-[var(--text-secondary)] font-medium text-sm">
            {result.config?.description || "Generated by Solaris Engine"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSql(!showSql)} className={`p-2 rounded-lg transition-all flex items-center justify-center ${showSql ? 'bg-[var(--accent-indigo)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`} title="View Retrieved Context (RAG)"><Code className="w-4 h-4" /></button>
          <button onClick={onExpand} className="p-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center" title="Expand Chart"><Maximize2 className="w-4 h-4" /></button>
          <button onClick={() => setShowRefine(!showRefine)} className={`p-2 rounded-lg transition-all flex items-center justify-center ${showRefine ? 'bg-[var(--accent-rose)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`} title="Refine Query"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      <AnimatePresence>
        {showSql && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-2 text-[var(--accent-indigo)] font-semibold text-xs uppercase tracking-wider">
                <Database className="w-4 h-4" /> Retrieved Context (RAG)
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] overflow-x-auto">
                {result.sql}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6 md:p-8 h-[400px]">
        {result.clarification ? (
          <div className="h-full flex flex-col items-center justify-center p-8 bg-[var(--bg-secondary)] rounded-xl border border-dashed border-[var(--border-color)] text-center">
            <AlertCircle className="w-10 h-10 text-[var(--text-muted)] mb-4" />
            <p className="text-[var(--text-secondary)] font-medium text-sm max-w-md leading-relaxed">{result.clarification}</p>
          </div>
        ) : (
          <DynamicChart data={result.data} chartType={result.chartType} config={result.config} />
        )}
      </div>

      <AnimatePresence>
        {showRefine && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 pt-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="mt-6 bg-[var(--bg-primary)] border border-[var(--border-color)] p-2 rounded-xl flex gap-3 shadow-sm">
              <input
                value={refineValue}
                onChange={(e) => setRefineValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onRefine(refineValue); setShowRefine(false); } }}
                placeholder="Ask a follow-up question or refine this chart..."
                className="flex-1 bg-transparent px-4 py-2 outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm"
              />
              <button onClick={() => { onRefine(refineValue); setShowRefine(false); }} className="bg-[var(--accent-indigo)] hover:bg-[var(--accent-indigo-hover)] text-white px-6 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm">
                Apply Update
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-6 py-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-indigo)]" />
          <span className="font-medium text-[var(--text-secondary)]">AI Insight Generated</span>
        </div>
        <div className="flex items-center gap-2 text-[var(--text-muted)] font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Secure Local Execution
        </div>
      </div>
    </div>
  );
};
