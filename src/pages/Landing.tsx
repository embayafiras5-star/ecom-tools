import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Upload,
  Download,
  Check,
  ArrowRight,
  Sparkles,
  Smartphone,
  Minimize2,
  Zap,
  Shield,
  Globe,
  X,
  FileImage,
  Package,
} from "lucide-react";
import JSZip from "jszip";

/* ─── AdSense Placeholder ────────────────────────────────────── */
function AdPlaceholder({ label = "AdSense" }: { label?: string }) {
  return (
    <div className="w-full rounded-2xl border-2 border-dashed border-primary/15 bg-white/30 backdrop-blur-sm flex items-center justify-center py-6 my-6 text-muted-foreground/40 text-xs font-medium tracking-wide uppercase select-none">
      {label}
    </div>
  );
}

/* ─── Utility: format bytes ──────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}


/* ─── Image Compressor ───────────────────────────────────────── */
interface CompressedImage {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  compressedBlob: Blob | null;
  compressedSize: number;
  preview: string;
  status: "pending" | "compressing" | "done" | "error";
}

function compressImage(
  file: File,
  quality = 0.8,
  maxWidth = 2048,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = (h * maxWidth) / w;
        w = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not supported"));
        return;
      }
      // White background so transparent PNGs don't become black
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Always output JPEG — quality param is ignored for PNG in toBlob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Compression failed: toBlob returned null"));
          }
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      console.error("[compressImage] Failed to load image:", file.name, e);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

