/**
 * dilbar — components/UploadZone.jsx
 * ─────────────────────────────────────────────────────────────
 * The file upload entry point of the app.
 *
 * Features:
 *   - Drag and drop a .txt file anywhere on the zone
 *   - Click to open the file picker
 *   - Validates file type (.txt only)
 *   - Validates file size (max 50MB — WhatsApp exports are usually < 5MB)
 *   - Shows file name and size after selection
 *   - Calls onFile(file) when a valid file is ready
 *   - Shows clear error messages for invalid files
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from "react";

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_B  = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function UploadZone({ onFile, disabled = false }) {
  const [dragOver, setDragOver]   = useState(false);
  const [selected, setSelected]   = useState(null);   // { name, sizeMB }
  const [fileError, setFileError] = useState(null);
  const inputRef = useRef(null);

  // ── Validate and accept a file ──────────────────────────
  const acceptFile = useCallback((file) => {
    setFileError(null);

    if (!file) return;

    // Must be a .txt file
    if (!file.name.endsWith(".txt") && file.type !== "text/plain") {
      setFileError("Please upload a WhatsApp chat export file (.txt format).");
      return;
    }

    // Size check
    if (file.size > MAX_FILE_SIZE_B) {
      setFileError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    if (file.size === 0) {
      setFileError("This file appears to be empty.");
      return;
    }

    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    setSelected({ name: file.name, sizeMB });
    onFile(file);
  }, [onFile]);

  // ── Drag handlers ────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); if (!disabled) setDragOver(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    acceptFile(file);
  };

  // ── Click handler ────────────────────────────────────────
  const onClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const onInputChange = (e) => {
    acceptFile(e.target.files?.[0]);
    // Reset input so same file can be re-uploaded if needed
    e.target.value = "";
  };

  return (
    <div className="upload-wrapper">

      {/* Drop zone */}
      <div
        className={[
          "upload-zone",
          dragOver  ? "upload-zone--drag" : "",
          disabled  ? "upload-zone--disabled" : "",
          selected  ? "upload-zone--selected" : "",
        ].filter(Boolean).join(" ")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload WhatsApp chat file"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          style={{ display: "none" }}
          onChange={onInputChange}
        />

        {/* Icon */}
        <div className="upload-icon">
          {selected
            ? <i className="ti ti-circle-check" style={{ color: "var(--color-good)" }}/>
            : <i className="ti ti-file-upload" />
          }
        </div>

        {/* Text */}
        {selected ? (
          <div className="upload-selected">
            <div className="upload-filename">{selected.name}</div>
            <div className="upload-filesize">{selected.sizeMB} MB — analyzing now</div>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-title">
              {dragOver ? "Drop it here" : "Upload your WhatsApp chat"}
            </div>
            <div className="upload-sub">
              Drag and drop a .txt file, or click to browse
            </div>
            <div className="upload-hint">
              Export from WhatsApp → Chat → More → Export Chat → Without Media
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {fileError && (
        <div className="upload-error">
          <i className="ti ti-alert-circle" />
          {fileError}
        </div>
      )}

      {/* Privacy note */}
      {!selected && (
        <div className="upload-privacy">
          <i className="ti ti-shield-check" />
          Your chat is read entirely in your browser. Nothing is uploaded or stored.
        </div>
      )}

    </div>
  );
}
