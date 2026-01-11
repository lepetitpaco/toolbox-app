'use client';

import { useState, useCallback, useEffect } from 'react';
import styles from './file-diff.module.css';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: { left?: number; right?: number };
}

interface SplitDiffLine {
  left?: { content: string; lineNumber: number; type: 'removed' | 'unchanged' };
  right?: { content: string; lineNumber: number; type: 'added' | 'unchanged' };
}

type ViewMode = 'unified' | 'split';

export default function FileDiffPage() {
  const [file1, setFile1] = useState<string>('');
  const [file2, setFile2] = useState<string>('');
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [splitDiffLines, setSplitDiffLines] = useState<SplitDiffLine[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');

  const calculateDiff = useCallback(() => {
    if (!file1 && !file2) {
      setDiffLines([]);
      return;
    }

    const lines1 = file1.split('\n');
    const lines2 = file2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    const newDiffLines: DiffLine[] = [];

    let lineNum1 = 1;
    let lineNum2 = 1;

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === undefined && line2 !== undefined) {
        // Ligne ajoutée dans file2
        newDiffLines.push({
          type: 'added',
          content: line2,
          lineNumber: { right: lineNum2++ }
        });
      } else if (line1 !== undefined && line2 === undefined) {
        // Ligne supprimée de file1
        newDiffLines.push({
          type: 'removed',
          content: line1,
          lineNumber: { left: lineNum1++ }
        });
      } else if (line1 === line2) {
        // Ligne identique
        newDiffLines.push({
          type: 'unchanged',
          content: line1,
          lineNumber: { left: lineNum1++, right: lineNum2++ }
        });
      } else {
        // Lignes différentes
        newDiffLines.push({
          type: 'removed',
          content: line1,
          lineNumber: { left: lineNum1++ }
        });
        newDiffLines.push({
          type: 'added',
          content: line2,
          lineNumber: { right: lineNum2++ }
        });
      }
    }

    setDiffLines(newDiffLines);

    // Calculate split view
    const splitLines: SplitDiffLine[] = [];
    let leftLineNum = 1;
    let rightLineNum = 1;

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === undefined && line2 !== undefined) {
        // Only in right
        splitLines.push({
          right: { content: line2, lineNumber: rightLineNum++, type: 'added' }
        });
      } else if (line1 !== undefined && line2 === undefined) {
        // Only in left
        splitLines.push({
          left: { content: line1, lineNumber: leftLineNum++, type: 'removed' }
        });
      } else if (line1 === line2) {
        // Same in both
        splitLines.push({
          left: { content: line1, lineNumber: leftLineNum++, type: 'unchanged' },
          right: { content: line2, lineNumber: rightLineNum++, type: 'unchanged' }
        });
      } else {
        // Different
        splitLines.push({
          left: { content: line1, lineNumber: leftLineNum++, type: 'removed' },
          right: { content: line2, lineNumber: rightLineNum++, type: 'added' }
        });
      }
    }

    setSplitDiffLines(splitLines);
  }, [file1, file2]);

  const handleFile1Change = (value: string) => {
    setFile1(value);
  };

  const handleFile2Change = (value: string) => {
    setFile2(value);
  };

  const handleSwap = () => {
    const temp = file1;
    setFile1(file2);
    setFile2(temp);
  };

  const handleClear = () => {
    setFile1('');
    setFile2('');
    setDiffLines([]);
  };

  // Auto-calculate diff when files change
  useEffect(() => {
    calculateDiff();
  }, [calculateDiff]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>📊 Diff de Fichiers</h1>

      <div className={styles.controls}>
        <div className={styles.viewModeSelector}>
          <button
            onClick={() => setViewMode('unified')}
            className={`${styles.viewModeButton} ${viewMode === 'unified' ? styles.viewModeButtonActive : ''}`}
          >
            📄 Unifié
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`${styles.viewModeButton} ${viewMode === 'split' ? styles.viewModeButtonActive : ''}`}
          >
            ↔️ Côte à côte
          </button>
        </div>
        <div className={styles.actions}>
          <button onClick={calculateDiff} className={styles.button}>
            🔄 Calculer le Diff
          </button>
          <button onClick={handleSwap} className={styles.button}>
            ↔️ Échanger
          </button>
          <button onClick={handleClear} className={styles.button}>
            🗑️ Effacer
          </button>
        </div>
      </div>

      <div className={styles.filesContainer}>
        <div className={styles.fileSection}>
          <div className={styles.fileHeader}>
            <span className={styles.fileLabel}>Fichier 1</span>
            <span className={styles.fileInfo}>({file1.split('\n').length} lignes)</span>
          </div>
          <textarea
            className={styles.textarea}
            value={file1}
            onChange={(e) => handleFile1Change(e.target.value)}
            placeholder="Collez le contenu du premier fichier ici..."
            spellCheck={false}
          />
        </div>

        <div className={styles.fileSection}>
          <div className={styles.fileHeader}>
            <span className={styles.fileLabel}>Fichier 2</span>
            <span className={styles.fileInfo}>({file2.split('\n').length} lignes)</span>
          </div>
          <textarea
            className={styles.textarea}
            value={file2}
            onChange={(e) => handleFile2Change(e.target.value)}
            placeholder="Collez le contenu du deuxième fichier ici..."
            spellCheck={false}
          />
        </div>
      </div>

      {viewMode === 'unified' && diffLines.length > 0 && (
        <div className={styles.diffContainer}>
          <div className={styles.diffHeader}>
            <span className={styles.diffTitle}>Diff (Vue unifiée)</span>
            <span className={styles.diffInfo}>
              {diffLines.filter(l => l.type === 'added').length} ajouts,{' '}
              {diffLines.filter(l => l.type === 'removed').length} suppressions
            </span>
          </div>
          <div className={styles.diffContent}>
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={`${styles.diffLine} ${styles[`diffLine${line.type.charAt(0).toUpperCase() + line.type.slice(1)}`]}`}
              >
                <div className={styles.diffLineNumbers}>
                  {line.lineNumber?.left !== undefined && (
                    <span className={styles.lineNumber}>{line.lineNumber.left}</span>
                  )}
                  {line.lineNumber?.right !== undefined && (
                    <span className={styles.lineNumber}>{line.lineNumber.right}</span>
                  )}
                </div>
                <div className={styles.diffLineContent}>
                  {line.type === 'added' && <span className={styles.diffMarker}>+</span>}
                  {line.type === 'removed' && <span className={styles.diffMarker}>-</span>}
                  {line.type === 'unchanged' && <span className={styles.diffMarker}> </span>}
                  <span className={styles.diffText}>{line.content || ' '}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'split' && splitDiffLines.length > 0 && (
        <div className={styles.splitDiffContainer}>
          <div className={styles.splitDiffHeader}>
            <div className={styles.splitDiffHeaderLeft}>
              <span className={styles.splitDiffTitle}>Fichier 1</span>
              <span className={styles.splitDiffInfo}>
                {splitDiffLines.filter(l => l.left).length} lignes
              </span>
            </div>
            <div className={styles.splitDiffHeaderRight}>
              <span className={styles.splitDiffTitle}>Fichier 2</span>
              <span className={styles.splitDiffInfo}>
                {splitDiffLines.filter(l => l.right).length} lignes
              </span>
            </div>
          </div>
          <div className={styles.splitDiffContent}>
            {splitDiffLines.map((line, index) => (
              <div key={index} className={styles.splitDiffRow}>
                <div className={`${styles.splitDiffCell} ${line.left ? styles[`splitDiffCell${line.left.type.charAt(0).toUpperCase() + line.left.type.slice(1)}`] : styles.splitDiffCellEmpty}`}>
                  {line.left && (
                    <>
                      <span className={styles.splitLineNumber}>{line.left.lineNumber}</span>
                      <span className={styles.splitDiffMarker}>
                        {line.left.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className={styles.splitDiffText}>{line.left.content || ' '}</span>
                    </>
                  )}
                </div>
                <div className={`${styles.splitDiffCell} ${line.right ? styles[`splitDiffCell${line.right.type.charAt(0).toUpperCase() + line.right.type.slice(1)}`] : styles.splitDiffCellEmpty}`}>
                  {line.right && (
                    <>
                      <span className={styles.splitLineNumber}>{line.right.lineNumber}</span>
                      <span className={styles.splitDiffMarker}>
                        {line.right.type === 'added' ? '+' : ' '}
                      </span>
                      <span className={styles.splitDiffText}>{line.right.content || ' '}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
