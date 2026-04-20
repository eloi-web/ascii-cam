import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, VideoOff, Circle, Palette, Square, Camera, Search, SlidersHorizontal, Crosshair, Monitor, Copy, Check, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CHARSETS = [
  { id: 'standard', name: 'Standard', chars: ' .:-=+*#%@' },
  { id: 'binary', name: 'Binary', chars: '01' },
  { id: 'blocks', name: 'Blocks', chars: ' ░▒▓█' },
  { id: 'dots', name: 'Dots', chars: ' ·•●' },
  { id: 'minimal', name: 'Minimal', chars: ' .:#' },
  { id: 'braille', name: 'Braille', chars: ' ⠁⠃⠇⠏⠟⠿⡿⣿' },
];

const PALETTES = [
  { id: 'truecolor', hex: 'conic-gradient(from 90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)', isGradient: true },
  { id: 'mint', hex: '#8ee817' },
  { id: 'forest', hex: '#2a874d' },
  { id: 'sun', hex: '#ffdb79' },
  { id: 'white', hex: '#ffffff' },
  { id: 'cyan', hex: '#00d4ff' },
  { id: 'magenta', hex: '#ff00ff' },
  { id: 'red', hex: '#ff4444' },
  { id: 'ocean', hex: '#0077ff' },
  { id: 'pink', hex: '#ffb4ab' },
  { id: 'purple', hex: '#a855f7' },
];

const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
  return (
    <div className="group relative flex justify-center items-center">
      {children}
      <div className="absolute bottom-full mb-4 glass-panel px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold text-mint-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none scale-95 group-hover:scale-100 origin-bottom">
        {text}
      </div>
    </div>
  )
}