function ImageCompressorTool() {
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [quality, setQuality] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/"),
      );
      const newItems: CompressedImage[] = imageFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        originalSize: file.size,
        compressedBlob: null,
        compressedSize: 0,
        preview: URL.createObjectURL(file),
        status: "pending" as const,
      }));

      setImages((prev) => [...prev, ...newItems]);

      for (const item of newItems) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === item.id ? { ...img, status: "compressing" } : img,
          ),
        );
        try {
          const blob = await compressImage(item.file, quality);
          setImages((prev) =>
            prev.map((img) =>
              img.id === item.id
                ? {
                    ...img,
                    compressedBlob: blob,
                    compressedSize: blob.size,
                    status: "done",
                  }
                : img,
            ),
          );
        } catch (err) {
          console.error("[ImageCompressor] Error compressing:", item.name, err);
          setImages((prev) =>
            prev.map((img) =>
              img.id === item.id ? { ...img, status: "error" } : img,
            ),
          );
        }
      }
    },
    [quality],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDownload = (item: CompressedImage) => {
    if (!item.compressedBlob) return;
    const baseName = item.name.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(item.compressedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}-compressed.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    const doneItems = images.filter((img) => img.status === "done" && img.compressedBlob);
    if (doneItems.length === 0) return;
    for (const item of doneItems) {
      const baseName = item.name.replace(/\.[^.]+$/, "");
      zip.file(`${baseName}-compressed.jpg`, item.compressedBlob!);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compressed-images.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  const doneCount = images.filter((i) => i.status === "done").length;
  const totalSaved =
    images
      .filter((i) => i.status === "done")
      .reduce((acc, i) => acc + (i.originalSize - i.compressedSize), 0);

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-8 text-center ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-primary/20 hover:border-primary/40 hover:bg-white/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-3">
          <div
            className={`rounded-2xl p-4 transition-colors ${
              isDragging ? "bg-primary/10" : "bg-primary/5"
            }`}
          >
            <Upload
              className={`h-7 w-7 transition-colors ${
                isDragging ? "text-primary" : "text-primary/60"
              }`}
            />
          </div>
          <div>
            <p className="font-semibold text-foreground/90">
              Drop images here or click to browse
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              JPG, PNG, WebP — multiple files supported
            </p>
          </div>
        </div>
      </div>

      {/* Quality slider */}
      {images.length > 0 && (
        <div className="glass-subtle rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground/80">
              Compression Quality
            </label>
            <span className="text-sm font-bold text-primary">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={quality}
            onChange={(e) => setQuality(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-primary/10 accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Smaller file</span>
            <span>Better quality</span>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {doneCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-subtle rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-foreground/80">
              <span className="font-bold text-primary">{doneCount}</span>{" "}
              {doneCount === 1 ? "image" : "images"} compressed
            </span>
            <span className="text-green-600 font-semibold">
              Saved {formatBytes(totalSaved)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadAll}
              className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Package className="h-4 w-4" />
              Download All (ZIP)
            </button>
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-xl bg-white/50 border border-white/50 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/70 transition-colors"
            >
              Clear
            </button>
          </div>
        </motion.div>
      )}

      {/* Image list */}
      <AnimatePresence>
        {images.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start"
          >
            {/* Thumbnail */}
            <div className="w-full sm:w-24 h-24 rounded-xl overflow-hidden bg-white/40 shrink-0 flex items-center justify-center">
              <img
                src={item.preview}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground/90 truncate text-sm">
                {item.name}
              </p>
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className="text-muted-foreground">
                  {formatBytes(item.originalSize)}
                </span>
                {item.status === "done" && (
                  <>
                    <ArrowRight className="h-3.5 w-3.5 text-primary" />
                    <span className="font-bold text-primary">
                      {formatBytes(item.compressedSize)}
                    </span>
                    <span className="text-green-600 text-xs font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                      -
                      {Math.round(
                        ((item.originalSize - item.compressedSize) /
                          item.originalSize) *
                          100,
                      )}
                      %
                    </span>
                  </>
                )}
                {item.status === "compressing" && (
                  <span className="text-primary text-xs animate-pulse">
                    Compressing...
                  </span>
                )}
                {item.status === "error" && (
                  <span className="text-destructive text-xs">Error</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0 self-center">
              {item.status === "done" && (
                <button
                  onClick={() => handleDownload(item)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 text-primary px-3 py-2 text-sm font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              )}
              <button
                onClick={() => removeImage(item.id)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-white/50 hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Image Resizer ──────────────────────────────────────────── */
interface Platform {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: string;
}

const PLATFORMS: Platform[] = [
  { id: "tiktok", name: "TikTok Shop", width: 1080, height: 1080, icon: "🎵" },
  { id: "instagram-post", name: "Instagram Post", width: 1080, height: 1080, icon: "📸" },
  { id: "instagram-story", name: "Instagram Story", width: 1080, height: 1920, icon: "📱" },
  { id: "shopify", name: "Shopify Product", width: 2048, height: 2048, icon: "🛒" },
  { id: "amazon", name: "Amazon Listing", width: 1600, height: 1600, icon: "📦" },
];

interface ResizedResult {
  platform: Platform;
  blob: Blob;
  preview: string;
}

function resizeImage(
  file: File,
  targetW: number,
  targetH: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not supported"));
        return;
      }

      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);

      // Cover-fit: scale to fill, then crop
      const imgRatio = img.width / img.height;
      const canvasRatio = targetW / targetH;
      let sx = 0,
        sy = 0,
        sw = img.width,
        sh = img.height;

      if (imgRatio > canvasRatio) {
        sw = img.height * canvasRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasRatio;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("Resize failed"));
        },
        "image/jpeg",
        0.95,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function ImageResizerTool() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(PLATFORMS.map((p) => p.id)),
  );
  const [results, setResults] = useState<ResizedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSourceFile(file);
    setSourcePreview(URL.createObjectURL(file));
    setResults([]);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [], // handleFile is stable
  );

  const togglePlatform = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateAll = async () => {
    if (!sourceFile || selected.size === 0) return;
    setIsProcessing(true);
    setResults([]);

    const newResults: ResizedResult[] = [];
    for (const platform of PLATFORMS) {
      if (!selected.has(platform.id)) continue;
      try {
        const blob = await resizeImage(
          sourceFile,
          platform.width,
          platform.height,
        );
        newResults.push({
          platform,
          blob,
          preview: URL.createObjectURL(blob),
        });
      } catch {
        // skip failures silently
      }
    }
    setResults(newResults);
    setIsProcessing(false);
  };

  const downloadSingle = (result: ResizedResult) => {
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.platform.name.toLowerCase().replace(/\s+/g, "-")}-${result.platform.width}x${result.platform.height}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    if (results.length === 0) return;
    const zip = new JSZip();
    for (const r of results) {
      const fileName = `${r.platform.name.toLowerCase().replace(/\s+/g, "-")}-${r.platform.width}x${r.platform.height}.jpg`;
      zip.file(fileName, r.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resized-images.zip";
    a.click();
    URL.revokeObjectURL(url);
  };



  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-8 text-center ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-primary/20 hover:border-primary/40 hover:bg-white/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-3">
          <div
            className={`rounded-2xl p-4 transition-colors ${
              isDragging ? "bg-primary/10" : "bg-primary/5"
            }`}
          >
            <FileImage
              className={`h-7 w-7 transition-colors ${
                isDragging ? "text-primary" : "text-primary/60"
              }`}
            />
          </div>
          <div>
            <p className="font-semibold text-foreground/90">
              Drop a product image here
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              JPG, PNG, WebP — one image at a time
            </p>
          </div>
        </div>
      </div>

      {/* Source preview + platform checkboxes */}
      {sourceFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 space-y-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/40 shrink-0">
              <img
                src={sourcePreview}
                alt="Source"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-medium text-foreground/90 text-sm truncate max-w-[200px]">
                {sourceFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(sourceFile.size)}
              </p>
            </div>
          </div>

          {/* Platform selection */}
          <div>
            <p className="text-sm font-semibold text-foreground/80 mb-3">
              Select target platforms:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 border ${
                    selected.has(p.id)
                      ? "bg-primary/8 border-primary/25 shadow-sm"
                      : "bg-white/30 border-white/40 hover:bg-white/50"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                      selected.has(p.id)
                        ? "border-primary bg-primary text-white"
                        : "border-muted-foreground/30 bg-white/50"
                    }`}
                  >
                    {selected.has(p.id) && <Check className="h-3 w-3" />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected.has(p.id)}
                    onChange={() => togglePlatform(p.id)}
                  />
                  <span className="text-lg">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground/85 block">
                      {p.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.width}×{p.height}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={generateAll}
            disabled={isProcessing || selected.size === 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate All ({selected.size} sizes)
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground/80">
              Generated images
            </p>
            {results.length > 1 && (
              <button
                onClick={downloadAll}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Package className="h-3.5 w-3.5" />
                Download All (ZIP)
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map((r) => (
              <div
                key={r.platform.id}
                className="glass rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/40 shrink-0">
                  <img
                    src={r.preview}
                    alt={r.platform.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground/85 truncate">
                    {r.platform.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.platform.width}×{r.platform.height} ·{" "}
                    {formatBytes(r.blob.size)}
                  </p>
                </div>
                <button
                  onClick={() => downloadSingle(r)}
                  className="shrink-0 rounded-lg bg-primary/10 text-primary p-2 hover:bg-primary/20 transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Hero / Features Data ───────────────────────────────────── */
const features = [
  {
    icon: <Minimize2 className="h-5 w-5" />,
    title: "Smart Compression",
    desc: "Reduce file sizes by up to 80% without visible quality loss.",
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: "Platform Ready",
    desc: "Resize for TikTok, Instagram, Shopify, and Amazon in one click.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Instant & Private",
    desc: "Everything runs in your browser. No uploads, no servers, no waiting.",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Zero Cost",
    desc: "Completely free. No account required. Use it as much as you need.",
  },
];

/* ─── Main Landing Page ──────────────────────────────────────── */
export default function Landing() {
  const [activeTab, setActiveTab] = useState<"compress" | "resize">("compress");

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-200/40 via-indigo-200/30 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-sky-200/30 via-cyan-100/20 to-transparent blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-[450px] h-[450px] rounded-full bg-gradient-to-tl from-violet-200/30 via-blue-100/20 to-transparent blur-3xl" />
      </div>

      {/* ── Header / Nav ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-md">
              <ImageIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground/90">
              PicForge
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            100% Client-Side
          </div>
        </div>
      </header>

      {/* ── AdSense: Header ──────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <AdPlaceholder label="AdSense — Header" />
      </div>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-12 sm:pt-14 sm:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 glass-subtle rounded-full px-4 py-1.5 text-xs font-semibold text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Free · No Sign-Up · Runs in Your Browser
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Optimize your product
            <br />
            images{" "}
            <span className="bg-gradient-to-r from-primary via-blue-500 to-indigo-500 bg-clip-text text-transparent">
              in seconds
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Compress images to load faster on your store, or resize them to the
            exact dimensions every marketplace demands. All processing happens
            right in your browser — your files never leave your device.
          </p>
        </motion.div>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-10"
        >
          {features.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl px-5 py-4 flex items-start gap-3"
            >
              <div className="rounded-xl bg-primary/8 p-2.5 text-primary shrink-0 mt-0.5">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/85">
                  {f.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── AdSense: Between tools ───────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <AdPlaceholder label="AdSense — Between Tools" />
      </div>

      {/* ── Tools Section ─────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="glass-strong rounded-3xl p-5 sm:p-8"
        >
          {/* Tabs */}
          <div className="flex rounded-2xl bg-white/40 border border-white/40 p-1 mb-8">
            <button
              onClick={() => setActiveTab("compress")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 ${
                activeTab === "compress"
                  ? "bg-white/80 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              <Minimize2 className="h-4 w-4" />
              Image Compressor
            </button>
            <button
              onClick={() => setActiveTab("resize")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 ${
                activeTab === "resize"
                  ? "bg-white/80 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Platform Resizer
            </button>
          </div>

          {/* Tool content */}
          <AnimatePresence mode="wait">
            {activeTab === "compress" ? (
              <motion.div
                key="compress"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-foreground/90">
                    Compress Product Images
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reduce file sizes for faster page loads. Drag multiple images
                    to batch compress.
                  </p>
                </div>
                <ImageCompressorTool />
              </motion.div>
            ) : (
              <motion.div
                key="resize"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-foreground/90">
                    Resize for Every Platform
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload one image and generate perfectly sized versions for
                    TikTok Shop, Instagram, Shopify, and Amazon.
                  </p>
                </div>
                <ImageResizerTool />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="glass-subtle border-t border-white/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center">
              <ImageIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground/80">
              PicForge
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            All processing happens in your browser. Your images never leave your
            device.
          </p>
        </div>
      </footer>
    </div>
  );
}
