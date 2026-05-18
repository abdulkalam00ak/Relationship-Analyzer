import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";

const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_B  = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function UploadZone({ onFile, disabled = false }) {
  const [dragOver, setDragOver]   = useState(false);
  const [selected, setSelected]   = useState(null);   // { name, sizeMB, isZip }
  const [extracting, setExtracting] = useState(false);
  const [extractingName, setExtractingName] = useState("");
  const [fileError, setFileError] = useState(null);
  const inputRef = useRef(null);

  // ── Validate and accept a file ──────────────────────────
  const acceptFile = useCallback(async (file) => {
    setFileError(null);
    if (!file) return;

    if (file.size === 0) {
      setFileError("This file appears to be empty.");
      return;
    }

    const isTxt = file.name.endsWith(".txt") || file.type === "text/plain";
    const isZip = file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";

    if (!isTxt && !isZip) {
      setFileError("Please upload a WhatsApp chat export — either a .txt or a .zip file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_B) {
      setFileError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    if (isTxt) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      setSelected({ name: file.name, sizeMB, isZip: false });
      onFile(file);
    } else if (isZip) {
      setExtracting(true);
      setExtractingName(file.name);
      
      // Complete all extraction entirely locally in the browser
      try {
        const syntheticFile = await extractChatFromZip(file);
        const sizeMB = (syntheticFile.size / 1024 / 1024).toFixed(2);
        
        setSelected({ name: file.name, sizeMB, isZip: true });
        onFile(syntheticFile);
      } catch (err) {
        if (err.message.includes("Could not find") || err.message.includes("appears to be empty")) {
          setFileError(err.message);
        } else {
          setFileError("Could not open this zip file. Please make sure it is a valid WhatsApp export.");
        }
      } finally {
        setExtracting(false);
        setExtractingName("");
      }
    }
  }, [onFile]);

  // ── Drag handlers ────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); if (!disabled && !extracting) setDragOver(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || extracting) return;
    const file = e.dataTransfer.files?.[0];
    acceptFile(file);
  };

  // ── Click handler ────────────────────────────────────────
  const onClick = () => {
    if (!disabled && !extracting) inputRef.current?.click();
  };

  const onInputChange = (e) => {
    acceptFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div className="upload-wrapper">
      <div
        className={[
          "upload-zone",
          dragOver   ? "upload-zone--drag" : "",
          disabled   ? "upload-zone--disabled" : "",
          selected   ? "upload-zone--selected" : "",
          extracting ? "upload-zone--extracting" : "",
        ].filter(Boolean).join(" ")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
        role="button"
        tabIndex={disabled || extracting ? -1 : 0}
        aria-label="Upload WhatsApp chat file"
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.zip,text/plain,application/zip"
          style={{ display: "none" }}
          onChange={onInputChange}
        />

        <div className="upload-icon">
          {extracting ? (
            <i className="ti ti-loader spin" />
          ) : selected ? (
            <i className="ti ti-circle-check" style={{ color: "var(--color-good)" }}/>
          ) : (
            <i className="ti ti-file-upload" />
          )}
        </div>

        {extracting ? (
          <div className="upload-prompt">
            <div className="upload-title">Extracting chat from zip...</div>
            <div className="upload-sub">{extractingName}</div> 
          </div>
        ) : selected ? (
          <div className="upload-selected">
            <div className="upload-filename">
              {selected.name}
              {selected.isZip && <span className="upload-zip-badge">ZIP</span>}
            </div>
            <div className="upload-filesize">
              {selected.isZip ? "chat extracted successfully" : "analyzing now"}
            </div>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-title">Upload your WhatsApp chat</div>
            <div className="upload-sub">Drag and drop a .txt or .zip file, or click to browse</div>
            
            <div className="upload-formats">
              <span className="format-badge"><i className="ti ti-file-text" /> .txt</span>
              <span className="format-badge format-badge--zip"><i className="ti ti-file-zip" /> .zip</span>
            </div>

            <div className="upload-hint">
              Export from WhatsApp → Chat → More → Export Chat → Without Media
            </div>
          </div>
        )}
      </div>

      {fileError && (
        <div className="upload-error">
          <i className="ti ti-alert-circle" />
          {fileError}
        </div>
      )}

      {!selected && !extracting && (
        <div className="upload-privacy">
          <i className="ti ti-shield-check" />
          Your file is read entirely in your browser. Nothing is uploaded or stored anywhere.
        </div>
      )}
    </div>
  );
}

async function extractChatFromZip(zipFile) {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);
  
  const allFiles = Object.values(loadedZip.files).filter(f => !f.dir);
  
  let chatFile = allFiles.find(f => f.name.toLowerCase().endsWith(".txt"));
  
  if (!chatFile) {
    throw new Error(
      "Could not find a chat file inside this zip. Please export the chat from WhatsApp using: Chat → More → Export Chat → Without Media."
    );
  }
  
  // Edge case: multiple .txt files found
  const txtFiles = allFiles.filter(f => f.name.toLowerCase().endsWith(".txt"));
  if (txtFiles.length > 1) {
    chatFile = txtFiles.sort((a, b) => (b._data?.uncompressedSize || 0) - (a._data?.uncompressedSize || 0))[0];
  }
  
  const chatText = await chatFile.async("string");
  if (!chatText.trim()) {
    throw new Error("The chat file inside the zip appears to be empty. Please try exporting again from WhatsApp.");
  }
  
  return new File([chatText], chatFile.name, { type: "text/plain" });
}
