'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import styles from './calculator.module.css';
import Window from './components/Window';

interface Tab {
  id: string;
  name: string;
  content: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

interface WindowState {
  id: string;
  zIndex: number;
  isFocused: boolean;
}

interface LineResult {
  lineIndex: number;
  result: number;
  expression: string;
}

type ViewMode = 'tabs' | 'desktop';

export default function CalculatorPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('tabs');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set());
  const [windowStates, setWindowStates] = useState<Map<string, WindowState>>(new Map());
  const [maxZIndex, setMaxZIndex] = useState(1000);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [lineResults, setLineResults] = useState<Map<string, Map<number, LineResult>>>(new Map());
  const [variables, setVariables] = useState<Map<string, Map<string, number>>>(new Map());
  const [currentLinePreviews, setCurrentLinePreviews] = useState<Map<string, { result: number; line: number } | null>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const STORAGE_KEY = 'calculator_notes';
  const MODE_STORAGE_KEY = 'calculator_view_mode';
  const WINDOWS_STORAGE_KEY = 'calculator_windows';

  // Load from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
    if (savedMode === 'desktop' || savedMode === 'tabs') {
      setViewMode(savedMode);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTabs(parsed);
          if (savedMode === 'tabs') {
            setActiveTabId(parsed[0].id);
            setContent(parsed[0].content);
            processContent(parsed[0].id, parsed[0].content);
          } else {
            // Desktop mode: open all windows
            const windows = new Set(parsed.map((t: Tab) => t.id));
            setOpenWindows(windows);
            parsed.forEach((tab: Tab, index: number) => {
              setWindowStates(prev => new Map(prev).set(tab.id, {
                id: tab.id,
                zIndex: maxZIndex + index,
                isFocused: index === 0,
              }));
            });
            if (parsed.length > 0) {
              setMaxZIndex(maxZIndex + parsed.length);
            }
          }
        } else {
          createNewTab();
        }
      } catch (error) {
        console.error('[Calculator] Erreur lors du chargement depuis localStorage:', error);
        createNewTab();
      }
    } else {
      createNewTab();
    }
  }, []);

  // Save to localStorage whenever tabs change (including positions and sizes)
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    }
  }, [tabs]);

  // Save view mode
  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const createNewTab = () => {
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      name: `Note ${tabs.length + 1}`,
      content: '',
      position: { x: 100 + (tabs.length * 30), y: 100 + (tabs.length * 30) },
      size: { width: 500, height: 400 },
    };
    setTabs([...tabs, newTab]);
    
    if (viewMode === 'tabs') {
      setActiveTabId(newTab.id);
      setContent(newTab.content);
      processContent(newTab.id, newTab.content);
    } else {
      // Desktop mode: open the new window
      setOpenWindows(prev => new Set(prev).add(newTab.id));
      setMaxZIndex(prev => prev + 1);
      setWindowStates(prev => new Map(prev).set(newTab.id, {
        id: newTab.id,
        zIndex: maxZIndex + 1,
        isFocused: true,
      }));
      // Unfocus other windows
      setWindowStates(prev => {
        const newMap = new Map(prev);
        newMap.forEach((state, id) => {
          if (id !== newTab.id) {
            newMap.set(id, { ...state, isFocused: false });
          }
        });
        return newMap;
      });
    }
  };

  const deleteTab = (tabId: string) => {
    const newTabs = tabs.filter(t => t.id !== tabId);
    if (newTabs.length === 0) {
      createNewTab();
    } else {
      setTabs(newTabs);
      if (viewMode === 'tabs') {
        if (activeTabId === tabId) {
          setActiveTabId(newTabs[0].id);
          setContent(newTabs[0].content);
          processContent(newTabs[0].id, newTabs[0].content);
        }
      } else {
        setOpenWindows(prev => {
          const newSet = new Set(prev);
          newSet.delete(tabId);
          return newSet;
        });
        setWindowStates(prev => {
          const newMap = new Map(prev);
          newMap.delete(tabId);
          return newMap;
        });
      }
    }
  };

  const closeWindow = (tabId: string) => {
    setOpenWindows(prev => {
      const newSet = new Set(prev);
      newSet.delete(tabId);
      return newSet;
    });
    setWindowStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(tabId);
      return newMap;
    });
  };

  const openWindow = (tabId: string) => {
    setOpenWindows(prev => new Set(prev).add(tabId));
    setMaxZIndex(prev => prev + 1);
    setWindowStates(prev => {
      const newMap = new Map(prev);
      const state = newMap.get(tabId);
      if (state) {
        newMap.set(tabId, { ...state, zIndex: maxZIndex + 1, isFocused: true });
      } else {
        newMap.set(tabId, {
          id: tabId,
          zIndex: maxZIndex + 1,
          isFocused: true,
        });
      }
      // Unfocus other windows
      newMap.forEach((s, id) => {
        if (id !== tabId) {
          newMap.set(id, { ...s, isFocused: false });
        }
      });
      return newMap;
    });
  };

  const focusWindow = (tabId: string) => {
    setMaxZIndex(prev => prev + 1);
    setWindowStates(prev => {
      const newMap = new Map(prev);
      newMap.forEach((state, id) => {
        if (id === tabId) {
          newMap.set(id, { ...state, zIndex: maxZIndex + 1, isFocused: true });
        } else {
          newMap.set(id, { ...state, isFocused: false });
        }
      });
      return newMap;
    });
  };

  const updateTabContent = (tabId: string, newContent: string) => {
    setTabs(tabs.map(t => 
      t.id === tabId ? { ...t, content: newContent } : t
    ));
  };

  const updateTabPosition = (tabId: string, position: { x: number; y: number }) => {
    setTabs(tabs.map(t => 
      t.id === tabId ? { ...t, position } : t
    ));
  };

  const updateTabSize = (tabId: string, size: { width: number; height: number }) => {
    setTabs(tabs.map(t => 
      t.id === tabId ? { ...t, size } : t
    ));
  };

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setContent(tab.content);
      processContent(tabId, tab.content);
    }
  };

  // Get the last result (ans) for a specific tab
  // Excludes the current line being evaluated (lineIndex) to avoid using its own result
  const getLastResult = (tabId: string, currentResults?: Map<number, LineResult>, excludeLineIndex?: number): number | null => {
    const results = currentResults || lineResults.get(tabId);
    if (!results || results.size === 0) return null;
    // Get results sorted by line index, excluding the current line
    const sortedResults = Array.from(results.entries())
      .filter(([index]) => excludeLineIndex === undefined || index < excludeLineIndex)
      .sort(([a], [b]) => a - b);
    return sortedResults[sortedResults.length - 1]?.[1]?.result ?? null;
  };

  // Get result from a specific line (for $1, $2, etc.)
  const getLineResult = (tabId: string, lineNum: number): number | null => {
    const results = lineResults.get(tabId);
    if (!results) return null;
    const result = results.get(lineNum - 1);
    return result?.result ?? null;
  };

  // Replace variables and references in expression
  const replaceVariables = (tabId: string, expression: string, lineIndex: number, currentResults?: Map<number, LineResult>, currentVars?: Map<string, number>): string => {
    let processed = expression;
    const vars = currentVars || variables.get(tabId) || new Map();
    
    // Replace ans with last result (exclude current line to avoid using its own result)
    const ansMatch = processed.match(/\bans\b/gi);
    if (ansMatch) {
      const lastResult = getLastResult(tabId, currentResults, lineIndex);
      if (lastResult !== null) {
        processed = processed.replace(/\bans\b/gi, lastResult.toString());
      }
    }
    
    // Replace $1, $2, etc. with line results (use currentResults if provided)
    processed = processed.replace(/\$(\d+)/g, (match, lineNum) => {
      const lineIndex = parseInt(lineNum, 10) - 1; // Convert to 0-indexed
      const results = currentResults || lineResults.get(tabId);
      if (results) {
        const result = results.get(lineIndex);
        if (result) {
          return result.result.toString();
        }
      }
      return match;
    });
    
    // Replace variables (x = 10, then use x)
    vars.forEach((value, varName) => {
      const regex = new RegExp(`\\b${varName}\\b`, 'g');
      processed = processed.replace(regex, value.toString());
    });
    
    return processed;
  };

  // Check if line is a variable assignment (x = 10)
  const parseVariableAssignment = (tabId: string, line: string, currentResults?: Map<number, LineResult>, currentVars?: Map<string, number>): { name: string; value: number } | null => {
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (match) {
      const varName = match[1];
      const valueExpr = match[2].trim();
      
      try {
        const processed = replaceVariables(tabId, valueExpr, -1, currentResults, currentVars);
        const value = Function(`"use strict"; return (${processed})`)();
        if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
          return { name: varName, value };
        }
      } catch (error) {
        console.error('[Calculator] Erreur lors de l\'assignation de variable:', error);
        return null;
      }
    }
    return null;
  };

  const evaluateExpression = (tabId: string, line: string, lineIndex: number, currentResults?: Map<number, LineResult>, currentVars?: Map<string, number>): { result: number | null; isExpression: boolean } => {
    const trimmed = line.trim();
    
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      return { result: null, isExpression: false };
    }

    // Check for variable assignment
    const varAssignment = parseVariableAssignment(tabId, trimmed, currentResults, currentVars);
    if (varAssignment) {
      // Only update state if not using current results (i.e., not in processContent)
      if (!currentResults) {
        setVariables(prev => {
          const newMap = new Map(prev);
          const tabVars = newMap.get(tabId) || new Map();
          tabVars.set(varAssignment.name, varAssignment.value);
          newMap.set(tabId, tabVars);
          return newMap;
        });
      }
      return { result: varAssignment.value, isExpression: true };
    }

    // Skip if line already has a result
    if (trimmed.includes('=')) {
      const match = trimmed.match(/^(.+?)\s*=\s*([\d\.]+)$/);
      if (match) {
        return { result: parseFloat(match[2]), isExpression: true };
      }
    }

    // Try to evaluate if it looks like a math expression
    const mathPattern = /^([\d\s\+\-\*\/\(\)\.ans\$a-zA-Z_]+)$/;
    if (mathPattern.test(trimmed)) {
      try {
        let expression = trimmed
          .replace(/\s+/g, '')
          .replace(/×/g, '*')
          .replace(/÷/g, '/');
        
        if (!expression) {
          return { result: null, isExpression: false };
        }
        
        // Replace variables and references (use currentResults if provided)
        expression = replaceVariables(tabId, expression, lineIndex, currentResults, currentVars);
        
        const result = Function(`"use strict"; return (${expression})`)();
        
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
          const inputValue = parseFloat(expression);
          if (result !== inputValue || expression.includes('+') || expression.includes('-') || expression.includes('*') || expression.includes('/') || expression.includes('ans') || expression.includes('$')) {
            return { result, isExpression: true };
          }
        }
      } catch (error) {
        console.error('[Calculator] Erreur lors de l\'évaluation:', error);
        return { result: null, isExpression: false };
      }
    }

    return { result: null, isExpression: false };
  };

  const processContent = useCallback((tabId: string, text: string) => {
    const lines = text.split('\n');
    const newResults = new Map<number, LineResult>();
    const newVariables = new Map<string, number>();
    let contentUpdated = false;
    const updatedLines = [...lines];
    
    const tabResults = lineResults.get(tabId) || new Map();
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Check for variable assignment (pass current results and vars for ans to work correctly)
      const varAssignment = parseVariableAssignment(tabId, trimmed, newResults, newVariables);
      if (varAssignment) {
        newVariables.set(varAssignment.name, varAssignment.value);
        newResults.set(index, { lineIndex: index, result: varAssignment.value, expression: trimmed });
        return;
      }
      
      // If line has a result, check if expression changed and recalculate
      if (trimmed.includes('=')) {
        const match = trimmed.match(/^(.+?)\s*=\s*([\d\.\-]+)$/);
        if (match) {
          const expression = match[1].trim();
          const oldResult = parseFloat(match[2]);
          
          // Get stored expression to compare
          const storedResult = tabResults.get(index);
          const storedExpression = storedResult?.expression;
          
          // If expression changed (or not stored), recalculate (pass current results for ans)
          if (!storedExpression || storedExpression !== expression) {
            const { result: newResult, isExpression } = evaluateExpression(tabId, expression, index, newResults, newVariables);
            
            if (newResult !== null && isExpression) {
              // Update the line with new result
              const formattedResult = Number.isInteger(newResult) ? newResult.toString() : newResult.toFixed(2);
              updatedLines[index] = `${expression} = ${formattedResult}`;
              contentUpdated = true;
              newResults.set(index, { lineIndex: index, result: newResult, expression });
            } else {
              newResults.set(index, { lineIndex: index, result: oldResult, expression });
            }
          } else {
            // Expression hasn't changed, keep stored result
            newResults.set(index, { lineIndex: index, result: oldResult, expression });
          }
        }
        return;
      }
      
      // Evaluate expression (pass current results for ans to work correctly)
      const { result, isExpression } = evaluateExpression(tabId, trimmed, index, newResults, newVariables);
      if (result !== null && isExpression) {
        newResults.set(index, { lineIndex: index, result, expression: trimmed });
      }
    });
    
    setLineResults(prev => {
      const newMap = new Map(prev);
      newMap.set(tabId, newResults);
      return newMap;
    });
    setVariables(prev => {
      const newMap = new Map(prev);
      newMap.set(tabId, newVariables);
      return newMap;
    });
    
    // Return updated text if results were recalculated
    if (contentUpdated) {
      return updatedLines.join('\n');
    }
    return text;
  }, [lineResults]);

  const handleContentChange = (tabId: string, value: string) => {
    if (viewMode === 'tabs' && tabId === activeTabId) {
      setContent(value);
    }
    updateTabContent(tabId, value);
    
    // Process content to detect and update changed results
    const updatedValue = processContent(tabId, value);
    
    // Only update if content actually changed (from recalculation)
    if (updatedValue !== value) {
      updateTabContent(tabId, updatedValue);
      if (viewMode === 'tabs' && tabId === activeTabId) {
        setContent(updatedValue);
      }
    }
    
    // Update preview for current line (will be updated by selection change in desktop mode)
    if (viewMode === 'tabs') {
      updateCurrentLinePreview(tabId, value);
    }
  };

  const updateCurrentLinePreview = (tabId: string, text: string, selectionStart?: number) => {
    const lines = text.split('\n');
    
    // For desktop mode, we need to get selection from the window's textarea
    // For tab mode, use the provided selectionStart or get from ref
    let currentLineIndex = 0;
    if (viewMode === 'tabs' && tabId === activeTabId && textareaRef.current) {
      const start = selectionStart ?? textareaRef.current.selectionStart;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= start) {
          currentLineIndex = i;
          break;
        }
        charCount += lines[i].length + 1;
      }
    } else if (viewMode === 'desktop') {
      // In desktop mode, we'll update preview when content changes
      // The actual selection will be handled by the Window component
      // For now, just check the last line
      if (lines.length > 0) {
        currentLineIndex = lines.length - 1;
      }
    }
    
    const currentLine = lines[currentLineIndex] || '';
    const { result, isExpression } = evaluateExpression(tabId, currentLine, currentLineIndex);
    
    if (result !== null && isExpression && !currentLine.includes('=')) {
      setCurrentLinePreviews(prev => {
        const newMap = new Map(prev);
        newMap.set(tabId, { result, line: currentLineIndex });
        return newMap;
      });
    } else {
      setCurrentLinePreviews(prev => {
        const newMap = new Map(prev);
        newMap.set(tabId, null);
        return newMap;
      });
    }
  };

  const handleKeyDown = (tabId: string) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const text = textarea.value;
      const lines = text.split('\n');
      
      // Find current line
      let currentLineIndex = 0;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= start) {
          currentLineIndex = i;
          break;
        }
        charCount += lines[i].length + 1;
      }

      const currentLine = lines[currentLineIndex];
      const { result, isExpression } = evaluateExpression(tabId, currentLine, currentLineIndex);
      
      if (result !== null && isExpression && !currentLine.includes('=')) {
        e.preventDefault();
        const formattedResult = Number.isInteger(result) ? result.toString() : result.toFixed(2);
        lines[currentLineIndex] = `${currentLine.trim()} = ${formattedResult}`;
        const newText = lines.join('\n');
        handleContentChange(tabId, newText);
        
        // Set cursor position at the start of the next line
        setTimeout(() => {
          const newLines = newText.split('\n');
          const newPosition = newLines.slice(0, currentLineIndex + 1).join('\n').length + 1;
          textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
      }
    }
  };

  const handleSelectionChange = () => {
    if (textareaRef.current && activeTabId) {
      updateCurrentLinePreview(activeTabId, content);
    }
  };

  const switchViewMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    
    setViewMode(mode);
    
    if (mode === 'desktop') {
      // Open all tabs as windows
      const windows = new Set(tabs.map(t => t.id));
      setOpenWindows(windows);
      tabs.forEach((tab, index) => {
        setWindowStates(prev => new Map(prev).set(tab.id, {
          id: tab.id,
          zIndex: maxZIndex + index,
          isFocused: index === tabs.length - 1, // Focus last one
        }));
      });
      if (tabs.length > 0) {
        setMaxZIndex(prev => prev + tabs.length);
      }
    } else {
      // Close all windows, switch to tab mode
      setOpenWindows(new Set());
      setWindowStates(new Map());
      if (tabs.length > 0 && !activeTabId) {
        setActiveTabId(tabs[0].id);
        setContent(tabs[0].content);
        processContent(tabs[0].id, tabs[0].content);
      }
    }
  };

  const closedTabs = tabs.filter(t => !openWindows.has(t.id));

  return (
    <div className={styles.container} ref={containerRef}>
      <Link href="/" className={styles.backButton}>
        ← Retour
      </Link>
      {/* Mode switcher */}
      <div className={styles.modeSwitcher}>
        <button
          className={`${styles.modeButton} ${viewMode === 'tabs' ? styles.modeButtonActive : ''}`}
          onClick={() => switchViewMode('tabs')}
          title="Tab Mode"
        >
          📑 Tabs
        </button>
        <button
          className={`${styles.modeButton} ${viewMode === 'desktop' ? styles.modeButtonActive : ''}`}
          onClick={() => switchViewMode('desktop')}
          title="Desktop Mode"
        >
          🖥️ Desktop
        </button>
      </div>

      {viewMode === 'tabs' ? (
        // Tab mode (existing UI)
        <div className={styles.terminal}>
          <div className={styles.terminalHeader}>
            <div className={styles.terminalButtons}>
              <span className={styles.terminalButton}></span>
              <span className={styles.terminalButton}></span>
              <span className={styles.terminalButton}></span>
            </div>
            <div className={styles.terminalTitle}>
              calculator@{tabs.find(t => t.id === activeTabId)?.name || 'note-1'}
            </div>
            <div className={styles.terminalActions}>
              {tabs.length > 0 && (
                <div className={styles.tabs}>
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      className={`${styles.tab} ${activeTabId === tab.id ? styles.tabActive : ''}`}
                      onClick={() => handleTabClick(tab.id)}
                      title={tab.name}
                    >
                      {tab.name}
                      {tabs.length > 1 && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTab(tab.id);
                          }}
                          className={styles.tabClose}
                        >
                          ×
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={createNewTab} className={styles.newTabButton}>+</button>
            </div>
          </div>

          <div className={styles.terminalBody}>
            <div className={styles.editorContent}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(activeTabId || '', e.target.value)}
                onKeyDown={activeTabId ? handleKeyDown(activeTabId) : undefined}
                onSelect={handleSelectionChange}
                onClick={handleSelectionChange}
                className={styles.textarea}
                placeholder="Type calculations like: 1+1 and press Enter..."
                spellCheck={false}
              />
              {currentLinePreviews.get(activeTabId || '') && (
                <div 
                  className={styles.preview}
                  style={{
                    top: `${((currentLinePreviews.get(activeTabId || '')?.line || 0) + 1) * 1.8}rem`
                  }}
                >
                  = {(() => {
                    const preview = currentLinePreviews.get(activeTabId || '');
                    if (!preview) return '';
                    return Number.isInteger(preview.result) ? preview.result : preview.result.toFixed(2);
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className={styles.terminalFooter}>
            <div className={styles.instructions}>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>Enter</span>
                <span className={styles.instructionDesc}>Evaluate expression</span>
              </div>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>ans</span>
                <span className={styles.instructionDesc}>Last result</span>
              </div>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>$1, $2...</span>
                <span className={styles.instructionDesc}>Line result</span>
              </div>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>x = 10</span>
                <span className={styles.instructionDesc}>Create variable</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Desktop mode
        <div className={styles.desktopContainer}>
          {/* Closed windows panel */}
          {closedTabs.length > 0 && (
            <div className={styles.closedWindowsPanel}>
              <div className={styles.closedWindowsTitle}>Closed Notes</div>
              <div className={styles.closedWindowsList}>
                {closedTabs.map(tab => (
                  <button
                    key={tab.id}
                    className={styles.closedWindowButton}
                    onClick={() => openWindow(tab.id)}
                    title={tab.name}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Open windows */}
          <div className={styles.windowsContainer}>
            {Array.from(openWindows).map(tabId => {
              const tab = tabs.find(t => t.id === tabId);
              if (!tab) return null;
              const windowState = windowStates.get(tabId);
              if (!windowState) return null;

              return (
                <Window
                  key={tabId}
                  id={tabId}
                  title={tab.name}
                  content={tab.content}
                  onContentChange={(newContent) => handleContentChange(tabId, newContent)}
                  onClose={() => closeWindow(tabId)}
                  onPositionChange={(pos) => updateTabPosition(tabId, pos)}
                  onSizeChange={(size) => updateTabSize(tabId, size)}
                  initialPosition={tab.position}
                  initialSize={tab.size}
                  zIndex={windowState.zIndex}
                  onFocus={() => focusWindow(tabId)}
                  isFocused={windowState.isFocused}
                  onKeyDown={handleKeyDown(tabId)}
                  currentLinePreview={currentLinePreviews.get(tabId) || null}
                  onSelectionChange={(selectionStart) => {
                    const tab = tabs.find(t => t.id === tabId);
                    if (tab) {
                      updateCurrentLinePreview(tabId, tab.content, selectionStart);
                    }
                  }}
                />
              );
            })}
          </div>

          {/* Floating action button */}
          <button onClick={createNewTab} className={styles.desktopNewButton} title="New Note">
            +
          </button>

          {/* Instructions footer */}
          <div className={styles.desktopFooter}>
            <div className={styles.instructions}>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>Enter</span>
                <span className={styles.instructionDesc}>Evaluate expression</span>
              </div>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>ans</span>
                <span className={styles.instructionDesc}>Last result</span>
              </div>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>$1, $2...</span>
                <span className={styles.instructionDesc}>Line result</span>
              </div>
              <div className={styles.instructionItem}>
                <span className={styles.instructionKey}>x = 10</span>
                <span className={styles.instructionDesc}>Create variable</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
