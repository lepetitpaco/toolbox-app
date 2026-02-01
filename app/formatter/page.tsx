'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import styles from './formatter.module.css';

type Language = 'json' | 'javascript' | 'typescript' | 'html' | 'css' | 'python' | 'xml' | 'sql' | 'yaml' | 'twig' | 'php';

interface LanguageConfig {
  name: string;
  emoji: string;
}

const LANGUAGES: Record<Language, LanguageConfig> = {
  json: { name: 'JSON', emoji: '📄' },
  javascript: { name: 'JavaScript', emoji: '📜' },
  typescript: { name: 'TypeScript', emoji: '📘' },
  html: { name: 'HTML', emoji: '🌐' },
  css: { name: 'CSS', emoji: '🎨' },
  python: { name: 'Python', emoji: '🐍' },
  xml: { name: 'XML', emoji: '📋' },
  sql: { name: 'SQL', emoji: '🗄️' },
  yaml: { name: 'YAML', emoji: '⚙️' },
  twig: { name: 'Twig', emoji: '🍃' },
  php: { name: 'PHP', emoji: '🐘' },
};

export default function FormatterPage() {
  const [language, setLanguage] = useState<Language>('json');
  const [input, setInput] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  const formatCode = useCallback(() => {
    setError('');
    setOutput('');

    if (!input.trim()) {
      return;
    }

    try {
      let formatted = '';

      switch (language) {
        case 'json':
          try {
            const parsed = JSON.parse(input);
            formatted = JSON.stringify(parsed, null, 2);
          } catch (e: any) {
            throw new Error(`JSON invalide: ${e.message}`);
          }
          break;

        case 'javascript':
        case 'typescript':
          // Basic JavaScript/TypeScript formatting (indentation)
          formatted = formatJavaScript(input);
          break;

        case 'html':
          formatted = formatHTML(input);
          break;

        case 'css':
          formatted = formatCSS(input);
          break;

        case 'python':
          // Python formatting (basic indentation)
          formatted = formatPython(input);
          break;

        case 'xml':
          formatted = formatXML(input);
          break;

        case 'sql':
          formatted = formatSQL(input);
          break;

        case 'yaml':
          // Basic YAML formatting
          formatted = formatYAML(input);
          break;

        case 'twig':
          formatted = formatTwig(input);
          break;

        case 'php':
          formatted = formatPHP(input);
          break;

        default:
          formatted = input;
      }

      setOutput(formatted);
    } catch (e: any) {
      const errorMessage = e.message || 'Erreur lors du formatage';
      console.error('[Formatter] Erreur lors du formatage:', e);
      setError(errorMessage);
      setOutput('');
    }
  }, [input, language]);

  const formatJavaScript = (code: string): string => {
    // Basic indentation for JavaScript/TypeScript
    const lines = code.split('\n');
    let indent = 0;
    const indentSize = 2;
    const formatted: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        formatted.push('');
        continue;
      }

      // Decrease indent before closing braces/brackets
      if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
        indent = Math.max(0, indent - indentSize);
      }

      formatted.push(' '.repeat(indent) + trimmed);

      // Increase indent after opening braces/brackets
      if (trimmed.endsWith('{') || trimmed.endsWith('[')) {
        indent += indentSize;
      }
    }

    return formatted.join('\n');
  };

  const formatHTML = (html: string): string => {
    // Basic HTML formatting
    let formatted = html
      .replace(/>\s+</g, '>\n<')
      .replace(/\s+/g, ' ')
      .trim();

    const lines = formatted.split('\n');
    let indent = 0;
    const indentSize = 2;
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('</')) {
        indent = Math.max(0, indent - indentSize);
      }

      result.push(' '.repeat(indent) + trimmed);

      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
        indent += indentSize;
      }
    }

    return result.join('\n');
  };

  const formatCSS = (css: string): string => {
    // Basic CSS formatting
    let formatted = css
      .replace(/\s*{\s*/g, ' {\n  ')
      .replace(/\s*}\s*/g, '\n}\n')
      .replace(/\s*;\s*/g, ';\n  ')
      .replace(/\s*:\s*/g, ': ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    return formatted;
  };

  const formatPython = (code: string): string => {
    // Python already uses indentation, just normalize
    const lines = code.split('\n');
    return lines.map(line => line.trimEnd()).join('\n');
  };

  const formatXML = (xml: string): string => {
    // Similar to HTML
    return formatHTML(xml);
  };

  const formatSQL = (sql: string): string => {
    // Basic SQL formatting (uppercase keywords, indentation)
    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP'];
    let formatted = sql.toUpperCase();

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      formatted = formatted.replace(regex, keyword);
    });

    // Basic indentation
    formatted = formatted
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',\n  ')
      .replace(/\s+FROM\s+/gi, '\nFROM ')
      .replace(/\s+WHERE\s+/gi, '\nWHERE ')
      .replace(/\s+JOIN\s+/gi, '\nJOIN ')
      .replace(/\s+GROUP BY\s+/gi, '\nGROUP BY ')
      .replace(/\s+ORDER BY\s+/gi, '\nORDER BY ');

    return formatted.trim();
  };

  const formatYAML = (yaml: string): string => {
    // Basic YAML formatting (normalize indentation)
    const lines = yaml.split('\n');
    return lines.map(line => line.trimEnd()).join('\n');
  };

  const formatTwig = (twig: string): string => {
    // Format Twig templates (handles Twig tags, HTML, and embedded JS/CSS)
    let formatted = twig;
    
    // Normalize Twig tags spacing
    formatted = formatted
      .replace(/\{%\s+/g, '{% ')
      .replace(/\s+%\}/g, ' %}')
      .replace(/\{\{\s+/g, '{{ ')
      .replace(/\s+\}\}/g, ' }}')
      .replace(/\{#\s+/g, '{# ')
      .replace(/\s+#\}/g, ' #}');
    
    // Split by lines and format
    const lines = formatted.split('\n');
    let indent = 0;
    const indentSize = 2;
    const result: string[] = [];
    let inScriptTag = false;
    let inStyleTag = false;
    
    const twigEndTags = ['endif', 'endfor', 'endblock', 'endmacro', 'endembed', 'endfilter', 'endspaceless', 'endverbatim', 'endapply', 'endset', 'else', 'elseif'];
    const twigStartTags = ['if', 'for', 'block', 'macro', 'embed', 'filter', 'spaceless', 'verbatim', 'apply', 'set'];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        result.push('');
        continue;
      }
      
      // Check if we're entering/leaving script or style tags
      if (trimmed.match(/<script[^>]*>/i)) {
        inScriptTag = true;
      } else if (trimmed.match(/<\/script>/i)) {
        inScriptTag = false;
      } else if (trimmed.match(/<style[^>]*>/i)) {
        inStyleTag = true;
      } else if (trimmed.match(/<\/style>/i)) {
        inStyleTag = false;
      }
      
      // Check for Twig end tags
      const hasEndTag = twigEndTags.some(tag => trimmed.match(new RegExp(`\\{%\\s*${tag}\\s*%\\}`, 'i')));
      const hasStartTag = twigStartTags.some(tag => trimmed.match(new RegExp(`\\{%\\s*${tag}\\s*`, 'i')));
      
      // Handle Twig block endings and HTML closing tags
      if (hasEndTag || trimmed.match(/^<\/[^>]+>\s*$/)) {
        indent = Math.max(0, indent - indentSize);
      }
      
      // Format based on context
      if (inScriptTag && !trimmed.match(/<\/?script/i)) {
        // Format JavaScript inside script tags
        result.push(' '.repeat(indent) + trimmed);
      } else if (inStyleTag && !trimmed.match(/<\/?style/i)) {
        // Format CSS inside style tags
        result.push(' '.repeat(indent) + trimmed);
      } else {
        // Format Twig/HTML
        result.push(' '.repeat(indent) + trimmed);
      }
      
      // Handle Twig block starts and HTML opening tags
      if (hasStartTag || (trimmed.match(/<[^/!][^>]*>/) && !trimmed.match(/\/>/) && !trimmed.match(/<\/[^>]+>/))) {
        indent += indentSize;
      }
    }
    
    return result.join('\n');
  };

  const formatPHP = (php: string): string => {
    // Format PHP code (handles PHP tags, HTML, and embedded JS/CSS)
    let formatted = php;
    
    // Normalize PHP tags spacing
    formatted = formatted
      .replace(/<\?php\s+/g, '<?php ')
      .replace(/\s+\?>/g, ' ?>')
      .replace(/<\?=\s+/g, '<?= ')
      .replace(/\s+\?>/g, ' ?>');
    
    // Split by lines and format
    const lines = formatted.split('\n');
    let indent = 0;
    const indentSize = 2;
    const result: string[] = [];
    let inPhpBlock = false;
    let inScriptTag = false;
    let inStyleTag = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        result.push('');
        continue;
      }
      
      // Track PHP blocks
      if (trimmed.match(/<\?php/i) || trimmed.match(/<\?=/)) {
        inPhpBlock = true;
      } else if (trimmed.match(/\?>/)) {
        inPhpBlock = false;
      }
      
      // Track script/style tags
      if (trimmed.match(/<script[^>]*>/i)) {
        inScriptTag = true;
      } else if (trimmed.match(/<\/script>/i)) {
        inScriptTag = false;
      } else if (trimmed.match(/<style[^>]*>/i)) {
        inStyleTag = true;
      } else if (trimmed.match(/<\/style>/i)) {
        inStyleTag = false;
      }
      
      // Handle closing tags/blocks
      if (trimmed.match(/^\?>\s*$/) || trimmed.match(/^}\s*$/) || trimmed.match(/^<\/[^>]+>\s*$/)) {
        indent = Math.max(0, indent - indentSize);
      }
      
      // Format based on context
      if (inPhpBlock && !trimmed.match(/<\?php/i) && !trimmed.match(/<\?=/) && !trimmed.match(/\?>/)) {
        // Format PHP code
        // Handle PHP control structures
        if (trimmed.match(/^(if|elseif|else|for|foreach|while|do|switch|case|default|function|class|namespace|trait|interface)\s*\(/)) {
          result.push(' '.repeat(indent) + trimmed);
          if (trimmed.match(/\{\s*$/)) {
            indent += indentSize;
          }
        } else if (trimmed.match(/^}\s*$/)) {
          indent = Math.max(0, indent - indentSize);
          result.push(' '.repeat(indent) + trimmed);
        } else {
          result.push(' '.repeat(indent) + trimmed);
        }
      } else if (inScriptTag && !trimmed.match(/<\/?script/i)) {
        // Format JavaScript
        result.push(' '.repeat(indent) + trimmed);
      } else if (inStyleTag && !trimmed.match(/<\/?style/i)) {
        // Format CSS
        result.push(' '.repeat(indent) + trimmed);
      } else {
        // Format HTML
        if (trimmed.match(/<\/[^>]+>/)) {
          indent = Math.max(0, indent - indentSize);
        }
        result.push(' '.repeat(indent) + trimmed);
        if (trimmed.match(/<[^/!][^>]*>/) && !trimmed.match(/\/>/) && !trimmed.match(/<\/[^>]+>/)) {
          indent += indentSize;
        }
      }
    }
    
    return result.join('\n');
  };

  const handleCopy = () => {
    if (output) {
      navigator.clipboard.writeText(output).then(() => {
        console.log('[Formatter] Code formaté copié avec succès');
      }).catch((error) => {
        console.error('[Formatter] Erreur lors de la copie:', error);
      });
    }
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError('');
  };

  const handleSwap = () => {
    if (output) {
      setInput(output);
      setOutput('');
      setError('');
    }
  };

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backButton}>
        ← Retour
      </Link>
      <h1 className={styles.title}>✨ Formateur de Code</h1>

      <div className={styles.controls}>
        <div className={styles.languageSelector}>
          <label htmlFor="language" className={styles.label}>Langage :</label>
          <select
            id="language"
            className={styles.select}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {Object.entries(LANGUAGES).map(([key, config]) => (
              <option key={key} value={key}>
                {config.emoji} {config.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <button onClick={formatCode} className={styles.button}>
            ✨ Formater
          </button>
          <button onClick={handleCopy} className={styles.button} disabled={!output}>
            📋 Copier
          </button>
          <button onClick={handleSwap} className={styles.button} disabled={!output}>
            ↔️ Échanger
          </button>
          <button onClick={handleClear} className={styles.button}>
            🗑️ Effacer
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          ⚠️ {error}
        </div>
      )}

      <div className={styles.editorContainer}>
        <div className={styles.editorSection}>
          <div className={styles.editorHeader}>
            <span className={styles.editorLabel}>Code source</span>
            <span className={styles.editorInfo}>{LANGUAGES[language].emoji} {LANGUAGES[language].name}</span>
          </div>
          <textarea
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Collez votre code ${LANGUAGES[language].name} ici...`}
            spellCheck={false}
          />
        </div>

        <div className={styles.editorSection}>
          <div className={styles.editorHeader}>
            <span className={styles.editorLabel}>Code formaté</span>
            <span className={styles.editorInfo}>{output ? `${output.split('\n').length} lignes` : '—'}</span>
          </div>
          <textarea
            className={styles.textarea}
            value={output}
            readOnly
            placeholder="Le code formaté apparaîtra ici..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