export default function App() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [fps, setFps] = useState(0);
  const [gridSize, setGridSize] = useState({ cols: 120, rows: 72 });
  const [zoom, setZoom] = useState(1);
  const [fontSize, setFontSize] = useState(14);
  const [contrast, setContrast] = useState(1.5);
  const [gain, setGain] = useState(1.0);
  const [charsetIndex, setCharsetIndex] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [focusIntensity, setFocusIntensity] = useState(0.85);
  const [showSettings, setShowSettings] = useState(false);
  const [invertMode, setInvertMode] = useState(false);
  const [crtMode, setCrtMode] = useState(false);
  const [fpsCap, setFpsCap] = useState(30);
  const [copied, setCopied] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const asciiLinesRef = useRef<string[]>([]);

  const initialPinchDistance = useRef<number | null>(null);
  const initialZoomOnPinch = useRef<number>(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const requestRef = useRef<number>(0);
  const lastDrawTime = useRef<number>(0);
  const framesThisSecond = useRef<number>(0);
  const lastFpsTime = useRef<number>(0);

  const currentPalette = PALETTES[paletteIndex];

  useEffect(() => {
    const handleResize = () => {
      const charW = fontSize * 0.6;
      const cols = Math.max(40, Math.floor(window.innerWidth / charW));
      const rows = Math.max(20, Math.floor(window.innerHeight / fontSize));
      setGridSize({ cols, rows });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fontSize]);

  const processFrame = useCallback((time: number) => {
    if (!isCameraActive || !videoRef.current || !pixelCanvasRef.current || !displayCanvasRef.current) return;

    if (time - lastDrawTime.current < 1000 / fpsCap) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastDrawTime.current = time;

    framesThisSecond.current++;
    if (time - lastFpsTime.current >= 1000) {
      setFps(framesThisSecond.current);
      framesThisSecond.current = 0;
      lastFpsTime.current = time;
    }

    const video = videoRef.current;
    if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const pCanvas = pixelCanvasRef.current;
    const dCanvas = displayCanvasRef.current;
    const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });
    // Use alpha true to allow canvas compositing for truecolor mode
    const dCtx = dCanvas.getContext('2d', { alpha: true });

    if (!pCtx || !dCtx) return;

    const cols = gridSize.cols;
    const rows = gridSize.rows > 0 ? gridSize.rows : Math.max(1, Math.floor((cols / (video.videoWidth / video.videoHeight)) * 0.6));

    if (pCanvas.width !== cols) pCanvas.width = cols;
    if (pCanvas.height !== rows) pCanvas.height = rows;

    // Cover crop: fill the grid, cropping the video as needed
    const displayAspect = (cols * 0.6) / rows;
    const baseW = video.videoWidth / zoom;
    const baseH = video.videoHeight / zoom;
    const videoAspect = baseW / baseH;
    let sWidth, sHeight;
    if (videoAspect > displayAspect) {
      sHeight = baseH;
      sWidth = baseH * displayAspect;
    } else {
      sWidth = baseW;
      sHeight = baseW / displayAspect;
    }
    const sx = (video.videoWidth - sWidth) / 2;
    const sy = (video.videoHeight - sHeight) / 2;

    pCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, cols, rows);
    const pixels = pCtx.getImageData(0, 0, cols, rows).data;

    dCtx.font = `bold ${fontSize}px "DM Sans Mono", monospace`;
    const charWidth = dCtx.measureText('M').width || fontSize * 0.6;
    const charHeight = fontSize;

    const dWidth = Math.ceil(cols * charWidth);
    const dHeight = Math.ceil(rows * charHeight);

    if (dCanvas.width !== dWidth) {
      dCanvas.width = dWidth;
    }
    if (dCanvas.height !== dHeight) {
      dCanvas.height = dHeight;
    }

    dCtx.font = `bold ${fontSize}px "DM Sans Mono", monospace`;
    dCtx.textBaseline = "top";

    const isTrueColor = currentPalette.id === 'truecolor';
    const activeChars = CHARSETS[charsetIndex].chars;
    const cx = cols / 2;
    const cy = rows / 2;
    let asciiLines = [];

    for (let y = 0; y < rows; y++) {
      let rowStr = '';
      for (let x = 0; x < cols; x++) {
        const mirrorX = cols - 1 - x;
        const i = (y * cols + mirrorX) * 4;
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        // Luminance → apply gain → apply contrast
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        let adjusted = luma * gain;
        adjusted = ((adjusted / 255 - 0.5) * contrast + 0.5) * 255;

        // Elliptical focus vignette (portrait-weighted for human subjects)
        if (focusMode) {
          const nx = (x - cx) / cx, ny = (y - cy) / cy;
          const normDist = nx * nx * 1.3 + ny * ny * 0.7;
          const falloff = Math.max(0, 1 - normDist * focusIntensity * 1.8);
          adjusted *= falloff * falloff;
        }

        adjusted = Math.max(0, Math.min(255, adjusted));
        let mappedIndex = Math.floor((adjusted / 255) * (activeChars.length - 1));
        if (invertMode) mappedIndex = activeChars.length - 1 - mappedIndex;
        rowStr += activeChars[mappedIndex];
      }
      asciiLines.push(rowStr);
    }

    if (isTrueColor) {
      // Draw White Text
      dCtx.clearRect(0, 0, dWidth, dHeight);
      dCtx.fillStyle = '#ffffff';
      for (let y = 0; y < rows; y++) {
        dCtx.fillText(asciiLines[y], 0, y * charHeight);
      }

      // Mask Video over Text
      dCtx.globalCompositeOperation = 'source-in';
      dCtx.save();
      // Mirror video visually to match mirrored text!
      dCtx.translate(dWidth, 0);
      dCtx.scale(-1, 1);
      dCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, dWidth, dHeight);
      dCtx.restore();

      // Background behind everything
      dCtx.globalCompositeOperation = 'destination-over';
      dCtx.fillStyle = '#111411';
      dCtx.fillRect(0, 0, dWidth, dHeight);
      dCtx.globalCompositeOperation = 'source-over'; // Reset
    } else {
      dCtx.fillStyle = '#111411';
      dCtx.fillRect(0, 0, dWidth, dHeight);

      dCtx.fillStyle = currentPalette.hex;
      for (let y = 0; y < rows; y++) {
        dCtx.fillText(asciiLines[y], 0, y * charHeight);
      }
    }

    asciiLinesRef.current = asciiLines;
    requestRef.current = requestAnimationFrame(processFrame);
  }, [isCameraActive, zoom, gridSize.cols, gridSize.rows, currentPalette, fontSize, contrast, gain, charsetIndex, focusMode, focusIntensity, invertMode, fpsCap]);

  useEffect(() => {
    if (isCameraActive) {
      requestRef.current = requestAnimationFrame(processFrame);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isCameraActive, processFrame]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleCamera = async () => {
    if (isCameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
      if (isRecording) toggleRecord(); // Stop recording if active
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              setIsCameraActive(true);
            } catch (playError) {
              console.error("Play prevented", playError);
            }
          };
        }
      } catch (err) {
        console.error("Camera access denied or failed", err);
        alert("Camera access denied. Please allow camera permissions to use this feature.");
      }
    }
  };

  const toggleRecord = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!displayCanvasRef.current) return;

      recordedChunksRef.current = [];
      const stream = displayCanvasRef.current.captureStream(30);

      let mimeType = '';
      if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) mimeType = 'video/webm; codecs=vp9';
      else if (MediaRecorder.isTypeSupported('video/webm')) mimeType = 'video/webm';
      else if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';

      const options = mimeType ? { mimeType } : undefined;
      let mr;
      try {
        mr = new MediaRecorder(stream, options);
      } catch (e) {
        mr = new MediaRecorder(stream);
      }

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const fallbackType = mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: fallbackType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascii-rec-${Date.now()}.${fallbackType.includes('mp4') ? 'mp4' : 'webm'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setRecordTime(0);
      setIsRecording(true);
    }
  };

  const capturePhoto = () => {
    if (!displayCanvasRef.current) return;
    const dataUrl = displayCanvasRef.current.toDataURL("image/jpeg", 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `ascii-cam-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyAsciiToClipboard = async () => {
    const lines = asciiLinesRef.current;
    if (!lines.length) return;
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ASCII to clipboard', err);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          toggleCamera();
          break;
        case 'r':
          if (isCameraActive) toggleRecord();
          break;
        case 'f':
          setFocusMode(prev => !prev);
          break;
        case 'c':
          if (isCameraActive) capturePhoto();
          break;
        case 'i':
          setInvertMode(prev => !prev);
          break;
        case 'e':
          if (isCameraActive) copyAsciiToClipboard();
          break;
        case 't':
          setCrtMode(prev => !prev);
          break;
        case '?':
          setShowShortcuts(prev => !prev);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isCameraActive, isRecording]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistance.current = dist;
      initialZoomOnPinch.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / initialPinchDistance.current;
      const newZoom = Math.max(1, Math.min(5, initialZoomOnPinch.current * scale));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistance.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="bg-surface text-moss-400 font-body min-h-screen flex flex-col relative overflow-hidden select-none touch-none"
    >
      <video ref={videoRef} autoPlay playsInline muted className="absolute opacity-0 pointer-events-none w-1 h-1 -top-10" />
      <canvas ref={pixelCanvasRef} className="absolute opacity-0 pointer-events-none w-1 h-1 -top-10" />

      {/* Main Container */}
      <div className="fixed inset-0 w-full h-full z-0 bg-surface">
        <canvas
          ref={displayCanvasRef}
          className={`w-full h-full transition-opacity duration-500 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
        />
        {/* CRT Scanline Overlay */}
        {crtMode && isCameraActive && (
          <div className="absolute inset-0 pointer-events-none z-10 crt-overlay" />
        )}
        <AnimatePresence>
          {!isCameraActive && (
            <motion.div
              key="standby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-moss-500 pointer-events-none"
            >
              <VideoOff className="w-24 h-24 mb-4 opacity-50" strokeWidth={1} />
              <p className="font-mono text-sm tracking-widest uppercase">Signal Lost // Awaiting Input</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top HUD */}
      <header className="fixed w-full z-40 top-0 left-0 p-4 sm:p-6 pointer-events-none">
        <div className="flex justify-between items-start w-full max-w-7xl mx-auto pointer-events-auto">
          {/* Top Left: Logo & Rec */}
          <div className="flex flex-col gap-4">
            <div className="glass-panel px-4 sm:px-6 py-2 sm:py-3 rounded-full flex items-center border border-mint-500/20">
              <div className="text-xl sm:text-2xl font-black tracking-[-0.05em] text-mint-500 font-headline uppercase leading-none">
                ASCII CAM
              </div>
            </div>

            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] text-sun-500 font-bold uppercase tracking-wider flex items-center gap-2 w-fit border border-sun-500/20 shadow-[0_0_15px_rgba(255,219,121,0.2)]"
                >
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-2 h-2 rounded-full bg-sun-500"
                  />
                  REC {formatTime(recordTime)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Top Right: Nav & Settings Check */}
          <div className="flex flex-col items-end gap-3 sm:gap-4">
            <nav className="flex gap-1 sm:gap-2 items-center font-headline tracking-tighter uppercase font-medium glass-panel px-2 sm:px-4 py-1.5 sm:py-2 rounded-full">
              <a href="https://github.com/eloi-web" className="text-moss-400 hover:text-mint-500 transition-colors flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full disabled">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-github" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
                </svg>
                <span className="hidden md:block text-sm">GitHub</span>
              </a>
            </nav>

            <div className="flex flex-col items-end gap-2 text-moss-400">
              <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider w-fit border border-moss-500/20">
                ISO Auto
              </div>
              {isCameraActive && (
                <>
                  <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider w-fit border border-moss-500/20">
                    GRID {gridSize.cols} COLS
                  </div>
                  <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider w-fit border border-moss-500/20">
                    FPS {fps}
                  </div>
                  <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] text-mint-500 font-bold uppercase tracking-wider w-fit border border-moss-500/20">
                    Zoom {zoom.toFixed(1)}X
                  </div>
                  <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider w-fit border border-moss-500/20">
                    {CHARSETS[charsetIndex].name} {fontSize}px
                  </div>
                  {focusMode && (
                    <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] text-mint-500 font-bold uppercase tracking-wider w-fit border border-mint-500/20 shadow-[0_0_10px_rgba(142,232,23,0.15)]">
                      <Crosshair className="w-3 h-3 inline mr-1" /> Focus {(focusIntensity * 100).toFixed(0)}%
                    </div>
                  )}
                  {invertMode && (
                    <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] text-sun-500 font-bold uppercase tracking-wider w-fit border border-sun-500/20">
                      <ArrowUpDown className="w-3 h-3 inline mr-1" /> Inverted
                    </div>
                  )}
                  {crtMode && (
                    <div className="glass-panel px-3 py-1.5 rounded-full font-mono text-[10px] text-mint-500 font-bold uppercase tracking-wider w-fit border border-mint-500/20">
                      <Monitor className="w-3 h-3 inline mr-1" /> CRT
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Control Bar */}
      <nav className="fixed bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 z-50 glass-panel rounded-full border border-moss-500/20">
        <Tooltip text={isCameraActive ? "Stop Camera" : "Start Camera"}>
          <button
            onClick={toggleCamera}
            className={`p-3.5 sm:p-3 rounded-full transition-all active:scale-95 ${isCameraActive
              ? 'bg-mint-500 text-surface shadow-[0_0_20px_rgba(0,253,135,0.3)]'
              : 'text-moss-400 hover:text-mint-500 hover:bg-white/5'
              }`}
          >
            <Video className="w-5 h-5" />
          </button>
        </Tooltip>

        <div className="w-px h-6 bg-moss-500/30 mx-0.5 sm:mx-1"></div>

        <Tooltip text={isRecording ? "Stop Recording" : "Record Video"}>
          <button
            onClick={toggleRecord}
            disabled={!isCameraActive}
            className={`p-3.5 sm:p-3 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isRecording
              ? 'text-surface bg-sun-500 shadow-[0_0_20px_rgba(255,219,121,0.3)]'
              : 'text-moss-400 hover:text-sun-500 hover:bg-white/5'
              }`}
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          </button>
        </Tooltip>

        <Tooltip text="Toggle Zoom Slider">
          <button
            onClick={() => setShowZoom(!showZoom)}
            className={`p-3.5 sm:p-3 transition-all active:scale-95 rounded-full flex items-center justify-center ${showZoom ? 'bg-white/10 text-mint-500' : 'text-moss-400 hover:text-mint-500 hover:bg-white/5'}`}
          >
            <Search className="w-5 h-5" />
          </button>
        </Tooltip>

        <div className="relative flex justify-center">
          <Tooltip text="Select Color">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className={`p-3.5 sm:p-3 transition-all active:scale-95 rounded-full flex items-center justify-center relative ${showPalette ? 'bg-white/10 text-mint-500' : 'text-moss-400 hover:text-mint-500 hover:bg-white/5'}`}
            >
              <Palette className="w-5 h-5" />
              <div
                className="absolute top-2 sm:top-2.5 right-2 w-2.5 h-2.5 rounded-full border border-surface shadow-sm"
                style={{ background: currentPalette.isGradient ? currentPalette.hex : currentPalette.hex }}
              />
            </button>
          </Tooltip>

          <AnimatePresence>
            {showPalette && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-22 left-1/2 -translate-x-1/2 sm:absolute sm:bottom-[calc(100%+1rem)] sm:left-auto sm:translate-x-0 glass-panel p-3 rounded-2xl grid grid-cols-6 gap-3 border border-moss-500/30 shadow-2xl origin-bottom w-max"
              >
                {PALETTES.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => { setPaletteIndex(idx); setShowPalette(false); }}
                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-90 ${idx === paletteIndex ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-surface scale-110' : ''}`}
                    style={{ background: p.isGradient ? p.hex : p.hex }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative flex justify-center">
          <Tooltip text="Settings">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-3.5 sm:p-3 transition-all active:scale-95 rounded-full flex items-center justify-center ${showSettings ? 'bg-white/10 text-mint-500' : 'text-moss-400 hover:text-mint-500 hover:bg-white/5'}`}
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </Tooltip>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-22 inset-x-3 sm:absolute sm:bottom-[calc(100%+1rem)] sm:inset-x-auto sm:right-0 sm:w-72 glass-panel p-4 rounded-2xl border border-moss-500/30 shadow-2xl origin-bottom sm:origin-bottom-right overflow-y-auto max-h-[75vh] sm:max-h-none sm:overflow-visible"
              >
                <div className="space-y-4">
                  {/* Font Size */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider">Font Size</label>
                      <span className="text-[10px] font-mono text-mint-500 font-bold">{fontSize}px</span>
                    </div>
                    <input type="range" min="8" max="28" step="1" value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full h-1.5 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-moss-500/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mint-500 cursor-pointer"
                    />
                  </div>

                  {/* Contrast */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider">Contrast</label>
                      <span className="text-[10px] font-mono text-mint-500 font-bold">{contrast.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0.5" max="3.0" step="0.1" value={contrast}
                      onChange={(e) => setContrast(parseFloat(e.target.value))}
                      className="w-full h-1.5 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-moss-500/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mint-500 cursor-pointer"
                    />
                  </div>

                  {/* Gain */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider">Gain</label>
                      <span className="text-[10px] font-mono text-mint-500 font-bold">{gain.toFixed(1)}x</span>
                    </div>
                    <input type="range" min="0.5" max="3.0" step="0.1" value={gain}
                      onChange={(e) => setGain(parseFloat(e.target.value))}
                      className="w-full h-1.5 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-moss-500/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mint-500 cursor-pointer"
                    />
                  </div>

                  {/* Focus */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider">Focus</label>
                      <button
                        onClick={() => setFocusMode(!focusMode)}
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${focusMode ? 'bg-mint-500/20 text-mint-500' : 'text-moss-500 hover:text-moss-400'}`}
                      >
                        {focusMode ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {focusMode && (
                      <input type="range" min="0.1" max="1.0" step="0.05" value={focusIntensity}
                        onChange={(e) => setFocusIntensity(parseFloat(e.target.value))}
                        className="w-full h-1.5 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-moss-500/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mint-500 cursor-pointer"
                      />
                    )}
                  </div>

                  {/* Invert */}
                  <div>
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider">Invert</label>
                      <button
                        onClick={() => setInvertMode(!invertMode)}
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${invertMode ? 'bg-sun-500/20 text-sun-500' : 'text-moss-500 hover:text-moss-400'}`}
                      >
                        {invertMode ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* CRT */}
                  <div>
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider">CRT Effect</label>
                      <button
                        onClick={() => setCrtMode(!crtMode)}
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${crtMode ? 'bg-mint-500/20 text-mint-500' : 'text-moss-500 hover:text-moss-400'}`}
                      >
                        {crtMode ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* FPS Cap */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider">FPS Cap</label>
                      <span className="text-[10px] font-mono text-mint-500 font-bold">{fpsCap}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[15, 30, 60].map((v) => (
                        <button
                          key={v}
                          onClick={() => setFpsCap(v)}
                          className={`text-[10px] font-mono py-1.5 px-2 rounded-full transition-all ${fpsCap === v
                            ? 'bg-mint-500/20 text-mint-500 border border-mint-500/30'
                            : 'text-moss-400 hover:text-mint-500 border border-moss-500/20 hover:border-mint-500/20'
                            }`}
                        >
                          {v} FPS
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Charset */}
                  <div>
                    <label className="text-[10px] font-mono text-moss-400 uppercase tracking-wider block mb-1.5">Charset</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CHARSETS.map((cs, idx) => (
                        <button
                          key={cs.id}
                          onClick={() => setCharsetIndex(idx)}
                          className={`text-[10px] font-mono py-1.5 px-2 rounded-full transition-all ${idx === charsetIndex
                            ? 'bg-mint-500/20 text-mint-500 border border-mint-500/30'
                            : 'text-moss-400 hover:text-mint-500 border border-moss-500/20 hover:border-mint-500/20'
                            }`}
                        >
                          {cs.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-moss-500/30 mx-0.5 sm:mx-1"></div>

        <Tooltip text="Capture Image">
          <button
            disabled={!isCameraActive}
            onClick={capturePhoto}
            className="text-moss-400 p-3.5 sm:p-3 hover:text-mint-500 hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-full"
          >
            <Camera className="w-5 h-5" />
          </button>
        </Tooltip>

        <Tooltip text={copied ? "Copied!" : "Copy ASCII to Clipboard"}>
          <button
            disabled={!isCameraActive}
            onClick={copyAsciiToClipboard}
            className={`p-3.5 sm:p-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-full ${copied ? 'text-mint-500' : 'text-moss-400 hover:text-mint-500 hover:bg-white/5'}`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </Tooltip>
      </nav>

      {/* Keyboard Shortcuts Help */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          >
            <div className="glass-panel p-6 rounded-2xl border border-moss-500/30 shadow-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-headline text-mint-500 uppercase tracking-tight mb-4">Keyboard Shortcuts</h3>
              <div className="space-y-2">
                {[
                  ['Space', 'Toggle Camera'],
                  ['R', 'Record / Stop'],
                  ['C', 'Capture Photo'],
                  ['E', 'Export ASCII Text'],
                  ['F', 'Toggle Focus'],
                  ['I', 'Toggle Invert'],
                  ['T', 'Toggle CRT'],
                  ['?', 'Show / Hide Shortcuts'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-moss-400 font-body">{desc}</span>
                    <kbd className="text-[10px] font-mono text-mint-500 bg-moss-900/80 border border-moss-500/30 px-2 py-0.5 rounded">{key}</kbd>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="mt-4 w-full text-[10px] font-mono uppercase tracking-wider text-moss-400 hover:text-mint-500 transition-colors py-2 border border-moss-500/20 rounded-full hover:border-mint-500/20"
              >
                Close (or press ?)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Vertical Slider */}
      <AnimatePresence>
        {isCameraActive && showZoom && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 glass-panel py-4 px-2 rounded-full flex flex-col items-center gap-4 z-40 border border-moss-500/20"
          >
            <span className="text-[10px] font-mono text-moss-400 font-bold tracking-wider">5.0</span>
            <div className="h-32 sm:h-48 relative flex items-center justify-center w-6">
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="absolute w-32 sm:w-48 h-1.5 -rotate-90 appearance-none bg-transparent [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-moss-500/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mint-500 cursor-pointer"
              />
            </div>
            <span className="text-[10px] font-mono text-moss-400 font-bold tracking-wider">1.0</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
