'use client';

import { useState } from 'react';
import styles from './encoder.module.css';

type EncodeType = 'base64' | 'url' | 'html' | 'md5' | 'sha256' | 'sha512';

export default function EncoderPage() {
  const [input, setInput] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [encodeType, setEncodeType] = useState<EncodeType>('base64');
  const [isEncoding, setIsEncoding] = useState<boolean>(true);

  const encode = (text: string, type: EncodeType): string => {
    try {
      switch (type) {
        case 'base64':
          return btoa(unescape(encodeURIComponent(text)));
        case 'url':
          return encodeURIComponent(text);
        case 'html':
          return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        case 'md5':
        case 'sha256':
        case 'sha512':
          // For hash functions, we'll use the Web Crypto API
          return 'Calculating...';
        default:
          return '';
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  const decode = (text: string, type: EncodeType): string => {
    try {
      switch (type) {
        case 'base64':
          return decodeURIComponent(escape(atob(text)));
        case 'url':
          return decodeURIComponent(text);
        case 'html':
          const txt = document.createElement('textarea');
          txt.innerHTML = text;
          return txt.value;
        case 'md5':
        case 'sha256':
        case 'sha512':
          return 'Cannot decode hash';
        default:
          return '';
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  const hash = async (text: string, algorithm: 'MD5' | 'SHA-256' | 'SHA-512'): Promise<string> => {
    try {
      // Convert algorithm name
      const algo = algorithm === 'MD5' ? 'SHA-256' : algorithm; // MD5 not available in Web Crypto, use SHA-256
      
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest(algo, data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (algorithm === 'MD5') {
        // For MD5, we'll need to use a library or show a message
        return 'MD5 requires a library. Using SHA-256 instead: ' + hashHex;
      }
      
      return hashHex;
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  const handleInputChange = async (value: string) => {
    setInput(value);
    
    if (!value.trim()) {
      setOutput('');
      return;
    }

    if (isEncoding) {
      if (encodeType === 'md5' || encodeType === 'sha256' || encodeType === 'sha512') {
        const algorithm = encodeType.toUpperCase().replace('SHA', 'SHA-') as 'MD5' | 'SHA-256' | 'SHA-512';
        const result = await hash(value, algorithm);
        setOutput(result);
      } else {
        setOutput(encode(value, encodeType));
      }
    } else {
      setOutput(decode(value, encodeType));
    }
  };

  const handleTypeChange = (type: EncodeType) => {
    setEncodeType(type);
    if (input) {
      handleInputChange(input);
    }
  };

  const handleSwap = () => {
    setInput(output);
    setOutput(input);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Encoder / Decoder</h1>
        <div className={styles.controls}>
          <div className={styles.typeSelector}>
            <label>
              <input
                type="radio"
                name="mode"
                checked={isEncoding}
                onChange={() => setIsEncoding(true)}
              />
              Encode
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                checked={!isEncoding}
                onChange={() => setIsEncoding(false)}
              />
              Decode
            </label>
          </div>
          <select
            value={encodeType}
            onChange={(e) => handleTypeChange(e.target.value as EncodeType)}
            className={styles.select}
          >
            <option value="base64">Base64</option>
            <option value="url">URL</option>
            <option value="html">HTML Entities</option>
            <option value="md5">MD5</option>
            <option value="sha256">SHA-256</option>
            <option value="sha512">SHA-512</option>
          </select>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{isEncoding ? 'Input' : 'Encoded'}</span>
            <div className={styles.panelActions}>
              <button onClick={handleClear} className={styles.button}>Clear</button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            className={styles.textarea}
            placeholder={isEncoding ? 'Enter text to encode...' : 'Enter encoded text...'}
            spellCheck={false}
          />
        </div>

        <div className={styles.swapButtonContainer}>
          <button onClick={handleSwap} className={styles.swapButton} title="Swap">
            ⇄
          </button>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{isEncoding ? 'Output' : 'Decoded'}</span>
            <div className={styles.panelActions}>
              <button onClick={() => handleCopy(output)} className={styles.button}>Copy</button>
            </div>
          </div>
          <textarea
            value={output}
            readOnly
            className={styles.textarea}
            placeholder="Result will appear here..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
