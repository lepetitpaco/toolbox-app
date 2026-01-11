'use client';

import { useState, useRef, useEffect } from 'react';
import styles from '../calculator.module.css';

interface WindowProps {
  id: string;
  title: string;
  content: string;
  onContentChange: (content: string) => void;
  onClose: () => void;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  zIndex: number;
  onFocus: () => void;
  isFocused: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  currentLinePreview?: { result: number; line: number } | null;
  onSelectionChange?: (selectionStart: number) => void;
}

export default function Window({
  id,
  title,
  content,
  onContentChange,
  onClose,
  onPositionChange,
  onSizeChange,
  initialPosition,
  initialSize,
  zIndex,
  onFocus,
  isFocused,
  onKeyDown,
  currentLinePreview,
  onSelectionChange,
}: WindowProps) {
  const [position, setPosition] = useState(initialPosition || { x: 100, y: 100 });
  const [size, setSize] = useState(initialSize || { width: 500, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ 
    mouseX: 0, 
    mouseY: 0, 
    windowX: 0, 
    windowY: 0 
  });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialPosition) setPosition(initialPosition);
  }, [initialPosition]);

  useEffect(() => {
    if (initialSize) setSize(initialSize);
  }, [initialSize]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on the close button
    const target = e.target as HTMLElement;
    if (target.closest('.windowButtonClose')) {
      return;
    }
    
    // Allow dragging from anywhere in the header
    if (headerRef.current?.contains(target)) {
      e.preventDefault();
      setIsDragging(true);
      // Store the mouse position and window position at the start of drag
      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        windowX: position.x,
        windowY: position.y,
      });
      onFocus();
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: rect.width,
        height: rect.height,
      });
      onFocus();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        // Calculate the delta from the initial mouse position
        const deltaX = e.clientX - dragStart.mouseX;
        const deltaY = e.clientY - dragStart.mouseY;
        // Apply the delta to the initial window position
        const newPosition = {
          x: dragStart.windowX + deltaX,
          y: dragStart.windowY + deltaY,
        };
        setPosition(newPosition);
        onPositionChange?.(newPosition);
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newSize = {
          width: Math.max(300, resizeStart.width + deltaX),
          height: Math.max(200, resizeStart.height + deltaY),
        };
        setSize(newSize);
        onSizeChange?.(newSize);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      // Restore text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, size, onPositionChange, onSizeChange]);

  return (
    <div
      ref={windowRef}
      className={`${styles.window} ${isFocused ? styles.windowFocused : ''} ${isDragging ? styles.windowDragging : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex,
      }}
      onClick={onFocus}
    >
      <div
        ref={headerRef}
        className={`${styles.windowHeader} ${isDragging ? styles.windowHeaderDragging : ''}`}
        onMouseDown={handleHeaderMouseDown}
      >
        <div className={styles.windowButtons}>
          <button 
            className={styles.windowButtonClose} 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }} 
            title="Close"
          >
            <span>×</span>
          </button>
        </div>
        <div className={styles.windowTitle}>{title}</div>
      </div>
      <div className={styles.windowBody}>
        <div className={styles.windowTextareaContainer}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyDown={onKeyDown}
            onSelect={(e) => {
              onSelectionChange?.(e.currentTarget.selectionStart);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectionChange?.(e.currentTarget.selectionStart);
            }}
            className={styles.windowTextarea}
            placeholder="Type calculations like: 1+1 and press Enter..."
            spellCheck={false}
          />
          {currentLinePreview && textareaRef.current && (
            <div
              className={styles.windowPreview}
              style={{
                top: `${(currentLinePreview.line + 1) * 1.8}rem`
              }}
            >
              = {Number.isInteger(currentLinePreview.result) ? currentLinePreview.result : currentLinePreview.result.toFixed(2)}
            </div>
          )}
        </div>
      </div>
      <div
        className={styles.windowResizeHandle}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
}
