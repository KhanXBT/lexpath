import { useState, useRef, useEffect } from 'react'
import { Scale, ShieldAlert, Gavel, Send, Upload, AlertTriangle, HelpCircle, Activity, MessageSquare, Settings, X, Lock, Mic, FileText, StopCircle, BookOpen, Briefcase, FileCheck, Download, Key, Zap, Sparkles, ChevronDown, Loader2, Bot, User, Copy, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConvexStressTest, runStressTestDirect, simulateResponse, type AnalysisResult } from './services/ai'
import { extractTextFromPdf } from './services/pdf'
import './App.css'
import { LandingPage } from './components/LandingPage'

type Persona = 'judge' | 'counsel' | 'jury' | 'auditor' | 'ip'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'analysis' | 'thinking' | 'error'
  persona?: Persona
  result?: AnalysisResult
  timestamp: Date
}

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [activePersona, setActivePersona] = useState<Persona>('judge')
  const [inputValue, setInputValue] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [evidenceFile, setEvidenceFile] = useState<string | undefined>(undefined)
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Voice & Brief State
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // API Key State
  const [showSettings, setShowSettings] = useState(false)
  const [geminiKey, setGeminiKey] = useState('')
  const [qwenKey, setQwenKey] = useState('')
  const [hfKey, setHfKey] = useState('')

  // Free tier tracking
  const [remainingRequests, setRemainingRequests] = useState<number>(5)
  const [showLimitModal, setShowLimitModal] = useState(false)

  // Convex hook
  const { runViaConvex, checkRemaining } = useConvexStressTest()

  // Check remaining requests on mount
  useEffect(() => {
    checkRemaining().then(({ remainingRequests }) => {
      setRemainingRequests(remainingRequests)
    }).catch(() => {
      setRemainingRequests(5)
    })
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const briefInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const personas = {
    judge: { title: 'The Hostile Judge', icon: <Gavel size={18} />, description: 'Exposes logical gaps and structural flaws.', color: '#00f3ff' },
    counsel: { title: 'Opposing Counsel', icon: <ShieldAlert size={18} />, description: 'Exploits procedural and evidentiary weaknesses.', color: '#ff6b6b' },
    jury: { title: 'Skeptical Jury', icon: <Scale size={18} />, description: 'Challenges credibility and emotional resonance.', color: '#ffd93d' },
    auditor: { title: 'Corporate Auditor', icon: <Briefcase size={18} />, description: 'Regulatory, fiduciary, and financial compliance.', color: '#6bcb77' },
    ip: { title: 'IP Guardian', icon: <FileCheck size={18} />, description: 'Intellectual property and patent vulnerability.', color: '#a66cff' }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        const base64Content = base64String.split(',')[1]
        setEvidenceFile(base64Content)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleBriefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result
        if (typeof text === 'string') {
          setInputValue(prev => prev + (prev ? '\n\n' : '') + text)
        }
      }
      reader.readAsText(file)
    }
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Please upload a PDF file.")
        return
      }
      try {
        const text = await extractTextFromPdf(file)
        setInputValue(prev => prev + (prev ? '\n\n' : '') + `=== ${file.name} ===\n${text}`)
      } catch (err) {
        console.error("PDF Error", err)
        alert("Failed to parse PDF.")
      }
    }
  }

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        alert("Voice dictation is not supported in this browser.")
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputValue(prev => prev + ' ' + finalTranscript)
        }
      };

      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    }
  }

  const handleSubmit = async () => {
    if (!inputValue.trim() || isAnalyzing) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      persona: activePersona,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsAnalyzing(true)

    // Add thinking message
    const thinkingId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'assistant',
      content: '',
      type: 'thinking',
      timestamp: new Date()
    }])

    try {
      let result: AnalysisResult

      if (geminiKey) {
        result = await runStressTestDirect(activePersona, userMessage.content, evidenceFile, {
          geminiKey,
          qwenKey: qwenKey || undefined,
          hfKey: hfKey || undefined
        })
      } else {
        const convexResult = await runViaConvex(activePersona, userMessage.content, evidenceFile)

        if (convexResult.limitExceeded) {
          setShowLimitModal(true)
          setRemainingRequests(0)
          // Remove thinking message and add error
          setMessages(prev => prev.filter(m => m.id !== thinkingId).concat({
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: 'Free tier limit reached. Please add your Gemini API key to continue.',
            type: 'error',
            timestamp: new Date()
          }))
          setIsAnalyzing(false)
          return
        } else if (convexResult.success && convexResult.result) {
          result = convexResult.result
          setRemainingRequests(convexResult.remainingRequests)
        } else {
          result = await simulateResponse(activePersona)
        }
      }

      // Replace thinking with actual result
      setMessages(prev => prev.filter(m => m.id !== thinkingId).concat({
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '',
        type: 'analysis',
        persona: activePersona,
        result,
        timestamp: new Date()
      }))

    } catch (error) {
      console.error('Analysis error:', error)
      const simResult = await simulateResponse(activePersona)
      setMessages(prev => prev.filter(m => m.id !== thinkingId).concat({
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '',
        type: 'analysis',
        persona: activePersona,
        result: simResult,
        timestamp: new Date()
      }))
    }

    setIsAnalyzing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleExportChat = () => {
    const content = messages.map(m => {
      if (m.role === 'user') {
        return `## USER [${personas[m.persona!]?.title || 'Unknown'}]\n${m.content}\n`
      } else if (m.type === 'analysis' && m.result) {
        return `## LEXPATH ANALYSIS\n\n### Critical Vulnerability\n${m.result.verdict}\n\n### Adversarial Interrogatories\n${m.result.interrogatories.map(q => `- ${q}`).join('\n')}\n\n### Logical Contradiction\n${m.result.contradiction}\n`
      }
      return ''
    }).join('\n---\n\n')

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lexpath_chat_${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-left" onClick={() => setMessages([])} style={{ cursor: 'pointer' }}>
          <img src="/logo.jpg" alt="Lexpath" className="logo-img" />
          <div className="logo-text">
            <span className="logo-name">LEXPATH</span>
            <span className="logo-tag">ADVERSARY SIMULATOR</span>
          </div>
        </div>

        <div className="header-center">
          {/* Persona Dropdown */}
          <div className="persona-dropdown-container">
            <button
              className="persona-dropdown-trigger"
              onClick={() => setShowPersonaDropdown(!showPersonaDropdown)}
            >
              <span className="persona-icon" style={{ color: personas[activePersona].color }}>
                {personas[activePersona].icon}
              </span>
              <span>{personas[activePersona].title}</span>
              <ChevronDown size={16} className={showPersonaDropdown ? 'rotated' : ''} />
            </button>

            <AnimatePresence>
              {showPersonaDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="persona-dropdown"
                >
                  {(Object.keys(personas) as Persona[]).map((p) => (
                    <button
                      key={p}
                      className={`persona-option ${activePersona === p ? 'active' : ''}`}
                      onClick={() => {
                        setActivePersona(p)
                        setShowPersonaDropdown(false)
                      }}
                    >
                      <span className="persona-icon" style={{ color: personas[p].color }}>
                        {personas[p].icon}
                      </span>
                      <div className="persona-info">
                        <span className="persona-title">{personas[p].title}</span>
                        <span className="persona-desc">{personas[p].description}</span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="header-right">
          {!geminiKey && (
            <div className="free-badge">
              <Zap size={14} />
              <span className={remainingRequests <= 1 ? 'warning' : ''}>
                {remainingRequests} FREE
              </span>
            </div>
          )}
          <button className="header-btn" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} />
          </button>
          {messages.length > 0 && (
            <button className="header-btn" onClick={handleExportChat} title="Export Chat">
              <Download size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="settings-panel"
          >
            <div className="settings-header">
              <h3><Lock size={16} /> API Configuration</h3>
              <button className="close-btn" onClick={() => setShowSettings(false)}><X size={16} /></button>
            </div>
            <p className="settings-note">Keys are stored in-memory only.</p>

            <div className="input-group">
              <label>Gemini API Key (Required)</label>
              <input
                type="password"
                placeholder="Paste Gemini API Key..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Qwen 3 API Key (Optional)</label>
              <input
                type="password"
                placeholder="Paste Qwen API Key..."
                value={qwenKey}
                onChange={(e) => setQwenKey(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>HuggingFace Token (Optional)</label>
              <input
                type="password"
                placeholder="Paste HF Token..."
                value={hfKey}
                onChange={(e) => setHfKey(e.target.value)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Limit Modal */}
      <AnimatePresence>
        {showLimitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowLimitModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="limit-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="limit-header">
                <Zap size={24} />
                <h3>Free Tier Limit Reached</h3>
              </div>
              <p>You've used all 5 free analysis requests.</p>
              <p className="limit-note">Add your Gemini API key to continue.</p>

              <div className="input-group">
                <label>Gemini API Key</label>
                <input
                  type="password"
                  placeholder="Paste your API Key..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </div>

              <div className="limit-actions">
                <a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noopener noreferrer">
                  <Key size={14} /> Get Free Key
                </a>
                <button onClick={() => setShowLimitModal(false)}>
                  {geminiKey ? 'Continue' : 'Close'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="chat-area">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-icon">
              <Sparkles size={48} />
            </div>
            <h2>Welcome to LEXPATH</h2>
            <p>Your AI-powered legal strategy stress tester. Select an adversary and describe your case strategy to begin.</p>

            <div className="quick-actions">
              {(Object.keys(personas) as Persona[]).map((p) => (
                <button
                  key={p}
                  className={`quick-action ${activePersona === p ? 'active' : ''}`}
                  onClick={() => setActivePersona(p)}
                  style={{ '--accent-color': personas[p].color } as React.CSSProperties}
                >
                  <span className="qa-icon">{personas[p].icon}</span>
                  <span className="qa-title">{personas[p].title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`message ${msg.role}`}
              >
                {msg.role === 'user' ? (
                  <>
                    <div className="message-avatar user-avatar">
                      <User size={18} />
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="sender">You</span>
                        <span className="persona-tag" style={{ color: personas[msg.persona!]?.color }}>
                          {personas[msg.persona!]?.icon} {personas[msg.persona!]?.title}
                        </span>
                      </div>
                      <div className="message-text">{msg.content}</div>
                    </div>
                  </>
                ) : msg.type === 'thinking' ? (
                  <>
                    <div className="message-avatar bot-avatar">
                      <Bot size={18} />
                    </div>
                    <div className="message-content thinking">
                      <div className="thinking-indicator">
                        <Loader2 size={16} className="spin" />
                        <span>Analyzing case strategy...</span>
                      </div>
                      <div className="thinking-steps">
                        <div className="step active">Identifying logical gaps...</div>
                        <div className="step">Formulating interrogatories...</div>
                        <div className="step">Finding contradictions...</div>
                      </div>
                    </div>
                  </>
                ) : msg.type === 'error' ? (
                  <>
                    <div className="message-avatar bot-avatar error">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="message-content error-message">
                      <p>{msg.content}</p>
                    </div>
                  </>
                ) : msg.type === 'analysis' && msg.result ? (
                  <>
                    <div className="message-avatar bot-avatar">
                      <Bot size={18} />
                    </div>
                    <div className="message-content analysis-response">
                      <div className="message-header">
                        <span className="sender">LEXPATH</span>
                        <button
                          className="copy-btn"
                          onClick={() => copyToClipboard(
                            `${msg.result!.verdict}\n\nInterrogatories:\n${msg.result!.interrogatories.join('\n')}\n\nContradiction:\n${msg.result!.contradiction}`,
                            msg.id
                          )}
                        >
                          {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div className="analysis-section vulnerability">
                        <div className="section-header">
                          <AlertTriangle size={16} />
                          <span>Critical Vulnerability</span>
                        </div>
                        <p>{msg.result.verdict}</p>
                      </div>

                      <div className="analysis-section questions">
                        <div className="section-header">
                          <HelpCircle size={16} />
                          <span>Adversarial Interrogatories</span>
                        </div>
                        <ul>
                          {msg.result.interrogatories.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="analysis-section logic">
                        <div className="section-header">
                          <Activity size={16} />
                          <span>Logical Contradiction</span>
                        </div>
                        <p className="mono">{msg.result.contradiction}</p>
                      </div>

                      {msg.result.qwenCritique && (
                        <div className="analysis-section critique">
                          <div className="section-header">
                            <MessageSquare size={16} />
                            <span>Qwen 3 Critique</span>
                          </div>
                          <p>{msg.result.qwenCritique}</p>
                        </div>
                      )}

                      {msg.result.saulCritique && (
                        <div className="analysis-section scholar">
                          <div className="section-header">
                            <BookOpen size={16} />
                            <span>Saul 7B Scholar</span>
                          </div>
                          <p>{msg.result.saulCritique}</p>
                        </div>
                      )}

                      {msg.result.bestAnswer && (
                        <div className="analysis-section best-answer">
                          <div className="section-header">
                            <Sparkles size={16} />
                            <span>Gemini's Best Answer</span>
                          </div>
                          <p>{msg.result.bestAnswer}</p>
                        </div>
                      )}

                      {msg.result.finalVerdict && (
                        <div className="analysis-section final-verdict">
                          <div className="section-header">
                            <Gavel size={16} />
                            <span>Final Verdict</span>
                          </div>
                          <p className="verdict-text">{msg.result.finalVerdict}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - Gemini Style */}
      <div className="input-area">
        <div className="input-container">
          {/* Hidden file inputs */}
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept="image/*" />
          <input type="file" ref={briefInputRef} onChange={handleBriefUpload} style={{ display: 'none' }} accept=".txt,.md" />
          <input type="file" ref={pdfInputRef} onChange={handlePdfUpload} style={{ display: 'none' }} accept=".pdf" />

          <div className="input-tools">
            <button
              className={`input-tool ${isListening ? 'active' : ''}`}
              onClick={toggleListening}
              title="Voice input"
            >
              {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
            </button>
            <button className="input-tool" onClick={() => pdfInputRef.current?.click()} title="Upload PDF">
              <FileText size={18} />
            </button>
            <button
              className={`input-tool ${evidenceFile ? 'active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              title="Upload evidence"
            >
              <Upload size={18} />
            </button>
          </div>

          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your legal strategy or case details..."
            rows={1}
          />

          <button
            className={`send-btn ${inputValue.trim() && !isAnalyzing ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isAnalyzing}
          >
            {isAnalyzing ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
          </button>
        </div>

        <div className="input-footer">
          <span>LEXPATH uses adversarial AI to stress-test legal strategies</span>
          {evidenceFile && (
            <span className="evidence-indicator">
              <Upload size={12} /> Evidence attached
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
