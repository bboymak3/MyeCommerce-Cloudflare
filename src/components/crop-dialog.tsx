"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CropDialogProps {
  open: boolean;
  imageSrc: string;
  onCropComplete: (blob: Blob) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CropDialog({ open, imageSrc, onCropComplete, onCancel }: CropDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  const [crop, setCrop] = useState<CropArea>({ x: 20, y: 20, width: 100, height: 100 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  // Calcular escala cuando se carga la imagen
  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const containerW = container.clientWidth - 16;
    const scale = Math.min(containerW / img.naturalWidth, 1);
    setDisplayScale(scale);
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });

    // Inicializar área de recorte al centro, 80% de la imagen
    const margin = img.naturalWidth * 0.1;
    setCrop({
      x: margin,
      y: margin,
      width: img.naturalWidth - margin * 2,
      height: img.naturalHeight - margin * 2,
    });
  }, []);

  // Coordenadas del toque/click relativas al contenedor
  const getPointerPos = (e: React.TouchEvent | React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    if ("touches" in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) / displayScale,
        y: (e.touches[0].clientY - rect.top) / displayScale,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) / displayScale,
      y: ((e as React.MouseEvent).clientY - rect.top) / displayScale,
    };
  };

  // Detectar qué handle se está tocando/clickeando
  const getHandle = (px: number, py: number): string | null => {
    const handleSize = 30 / displayScale;
    const c = crop;
    const handles: Record<string, { x: number; y: number }> = {
      "tl": { x: c.x, y: c.y },
      "tr": { x: c.x + c.width, y: c.y },
      "bl": { x: c.x, y: c.y + c.height },
      "br": { x: c.x + c.width, y: c.y + c.height },
      "t":  { x: c.x + c.width / 2, y: c.y },
      "b":  { x: c.x + c.width / 2, y: c.y + c.height },
      "l":  { x: c.x, y: c.y + c.height / 2 },
      "r":  { x: c.x + c.width, y: c.y + c.height / 2 },
    };
    for (const [name, pos] of Object.entries(handles)) {
      if (Math.abs(px - pos.x) < handleSize && Math.abs(py - pos.y) < handleSize) {
        return name;
      }
    }
    return null;
  };

  // Detectar si está dentro del área de recorte (para mover)
  const isInsideCrop = (px: number, py: number): boolean => {
    return px >= crop.x && px <= crop.x + crop.width &&
           py >= crop.y && py <= crop.y + crop.height;
  };

  // Iniciar arrastre
  const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const pos = getPointerPos(e);
    const handle = getHandle(pos.x, pos.y);

    if (handle) {
      setResizing(true);
      setActiveHandle(handle);
    } else if (isInsideCrop(pos.x, pos.y)) {
      setDragging(true);
    }

    setDragStart(pos);
    setCropStart({ ...crop });
  };

  // Mover arrastre
  const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragging && !resizing) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    if (dragging) {
      // Mover toda el área
      const newCrop = {
        x: Math.max(0, Math.min(imgSize.w - cropStart.width, cropStart.x + dx)),
        y: Math.max(0, Math.min(imgSize.h - cropStart.height, cropStart.y + dy)),
        width: cropStart.width,
        height: cropStart.height,
      };
      setCrop(newCrop);
    }

    if (resizing && activeHandle) {
      let newCrop = { ...cropStart };

      if (activeHandle.includes("r")) {
        newCrop.width = Math.max(30, Math.min(imgSize.w - newCrop.x, cropStart.width + dx));
      }
      if (activeHandle.includes("l")) {
        const newW = Math.max(30, cropStart.width - dx);
        newCrop.x = Math.max(0, cropStart.x + dx);
        newCrop.width = Math.min(newW, imgSize.w - newCrop.x);
      }
      if (activeHandle.includes("b")) {
        newCrop.height = Math.max(30, Math.min(imgSize.h - newCrop.y, cropStart.height + dy));
      }
      if (activeHandle.includes("t")) {
        const newH = Math.max(30, cropStart.height - dy);
        newCrop.y = Math.max(0, cropStart.y + dy);
        newCrop.height = Math.min(newH, imgSize.h - newCrop.y);
      }

      setCrop(newCrop);
    }
  };

  // Finalizar arrastre
  const handlePointerUp = () => {
    setDragging(false);
    setResizing(false);
    setActiveHandle(null);
  };

  // Recortar la imagen usando canvas
  const doCrop = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
      }
    }, "image/jpeg", 0.85);
  }, [crop, onCropComplete]);

  // Estilo del área de recorte
  const cropStyle: React.CSSProperties = {
    position: "absolute",
    left: crop.x * displayScale,
    top: crop.y * displayScale,
    width: crop.width * displayScale,
    height: crop.height * displayScale,
    border: "2px solid #22c55e",
    boxSizing: "border-box",
    touchAction: "none",
    cursor: dragging ? "move" : "crosshair",
    zIndex: 10,
  };

  const handleSize = 12;
  const handlePositions: Record<string, React.CSSProperties> = {
    tl: { position: "absolute", top: -handleSize / 2, left: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "nw-resize" },
    tr: { position: "absolute", top: -handleSize / 2, right: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "ne-resize" },
    bl: { position: "absolute", bottom: -handleSize / 2, left: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "sw-resize" },
    br: { position: "absolute", bottom: -handleSize / 2, right: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "se-resize" },
    t:  { position: "absolute", top: -handleSize / 2, left: "50%", marginLeft: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "n-resize" },
    b:  { position: "absolute", bottom: -handleSize / 2, left: "50%", marginLeft: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "s-resize" },
    l:  { position: "absolute", left: -handleSize / 2, top: "50%", marginTop: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "w-resize" },
    r:  { position: "absolute", right: -handleSize / 2, top: "50%", marginTop: -handleSize / 2, width: handleSize, height: handleSize, background: "#22c55e", borderRadius: 2, cursor: "e-resize" },
  };

  // Overlay oscuro fuera del área de recorte
  const overlayPaths = `
    M 0 0 H ${imgSize.w * displayScale} V ${imgSize.h * displayScale} H 0 Z
    M ${crop.x * displayScale} ${crop.y * displayScale}
    H ${crop.x * displayScale + crop.width * displayScale}
    V ${crop.y * displayScale + crop.height * displayScale}
    H ${crop.x * displayScale} Z
  `;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-sm">Recortar Imagen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Área de recorte con la imagen */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg bg-black/90 select-none"
            style={{ minHeight: "200px", maxHeight: "60vh" }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Recortar"
              className="block max-w-full"
              style={{ width: imgSize.w * displayScale, height: imgSize.h * displayScale }}
              onLoad={handleImageLoad}
              draggable={false}
            />

            {/* Overlay oscuro */}
            {imgSize.w > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ width: "100%", height: "100%" }}
                viewBox={`0 0 ${imgSize.w * displayScale} ${imgSize.h * displayScale}`}
                preserveAspectRatio="none"
              >
                <path d={overlayPaths} fill="rgba(0,0,0,0.5)" fillRule="evenodd" />
              </svg>
            )}

            {/* Borde del área de recorte */}
            {imgSize.w > 0 && (
              <div style={cropStyle}>
                {/* Grid de tercios (regla de los tercios) */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                </div>
                {/* Handles de esquinas y bordes */}
                {Object.entries(handlePositions).map(([name, style]) => (
                  <div key={name} style={style} className="pointer-events-none" />
                ))}
              </div>
            )}
          </div>

          {/* Instrucciones */}
          <p className="text-[10px] text-center text-muted-foreground">
            Arrastre para mover el area. Tire de las esquinas verdes para cambiar el tamano.
          </p>

          {/* Botones */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-xs" onClick={onCancel}>Cancelar</Button>
            <Button className="flex-1 text-xs" onClick={doCrop}>Recortar y Guardar</Button>
          </div>

          {/* Canvas oculto para recortar */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
